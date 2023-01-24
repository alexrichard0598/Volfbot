import { AudioResource } from "@discordjs/voice";
import { Metadata } from "./Metadata";
import { MediaType } from "./MediaType";
import { VolfbotServer } from "./VolfbotServer";
import { ISong, Song } from "../database/Queue";
import { MediaQueue } from "./MediaQueue";
import { MessageHandling } from "../functions/MessageHandling";

export class PlayableResource {
    id: string;
    url: string;
    meta: Metadata;
    private resource: AudioResource;
    discordServerId: string;

    constructor(server: VolfbotServer | string, url = "", meta: Metadata = new Metadata()) {
        this.url = url;
        this.meta = meta;
        this.discordServerId = server instanceof VolfbotServer ? server.id : server;
        this.id = `${this.discordServerId}${Date.now()}${url.split("=")[1]}`;
    }

    public async GetResource(): Promise<AudioResource> {
        try {
            if (this.resource == undefined || this.resource.ended) {
                const typeUrl = await MediaQueue.DetermineMediaType(this.url);
                if (typeUrl[0] == MediaType.yt_video || typeUrl[0] == MediaType.yt_search || typeUrl[0] == MediaType.yt_playlist) {
                    this.resource = await MediaQueue.CreateYoutubeResource(typeUrl[1]);
                }
            }
            return this.resource;
        } catch (error) {
            MessageHandling.LogError("GetResource", error);
        }
    }

    public async SetResource(resource: AudioResource): Promise<this> {
        try {
            this.resource = resource;
            return this;
        } catch (error) {
            MessageHandling.LogError("GetResource", error);
        }
    }

    toISong(): ISong {
        let song = new Song(this.id, this.url, this.meta.title, this.meta.length, this.meta.queuedBy, this.meta.playlist ? this.meta.playlist.id : null, this.discordServerId);
        return song;
    }

    static async ParseFromISong(song: ISong): Promise<PlayableResource> {
        if (song == null) return null;
        let media = new PlayableResource(song.discordServerId);
        media.resource = undefined;
        media.id = song.id;
        media.url = song.url;
        media.meta.title = song.title;
        media.meta.length = song.length;
        media.meta.queuedBy = song.queuedBy;
        media.meta.playlist = null;

        return media;
    }
}

export class YouTubePlaylist {
    id: string;
    name: string;
    length: number;
    playlistUrl: string;

    constructor(name: string, length: number, playlistUrl: string, server: VolfbotServer) {
        this.name = name;
        this.length = length;
        this.playlistUrl = playlistUrl;
        this.id = `${server.id}${Date.now()}${playlistUrl}`;
    }
}