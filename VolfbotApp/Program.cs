using DSharpPlus;
using DSharpPlus.SlashCommands;
using DSharpPlus.VoiceNext;
using Microsoft.Extensions.Configuration;

namespace Volfbot
{
	class Program 
	{
		static async Task Main(string[] args)
		{
			var config = new ConfigurationBuilder().SetBasePath(Directory.GetCurrentDirectory()).AddJsonFile("appsettings.json", true).Build();
			string token = config.GetRequiredSection("DiscordToken").Value?? "";
			ulong devServer = 0;
			ulong.TryParse(config.GetRequiredSection("DevServerId").Value, out devServer);

			var client = new DiscordClient(new DiscordConfiguration() { Token = token, TokenType = TokenType.Bot, Intents = DiscordIntents.All });
			
			var slash = client.UseSlashCommands();
			slash.RegisterCommands<SlashCommands>(devServer);

			client.UseVoiceNext();

			await client.ConnectAsync();
			await Task.Delay(-1);
		}
	}
}