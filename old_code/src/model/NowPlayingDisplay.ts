import { VolfbotServer } from "./VolfbotServer.ts";
import { MessageHandling, TimeUnit } from "../functions/MessageHandling.ts";
import { AudioPlayerStatus } from "@discordjs/voice";
import { EmbedBuilder, Message, channelMention, userMention } from "discord.js";
import { Metadata } from "./Metadata.ts";
import { PlayableResource } from "./PlayableResource.ts";

export class NowPlayingDisplay {
  private nowPlayingClock: NodeJS.Timer;
  private server: VolfbotServer;

  constructor(server) {
    this.server = server;
  }

  public Stop() {
    clearInterval(this.nowPlayingClock);
    this.nowPlayingClock = null;
  }

  public Start() {
    this.UpdateNowPlayingStatus().then(() => {
      if (this.nowPlayingClock !== undefined) {
        this.Stop();
      }

      this.nowPlayingClock = setInterval(async () => this.UpdateNowPlayingStatus(), 5000); // Discord Rate Limits mean it is better to limit this to prevent API banning
    });
  }

  private async UpdateNowPlayingStatus() {
    try {
      const embed = await this.CreateNowPlayingEmbed();
      let MessageExists = await MessageHandling.MessageExists(this.server.messages.nowPlaying);

      if (embed.data.description == "Nothing.") {
        return this.Stop();
      }

      if (MessageExists) {
        const nowPlayingMessage = await this.server.messages.nowPlaying.fetch();
        if (nowPlayingMessage.editable) {
          this.server.messages.nowPlaying = await nowPlayingMessage.edit({ embeds: [embed] });
        } else {
          this.CreateNowPlayingMessage(embed, nowPlayingMessage);
        }
      } else {
        this.CreateNowPlayingMessage(embed);
      }
    } catch (error) {
      if (error.code == 10008) {
        this.server.messages.nowPlaying = undefined;
      } else {
        this.Stop();
        MessageHandling.LogError("UpdateNowPlayingStatus", error, this.server);
      }
    }
  }

  private async CreateNowPlayingMessage(embed: EmbedBuilder, nowPlayingMessage?: Message) {
    try {
      if (embed === undefined) {
        embed = new EmbedBuilder().setDescription("Not currently playing a song");
      }

      if (nowPlayingMessage instanceof Message && nowPlayingMessage.deletable) {
        await this.server.UpdateNowPlayingMessage(await this.server.lastChannel.send({ embeds: [embed] }))
      } else {
        this.server.messages.nowPlaying = await this.server.lastChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      MessageHandling.LogError("CreateNowPlayingMessage", error, this.server);
    }
  }

  public async CreateNowPlayingEmbed(): Promise<EmbedBuilder> {
    try {
      let embed: EmbedBuilder = new EmbedBuilder().setTitle("Now Playing").setDescription("Nothing.");
      const nowPlaying: PlayableResource = await this.server.queue.CurrentItem();
      const currentVC = await this.server.GetCurrentVC();
      if (!currentVC) return embed;
      let nowPlayingTitle = `Now Playing`;
      let nowPlayingDescription = `Playing in ${channelMention(currentVC.id)}\r\n\r\n`;

      if (this.server.audioPlayer.state.status === AudioPlayerStatus.Playing && nowPlaying !== undefined && nowPlaying !== null) {
        const metadata: Metadata = nowPlaying.meta;
        const length = metadata.length;
        let lengthString = MessageHandling.GetTimestamp(length);
        let maxUnit: TimeUnit = TimeUnit.second;

        if (lengthString.split(":").length > 2) {
          maxUnit = TimeUnit.hour;
        } else if (lengthString.split(":").length > 1) {
          maxUnit = TimeUnit.minute;
        }

        let playbackDuration = this.server.audioPlayer.state.playbackDuration;
        let playbackString = MessageHandling.GetTimestamp(playbackDuration, maxUnit);

        const percentPlayed: number = Math.ceil((playbackDuration / length) * 100);
        let msg = `[${metadata.title}](${nowPlaying.url}) [${userMention(metadata.queuedBy)}]\n\n`;
        for (let i = 0; i < 33; i++) {
          if (percentPlayed / 3 >= i) {
            msg += '█';
          } else {
            msg += '░';
          }
        }
        msg += ` [${playbackString}/${lengthString}]`;
        embed = new EmbedBuilder().setTitle(nowPlayingTitle).setDescription(nowPlayingDescription + msg);
      }


      return embed;
    } catch (error) {
      MessageHandling.LogError("nowPlayingEmbed", error, this.server);
    }
  }
}