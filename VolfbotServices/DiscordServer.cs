using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.VoiceNext;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace VolfbotServices
{
	public class DiscordServer
	{
		DiscordGuild _guild;
		ulong _lastTextChannel;
		ulong _lastVoiceChannel;
		DiscordClient _client;

		public DiscordServer(DiscordGuild guild, DiscordClient client)
		{
			_guild = guild;
			_client = client;
		}

		public bool IsBotInVC(ulong vc = 0)
		{
			var vnext = _client.GetVoiceNext();
			var connection = vnext.GetConnection(_guild);

			if (connection == null)
			{
				return false;
			}
			else if (vc == 0)
			{
				return true;
			}

			var channel = connection.TargetChannel;

			return channel.Id == vc;
		}

		public async Task<VoiceNextConnection?> ConnectToVC(ulong vc)
		{
			if (IsBotInVC(vc))
			{
				return null;
			}

			var channel = await _client.GetChannelAsync(vc);
			return await channel.ConnectAsync();
		}

		public async Task<VoiceNextConnection> DisconnectFromVC()
		{
			var vnext = _client.GetVoiceNext();
			var connection = vnext.GetConnection(_guild);
			connection.Disconnect();
			return connection;
		}
	}
}
