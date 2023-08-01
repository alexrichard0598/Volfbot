using DSharpPlus.Entities;
using DSharpPlus.SlashCommands;
using DSharpPlus.VoiceNext;
using NAudio.Wave;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using YoutubeDLSharp;
using YoutubeDLSharp.Metadata;
using YoutubeDLSharp.Options;

namespace VolfbotServices
{
	public class Media
	{
		public ulong id;
		public ulong discordServerId;
		public string url;
		public Metadata metadata;

		public Media(ulong interactionId, ulong discordServerId, string url, ulong queuedBy) 
		{ 
			this.id = interactionId;
			this.discordServerId = discordServerId;
			this.url = url;
			this.metadata = GetMetadata(queuedBy).Result;
		}

		private async Task<Metadata> GetMetadata(ulong queuedBy)
		{
			var ytdlp = new YoutubeDL();
			ytdlp.YoutubeDLPath = "ytdlp.exe";
			var videoData = await ytdlp.RunVideoDataFetch(url);
			var data = videoData.Data;
			Metadata metadata = new Metadata(data.Title, data.Duration.GetValueOrDefault(), queuedBy);
			return metadata;
		}

		public async Task GetAudioStream(InteractionContext context)
		{
			var ytdlp = new YoutubeDL();
			ytdlp.YoutubeDLPath = "ytdlp.exe";
			var options = new OptionSet() { Format = "m4a", GetUrl = true };
			string streamUrl = ytdlp.RunWithOptions(
				new[] { url },
				options,
				CancellationToken.None
			).Result.Data[0];

			var vnext = context.Client.GetVoiceNext();
			var connection = vnext.GetConnection(context.Guild);
			var transmit = connection.GetTransmitSink();

			// Frequency (playback?) incorrect

			using (var mf = new MediaFoundationReader(streamUrl))
			using (var wo = new WasapiOut())
			{
				await StreamExtensions.CopyToAsync(mf, transmit);
			}


			return;
		}

		public static async Task<bool> IsPlaylistAsync(string url)
		{
			var ytdlp = new YoutubeDL();
			ytdlp.YoutubeDLPath = "ytdlp.exe";
			var videoData = await ytdlp.RunVideoDataFetch(url);
			var data = videoData.Data;
			
			return videoData.Data.ResultType == MetadataType.Playlist;
		}
	}
}
