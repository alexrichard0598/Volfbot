using DSharpPlus.SlashCommands;
using DSharpPlus.VoiceNext;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using YoutubeDLSharp.Options;
using YoutubeDLSharp;

namespace VolfbotServices
{
	public class YouTubeVideo : Media
	{
		public YouTubeVideo(ulong interactionId, ulong discordServerId, string url, Metadata metadata): base (interactionId, discordServerId, url, metadata)
		{
		}

		public override bool IsPlaylist()
		{
			return false;
		}

		public override async Task PlayMedia(InteractionContext context)
		{
			var ytdlp = new YoutubeDL();
			ytdlp.YoutubeDLPath = "ytdlp.exe";
			var options = new OptionSet() { Format = "m4a", Print = "urls" };
			string streamUrl = ytdlp.RunWithOptions(
				new[] { url },
				options,
				CancellationToken.None
			).Result.Data[0];

			var vnext = context.Client.GetVoiceNext();
			var connection = vnext.GetConnection(context.Guild);

			// Frequency (playback?) incorrect

			VoiceTransmitSink transmit = connection.GetTransmitSink();
			AudioStream audioStream = new AudioStream(streamUrl, transmit, metadata.durationSeconds);
			_ = Task.Run(() => { _ = audioStream.PlayStream(); });
		}
	}
}
