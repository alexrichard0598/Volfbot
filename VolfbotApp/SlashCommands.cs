using DSharpPlus;
using DSharpPlus.Entities;
using DSharpPlus.SlashCommands;
using DSharpPlus.VoiceNext;
using System.Threading.Channels;
using VolfbotServices;

namespace Volfbot
{
	public class SlashCommands: ApplicationCommandModule
	{
		[SlashCommand("test", "This is a test slash command")]
		public async Task TestCommand(InteractionContext context)
		{
			await context.CreateResponseAsync(InteractionResponseType.ChannelMessageWithSource,
				new DiscordInteractionResponseBuilder()
			{
				Content = "Success!"
			});
		}

		[SlashCommand("help", "Displays a list of commands and an explanation of what they do")]
		public async Task Help(InteractionContext context)
		{
			StreamReader sr = new StreamReader("help.txt");
			var helpText = await sr.ReadToEndAsync();
			var embed = new DiscordEmbedBuilder() { Description = helpText };

			await context.CreateResponseAsync(InteractionResponseType.ChannelMessageWithSource, new DiscordInteractionResponseBuilder().AddEmbed(embed));
		}

		[SlashCommand("join", "Join the VC you are currently connected to")]
		public async Task Join(InteractionContext context)
		{
			await context.CreateResponseAsync(InteractionResponseType.DeferredChannelMessageWithSource);

			DiscordServer server = new DiscordServer(context.Guild, context.Client);
			DiscordChannel? channel = context.Member.VoiceState?.Channel;

			if (channel == null)
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("You are not currently connected to a voice channel"));
				return;
			}

			var connection = await server.ConnectToVC(channel.Id);

			if (connection != null)
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("I've connected to " + channel.Mention));
			}
			else
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("I'm already connected to " + channel.Mention));
			}
		}

		[SlashCommand("disconnect", "Disconnect from the VC")]
		public async Task Disconnect(InteractionContext context)
		{
			await context.CreateResponseAsync(InteractionResponseType.DeferredChannelMessageWithSource);

			DiscordServer server = new DiscordServer(context.Guild, context.Client);

			if (server.IsBotInVC())
			{
				await server.DisconnectFromVC();
				var channel = context.Member.VoiceState.Channel;
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("I've disconnected from " + channel.Mention));
			}
			else
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("I'm not currently connected to a VC"));
			}
		}

		[SlashCommand("dc", "Disconnect from the VC")]
		public async Task DC(InteractionContext context)
		{
			await Disconnect(context);
		}

		[SlashCommand("play", "Plays the audio from a YouTube video")]
		public async Task Play(InteractionContext context, [Option("url", "The url of the YouTube video to play")] string url)
		{
			await context.CreateResponseAsync(InteractionResponseType.DeferredChannelMessageWithSource);

			DiscordServer server = new DiscordServer(context.Guild, context.Client);
			DiscordChannel? channel = context.Member.VoiceState?.Channel;

			if (channel == null)
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("You are not currently connected to a voice channel"));
				return;
			}

			var connection = await server.ConnectToVC(channel.Id);

			if (connection != null)
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("I've connected to " + channel.Mention));
			}

			var isPlaylist = await Media.IsPlaylistAsync(url);

			if (isPlaylist)
			{
				await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("Playlist support is underdevelopment"));
				return;
			}

			Media media = new Media(context.Interaction.Id, context.Guild.Id, url, context.Member.Id);

			media.GetAudioStream(context);

			await context.EditResponseAsync(new DiscordWebhookBuilder().WithContent("The title of the media is: " + media.metadata.title));
		}
	}
}
