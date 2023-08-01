using DSharpPlus.Entities;
using DSharpPlus.SlashCommands;
using DSharpPlus.VoiceNext;
using NAudio.Wave;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using YoutubeDLSharp;
using YoutubeDLSharp.Metadata;
using YoutubeDLSharp.Options;

namespace VolfbotServices
{
	public abstract class Media
	{
		public ulong id;
		public ulong discordServerId;
		public string url;
		public Metadata metadata;

		public Media(ulong id, ulong discordServerId, string url, ulong queuedBy)
		{
			this.id = id;
			this.discordServerId = discordServerId;
			this.url = url;
			this.metadata = GetMetadata(url, queuedBy).Result;
		}

		internal Media(ulong id, ulong discordServerId, string url, Metadata metadata)
		{
			this.id = id;
			this.discordServerId = discordServerId;
			this.url = url;
			this.metadata = metadata;
		}

		public static async Task<Media> GetMedia(ulong id, ulong discordServerId, string url, ulong queuedBy)
		{
			Metadata metadata = await GetMetadata(url, queuedBy);

			if (metadata.playlistUrl != "")
			{
				return new YouTubePlaylist(id, discordServerId, url, metadata);
			}
			else
			{
				return new YouTubeVideo(id, discordServerId, url, metadata);
			}
		}

		private static async Task<Metadata> GetMetadata(string url, ulong queuedBy)
		{
			var ytdlp = new YoutubeDL();
			ytdlp.YoutubeDLPath = "ytdlp.exe";
			OptionSet options = new OptionSet()
			{
				DumpSingleJson = true,
				FlatPlaylist = true,
			};
			var videoData = await ytdlp.RunVideoDataFetch(url, overrideOptions: options);
			var data = videoData.Data;
			var playlistUrl = videoData.Data.ResultType == MetadataType.Playlist ? "" : "";
			Metadata metadata = new Metadata(data.Title, data.Duration.GetValueOrDefault(), queuedBy);
			return metadata;
		}

		public abstract Task PlayMedia(InteractionContext context);
		public abstract bool IsPlaylist();
	}
}
