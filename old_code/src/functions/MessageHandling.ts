import { AudioPlayerStatus } from "@discordjs/voice";
import { CommandInteraction, EmbedBuilder, Guild, Message, Snowflake, GuildTextBasedChannel, TextChannel, channelMention, userMention } from "discord.js";
import { Metadata } from "../model/Metadata.ts";
import { PlayableResource } from "../model/PlayableResource.ts";
import { VolfbotServer } from "../model/VolfbotServer.ts";
import { getClient } from "../app.ts";
import { logger } from "../logging.ts";
import { DiscordError, ErrorManager } from "../database/Errors.ts";

export abstract class MessageHandling {
  public static errorTracker: number = 0;
  public static errorClock: NodeJS.Timer;

  public static async RetrieveBotMessages(channel: GuildTextBasedChannel, exclude: string[] = []): Promise<Array<Message>> {
    try {
      let messages = new Array<Message>();
      (await channel.messages.fetch({ limit: 100, cache: false })).forEach(msg => {
        let oldestMsg = new Date();
        oldestMsg.setDate(oldestMsg.getDate() - 13);
        if (msg.author.id == getClient().user.id && !exclude.includes(msg.id) && msg.createdAt > oldestMsg) {
          messages.push(msg);
        }
      });
      return messages;
    } catch (error) {
      this.LogError("RetrieveBotMessages", error, channel.guild)
    }
  }

  public static async ClearMessages(messages: Array<Message>, interaction?: CommandInteraction) {
    const guild = messages.length > 0 ? messages[0].guild : interaction instanceof CommandInteraction ? interaction.guild : null;
    const server = guild !== null ? await VolfbotServer.GetServerFromGuild(guild) : undefined;

    try {
      let embed: EmbedBuilder;
      if (server !== undefined) {
        if (
          server.messages.nowPlaying instanceof Message
          && messages.find(value => value.id === server.messages.nowPlaying.id) !== undefined
        ) {
          await server.UpdateNowPlayingMessage(null);
        }
        if (
          server.messages.queue instanceof Message
          && messages.find(value => value.id === server.messages.queue.id) !== undefined
        ) {
          await server.UpdateQueueMessage(null);
        }
        if (
          server.messages.status instanceof Message
          && messages.find(value => value.id === server.messages.status.id) !== undefined
        ) {
          await server.UpdateStatusMessage(null);
        }

        if (messages.length > 0) {
          if (server.lastChannel instanceof TextChannel) {
            server.lastChannel.bulkDelete(messages);
            embed = new EmbedBuilder().setDescription("Messages deleted");
          } else {
            embed = new EmbedBuilder().setDescription("Cannot delete messages");
          }
        } else {
          embed = new EmbedBuilder().setDescription("No messages to delete");
        }

        if (interaction) {
          interaction.editReply({ embeds: [embed] });
        } else if (server) {
          server.lastChannel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      this.LogError("ClearMessages", error, server)
    }
  }

  public static async LogError(caller: string, error: Error, guild?: Guild | VolfbotServer) {
    this.errorTracker++;

    if (this.errorClock == undefined) {
      this.errorClock = setInterval(() => {
        if (this.errorTracker > 50) {
          logger.error("Throwing error due to excessive errors");
          logger.error(error);
          this.errorTracker = 0;
          throw error;
        } else {
          this.errorTracker = 0;
        }
      }, 5 * 60 * 1000)
    }

    if (this.errorTracker > 50) {
      logger.error("Throwing error due to excessive errors");
      logger.error(error);
      this.errorTracker = 0;
      throw error;
    }

    let lastError = await ErrorManager.getLastError();
    let currentDate = new Date();
    if (lastError == null || currentDate.getTime() - lastError.errorTime.getTime() > 30000) {
      const embed = new EmbedBuilder().setDescription("Failed to log error");
      embed.setTitle("Error!");
      embed.setDescription(`${error.message}\r\n\`\`\`${error.stack}\`\`\`\r\n**The developer has been notified**`);

      let server: VolfbotServer;
      if (guild instanceof VolfbotServer) {
        server = guild;
      } else if (guild instanceof Guild) {
        server = await VolfbotServer.GetServerFromGuild(guild);
      }

      if (server instanceof VolfbotServer && server.lastChannel !== undefined) server.lastChannel.send({ embeds: [embed] });

      const botDevChannel = (await (await getClient().guilds.fetch('664999986974687242')).channels.fetch('888174462011342848')) as GuildTextBasedChannel;
      let errorMsg = userMention('134131441175887872') + " An error has occurred in " + caller;
      if (server instanceof VolfbotServer) errorMsg += "\nOn the discord server: " + server.guild.name;
      botDevChannel.send({ embeds: [embed], content: errorMsg });

      let newError = new DiscordError(currentDate, error.message + ' ' + error.stack);
      ErrorManager.addError(newError);
    }

    logger.error(error);
  }

  public static async MessageExists(message: Message | Snowflake, channel?: GuildTextBasedChannel): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        let fetchedMessage: Message;
        if (message instanceof Message) {
          fetchedMessage = await message.fetch();
        } else if (channel !== undefined && channel !== null && "isTextBased" in channel && channel.isTextBased) {
          fetchedMessage = await channel.messages.fetch({ message: message, cache: false });
        } else {
          resolve(false);
        }

        let msgContent = fetchedMessage.content;
        let editedMessage;

        if (msgContent.includes("\u00AD")) {
          editedMessage = await fetchedMessage.edit({ content: msgContent.replace("\u00AD", "") });
        } else {
          editedMessage = await fetchedMessage.edit({ content: msgContent + "\u00AD" });
        }

        if (editedMessage instanceof Message) {
          resolve(true);
        } else {
          resolve(false);
        }

      } catch (error) {
        if (error.code != 10008 && error.code != 50006) {
          reject(error);
        } else {
          resolve(false);
        }
      }
    });
  }

  public static async InitCommand({ interaction, isStatusMessage: isStatusMessage, isQueueMessage: isQueueMessage, isNowPlayingMessage: isNowPlayingMessage }: InitCommandParams): Promise<VolfbotServer> {
    return new Promise(async (resolve, reject) => {
      try {
        let reply: Message = null;
        if (!interaction.deferred) reply = await interaction.deferReply({ fetchReply: true });

        const server = await VolfbotServer.GetServerFromGuild(interaction.guild);
        logger.debug(`Running ${interaction.commandName} command in ${interaction.guild.name}`);

        if (reply !== null) {
          if (isStatusMessage) await server.UpdateStatusMessage(reply);
          if (isQueueMessage) await server.UpdateQueueMessage(reply);
          if (isNowPlayingMessage) await server.UpdateNowPlayingMessage(reply);
          server.SetLastChannel(interaction.channel);
        }

        resolve(server);
      } catch (error) {
        reject(error);
      }
    });
  }

  public static GetTimestamp(durationMs: number, largestUnit?: TimeUnit): string {
    let timestamp = "";
    let durationSec = durationMs / 1000;
    let hours = Math.floor(durationSec / 3600);
    let minutes = Math.floor(durationSec % 3600 / 60);
    let seconds = Math.floor(durationSec % 3600 % 60);
    if (hours > 0 || largestUnit == TimeUnit.hour) {
      timestamp = `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
    } else if (minutes > 0 || largestUnit == TimeUnit.minute) {
      timestamp = `${minutes}:${('0' + seconds).slice(-2)}`;
    } else {
      timestamp = `${seconds}`;
    }

    return timestamp;
  }
}

export enum TimeUnit {
  hour,
  minute,
  second
}

export interface InitCommandParams {
  interaction: CommandInteraction;
  isStatusMessage?: boolean;
  isQueueMessage?: boolean;
  isNowPlayingMessage?: boolean;
}