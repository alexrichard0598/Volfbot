using DSharpPlus.SlashCommands;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace VolfbotServices
{
	public class YouTubePlaylist : Media
	{
		public YouTubePlaylist(ulong interactionId, ulong discordServerId, string url, Metadata metadata) : base(interactionId, discordServerId, url, metadata)
		{
		}

		public override bool IsPlaylist()
		{
			return true;
		}

		public override Task PlayMedia(InteractionContext context)
		{
			throw new NotImplementedException();
		}
	}
}
