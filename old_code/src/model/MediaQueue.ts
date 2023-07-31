import { PlayableResource, YouTubePlaylist } from "./PlayableResource.ts";
import { ISong, Queue, QueueManager } from "../database/Queue.ts";
import { VolfbotServer } from "./VolfbotServer.ts";
import { MessageHandling } from "../functions/MessageHandling.ts";
import { default as youtubeSearch } from "youtube-search";
import * as youtubeDL from "youtube-dl-exec";
const youtubeDownloader = youtubeDL.create("/bin/ytdlp");
import { YouTubeSearchOptions, YouTubeSearchPageResults, YouTubeSearchResults } from "youtube-search";
import { AudioResource, demuxProbe, createAudioResource } from "@discordjs/voice";
import { EmbedBuilder, Snowflake } from "discord.js";
import { MediaType } from "./MediaType.ts";
import { IMetadata, Metadata } from "./Metadata.ts";
import moment from "moment";
import { logger } from "../logging.ts";

export class MediaQueue {
	private looping: boolean = false;
	private currentSong: PlayableResource;
	private server: VolfbotServer;

	constructor(server: VolfbotServer) {
		this.server = server;
	}

	private static async SearchYoutube(search: string, server: VolfbotServer): Promise<string> {
		let opts: YouTubeSearchOptions = {
			maxResults: 1,
			key: process.env.GOOGLE_API,
		};

		await server.UpdateStatusMessage(await server.lastChannel.send({ embeds: [new EmbedBuilder().setDescription(`Searching youtube for "${search}"`)] }));

		return new Promise<string>((resolve, reject) => {
			youtubeSearch(search, opts)
				.then((res: { results: YouTubeSearchResults[]; pageInfo: YouTubeSearchPageResults }) => {
					const id: string = res.results[0].id;
					resolve(id);
				})
				.catch((error) => {
					if (error) console.log(error);
					if (error.response.data.error.errors[0].reason == "quotaExceeded") {
						const time = this.GetYouTubeQuotaResetTime();
						reject(new EmbedBuilder().setTitle("Daily YouTube Search Limit Reached!").setDescription(`Limit will reset ${time.fromNow()}`));
					} else {
						reject(error);
					}
				});
		});
	}

	public static async GetMetadata(url: string, queuedBy: string, server: VolfbotServer, playlist?: YouTubePlaylist): Promise<IMetadata> {
		try {
			const meta = new Metadata();
			const exec = await youtubeDownloader.exec(url, {
				quiet: true,
				dumpSingleJson: true,
				simulate: true,
			});

			const details = JSON.parse(exec.stdout);

			meta.title = details.title;
			meta.length = details.duration * 1000;
			meta.queuedBy = queuedBy;
			meta.playlist = playlist ?? null;

			return meta;
		} catch (error) {
			MessageHandling.LogError("GetMetadata", error, server);
		}
	}

	public static async CreateYoutubeResource(url: string): Promise<AudioResource<unknown>> {
		try {
			let opusFailed = false;
			await youtubeDownloader
				.exec(url, {
					simulate: true,
					format: "bestaudio[ext=webm][acodec=opus]",
				})
				.catch((reason) => {
					if (reason.stderr.includes("format is not available")) {
						opusFailed = true;
					} else {
						throw reason;
					}
				});

			let ytFormat = "bestaudio";
			if (!opusFailed) {
				ytFormat += "[ext=webm][acodec=opus]";
			}

			const exec = youtubeDownloader.exec(
				url,
				{
					output: "-",
					quiet: true,
					format: ytFormat,
					limitRate: "100k",
				},
				{ stdio: ["ignore", "pipe", "ignore"] }
			);
			const ytStream = exec.stdout;

			let audioResource: AudioResource;

			const { stream, type } = await demuxProbe(ytStream);
			audioResource = createAudioResource(stream, { inputType: type });

			return audioResource;
		} catch (error) {
			MessageHandling.LogError("CreateYoutubeResource", error);
		}
	}

	public static async CreateYoutubePlaylistResource(playlistId: string, enqueuedBy: Snowflake, server: VolfbotServer): Promise<Array<PlayableResource>> {
		try {
			const exec = await youtubeDownloader.exec(playlistId, {
				dumpSingleJson: true,
				simulate: true,
				flatPlaylist: true,
			});

			const result = JSON.parse(exec.stdout);

			let playlist = new Array<PlayableResource>();

			for (let i = 0; i < result.entries.length; i++) {
				const vid = result.entries[i];

				const url = vid.url;
				const title = result.title;
				const meta = new Metadata();
				meta.title = vid.title;
				meta.length = vid.duration * 1000;
				meta.playlist = new YouTubePlaylist(title, result.entries.length, playlistId, server);
				meta.queuedBy = enqueuedBy;

				let media = new PlayableResource(server, url, meta);
				media.id = media.id + `${i}`;
				playlist.push(media);
			}

			return playlist;
		} catch (error) {
			MessageHandling.LogError("CreateYoutubePlaylistResource", error, server);
		}
	}

	public static async DetermineMediaType(url: string, server?: VolfbotServer): Promise<[MediaType, string]> {
		return new Promise<[MediaType, string]>(async (resolve, reject) => {
			try {
				logger.debug("Determining media type");

				let mediaType: MediaType;
				if (new RegExp(/list=/).test(url)) {
					mediaType = MediaType.yt_playlist;
					logger.debug("MediaType: YouTube Playlist");
					url = url.match(/(?:list=)([^&?]*)/)[1].toString();
				} else if (new RegExp(/watch\?v=/).test(url)) {
					mediaType = MediaType.yt_video;
					logger.debug("MediaType: YouTube Video");
					url =
						"https://www.youtube.com/watch?v=" +
						url
							.match(/(?:v=)([^&?]*)/)
							.toString()
							.slice(2, 13);
				} else if (new RegExp(/youtu\.be/).test(url)) {
					logger.debug("MediaType: YouTube Video");
					mediaType = MediaType.yt_video;
					url =
						"https://www.youtube.com/watch?v=" +
						url
							.match(/(?:.be\/)([^&?]*)/)
							.toString()
							.slice(4, 15);
				} else if (new RegExp(/^[A-Za-z0-9-_]{11}$/).test(url)) {
					logger.debug("MediaType: YouTube Video");
					mediaType = MediaType.yt_video;
					url = "https://www.youtube.com/watch?v=" + url;
				} else if (new RegExp(/^[A-Za-z0-9-_]{34}$/).test(url)) {
					logger.debug("MediaType: YouTube Playlist");
					mediaType = MediaType.yt_playlist;
					url = "https://www.youtube.com/playlist?list=" + url;
				} else if (server != undefined) {
					logger.debug("MediaType: Unknown, Searching YouTube");
					mediaType = MediaType.yt_search;
					let id = await this.SearchYoutube(url, server).catch((error) => {
						return reject(error);
					});
					url = "https://www.youtube.com/watch?v=" + id;
				}
				resolve([mediaType, url]);
			} catch (error) {
				MessageHandling.LogError("DetermineMediaType", error, server);
			}
		});
	}

	private static GetYouTubeQuotaResetTime() {
		let time = moment().hour(0).minute(0);
		if (time.isDST()) {
			time = time.add(1, "day");
			time = time.utcOffset(-480);
		} else {
			time = time.add(1, "day");
			time = time.utcOffset(-420);
		}
		return time;
	}

	public async Enqueue(media: Array<PlayableResource>) {
		try {
			let songs: Array<ISong> = new Array<ISong>();
			media.forEach((video) => {
				if (RegExp(/.*jurassic.*/, "i").test(video.meta.title) && RegExp(/.*harmonica.*/, "i").test(video.meta.title)) {
					this.server.lastChannel.send("No.");
				} else if ((RegExp(/.*titanic.*/, "i").test(video.meta.title) || RegExp(/.*heart.*/, "i").test(video.meta.title)) && (RegExp(/.*flute.*/, "i").test(video.meta.title) || RegExp(/.*recorder.*/, "i").test(video.meta.title))) {
					this.server.lastChannel.send("No.");
				} else {
					songs.push(video.toISong());
				}

				logger.debug(`Enqueing media: ${video.meta.title} url: ${video.url}`);
			});

			QueueManager.EnqueueSongs(songs);
		} catch (error) {
			MessageHandling.LogError("Enqueue", error, this.server);
		}
	}

	public async Dequeue(index: number = 1): Promise<void> {
		try {
			for (let i = 0; i < index; i++) {
				let song = await QueueManager.DequeueSong(this.server.id);
				if (this.looping) await QueueManager.EnqueueSongs([song]);
				this.currentSong = undefined;
			}
		} catch (error) {
			MessageHandling.LogError("Dequeue", error, this.server);
		}
	}

	public async Clear(keepCurrentSong = false) {
		try {
			let currentSong = await this.CurrentItem();
			await QueueManager.ClearQueue(this.server.id);
			if (keepCurrentSong) {
				QueueManager.EnqueueSongs([currentSong.toISong()]);
			} else {
				this.looping = false;
			}
		} catch (error) {
			MessageHandling.LogError("Clear", error, this.server);
		}
	}

	public async GetQueueCount(): Promise<number> {
		try {
			return await QueueManager.GetQueueCount(this.server.id);
		} catch (error) {
			MessageHandling.LogError("GetQueueCount", error, this.server);
		}
	}

	public async GetQueue(): Promise<PlayableResource[]> {
		try {
			let queue = await QueueManager.GetServerQueue(this.server.id);
			return this.MediaQueueFromQueue(queue);
		} catch (error) {
			MessageHandling.LogError("GetQueue", error, this.server);
		}
	}

	public async SetQueue(newQueue: Array<PlayableResource>) {
		try {
			await this.Clear();
			let queue = new Array<ISong>();
			newQueue.forEach((item) => {
				queue.push(item.toISong());
			});
			QueueManager.EnqueueSongs(queue);
		} catch (error) {
			MessageHandling.LogError("SetQueue", error, this.server);
		}
	}

	public async GetItem(id: number): Promise<PlayableResource> {
		try {
			let song = await QueueManager.GetSong(id);
			return PlayableResource.ParseFromISong(song);
		} catch (error) {
			MessageHandling.LogError("GetItem", error, this.server);
		}
	}

	public async GetItemAt(index: number): Promise<PlayableResource> {
		try {
			let song = await QueueManager.GetSongAt(this.server.id, index);
			return PlayableResource.ParseFromISong(song);
		} catch (error) {
			MessageHandling.LogError("GetItemAt", error, this.server);
		}
	}

	public async GetTotalLength(): Promise<number> {
		try {
			let length = 0;
			(await this.GetQueue()).forEach((v) => (length += v.meta.length));
			return length;
		} catch (error) {
			MessageHandling.LogError("GetTotalLength", error, this.server);
		}
	}

	public async HasMedia(): Promise<boolean> {
		try {
			return (await QueueManager.GetQueueCount(this.server.id)) != 0;
		} catch (error) {
			MessageHandling.LogError("HasMedia", error, this.server);
		}
	}

	public async CurrentItem(): Promise<PlayableResource | null> {
		try {
			if (this.currentSong == undefined) {
				let song = await QueueManager.GetCurrentSong(this.server.id);
				if (song == null) return null;
				this.currentSong = await PlayableResource.ParseFromISong(song);
			}
			return this.currentSong;
		} catch (error) {
			MessageHandling.LogError("CurrentItem", error, this.server);
		}
	}

	public async ResumePlayback(): Promise<PlayableResource | null> {
		try {
			let song = null;

			if (this.HasMedia()) {
				song = await this.CurrentItem();
				this.server.PlaySong(song);
			}

			return song;
		} catch (error) {
			MessageHandling.LogError("ResumePlayback", error, this.server);
		}
	}

	loopQueue(): void {
		this.looping = true;
	}

	endLoop(): void {
		this.looping = false;
	}

	public async Shuffle() {
		try {
			let copyQueue = await this.GetQueue();
			let shuffledQueue = new Array<PlayableResource>();
			while (copyQueue.length > 0) {
				const j = Math.floor(Math.random() * copyQueue.length);
				shuffledQueue.push(copyQueue[j]);
				copyQueue = copyQueue.filter((item) => item !== copyQueue[j]);
			}
			this.SetQueue(shuffledQueue);
		} catch (error) {
			MessageHandling.LogError("Shuffle", error, this.server);
		}
	}

	public async RemoveItemAt(i: number): Promise<ISong> {
		try {
			return await QueueManager.RemoveSongAt(this.server.id, i);
		} catch (error) {
			MessageHandling.LogError("RemoveItemAt", error, this.server);
		}
	}

	private MediaQueueFromQueue(queue: Queue): PlayableResource[] {
		let mediaQueue = new Array<PlayableResource>();
		queue.forEach(async (song) => {
			let media = await PlayableResource.ParseFromISong(song);
			mediaQueue.push(media);
		});

		return mediaQueue;
	}
}
