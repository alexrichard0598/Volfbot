import { Client, Discord, On, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  MessageEmbed,
  VoiceState,
} from "discord.js";
import {
  AudioPlayerStatus,
  DiscordGatewayAdapterCreator,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";

import { IMetadata, Metadata } from "../model/metadata";

import { SharedMethods } from "./sharedMethods";
import { MediaType } from "../model/mediaType";
import { YouTubeVideo } from "../model/youtube";
import moment = require("moment");


@Discord()
export abstract class voice {
  @Slash("join", {
    description: "Join the voice channel you are currently connected to",
  })
  async join(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild); // Get the server
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking

      interaction.editReply({ embeds: [await this.joinVC(interaction)] }); // Join the vc
      server.lastChannel = interaction.channel; // set the last replied channel
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("disconect", { description: "Disconnect from the voice chanel" })
  @Slash("dc", { description: "Disconnect from the voice chanel" })
  async disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild); // Get the server
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      const connection = getVoiceConnection(interaction.guildId); // get the current voice connection
      server.lastChannel = interaction.channel; // set the last replied channel

      /* Checks if the bot is in a voice channel
       * if yes disconnect and then reply
       * if no just reply
       */
      if (connection === null) {
        interaction.editReply("I'm not in any voice chats right now");
      } else {
        SharedMethods.DisconnectBot(server);
        interaction.editReply("Disconnected 👋");
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("play", { description: "Plays music" })
  async play(
    @SlashOption("media", { description: "The media to play", required: true })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      await interaction.deferReply({ fetchReply: true }); // Bot is thinking
      const server = await SharedMethods.getServer(interaction.guild); // get the server

      server.lastChannel = interaction.channel; // update the last replied channel

      const embed = new MessageEmbed(); // create message embed
      const queue = server.queue; // get the server's queue
      const audioPlayer = server.audioPlayer; // get the server's audioPlayer
      var connection = getVoiceConnection(interaction.guildId); // get the current voice connection

      /* if the voice connection is undefined create a voice connection */
      if (connection === undefined) {
        server.lastChannel.send({ embeds: [await this.joinVC(interaction)] });
        connection = getVoiceConnection(interaction.guildId);
      }

      const mediaType = await SharedMethods.determineMediaType(url).catch(err => {
        if (err.response.data.error.errors[0].reason == 'quotaExceeded') {
          var time = moment().hour(0).minute(0);
          if(time.isDST()) {
            time = time.add(1, 'day');
            time = time.utcOffset(-480);
          } else {
            time = time.add(1, 'day');
            time = time.utcOffset(-420);
          }
         
          interaction.editReply({
            embeds: [
              new MessageEmbed()
                .setTitle("Daily YouTube Search Limit Reached!")
                .setDescription(`Limit will reset ${time.fromNow()}`)
            ]
          });
        } else {
          interaction.editReply({ embeds: [new MessageEmbed().setDescription(`${err.message}\r\n\`\`\`${err.stack}\`\`\`\r\nPlease let the developer know`).setTitle("Error!")] });
        }
      });

      if(mediaType == undefined) return;

      /* get the youtube video */
      if (mediaType[0] == MediaType.yt_search) {
        embed.description = `Searching youtube for "${url}"`;
        server.lastChannel.send({ embeds: [embed] });
        url = mediaType[1];
      }

      var media: YouTubeVideo = await queue.enqueue(url, interaction.user.username);

      if (mediaType[0] == MediaType.yt_playlist) {
        embed.title = "Playlist Queued"
        embed.description = `[${media.meta.playlist.name}](https://www.youtube.com/playlist?list=${url}) [${interaction.user.username}]`;
        server.updateQueueMessage(await interaction.fetchReply());
      } else {
        const meta = media.meta as IMetadata;
        embed.title = "Song Queued"
        embed.description = `[${meta.title}](${media.url}) [${meta.queuedBy}]`;
        server.updateQueueMessage(await interaction.fetchReply());
      }

      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      if (audioPlayer.state.status !== AudioPlayerStatus.Playing) {
        var media = await queue.currentItem();
        while (media.resource.ended) {
          await queue.dequeue();
          media = await queue.currentItem() 
        }
        
        audioPlayer.play(media.resource);
        const meta = media.meta as IMetadata;
        embed.title = "Now Playing";
        embed.description = `[${meta.title}](${media.url}) [${meta.queuedBy}]`;
        server.updateStatusMessage(await interaction.fetchReply());
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("stop", { description: "Stops playback and clears queue" })
  @Slash("clear", { description: "Stops playback and clears queue" })
  async stop(interaction: CommandInteraction) {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      server.lastChannel = interaction.channel;
      var connection = getVoiceConnection(interaction.guildId);
      const queue = server.queue;
      const audioPlayer = server.audioPlayer;

      if (connection === undefined) {
        interaction.editReply("Not currently connected to any Voice Channels");
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        interaction.editReply("Nothing is currently queued");
      } else {
        audioPlayer.stop();
        interaction.editReply("Playback stopped");
        queue.clear();
      }

    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("resume", { description: "Plays music" })
  async resume(interaction: CommandInteraction): Promise<void> {
    try {

      const server = await SharedMethods.getServer(interaction.guild);
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      const embed = new MessageEmbed();
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;
      if (audioPlayer.state.status === AudioPlayerStatus.Paused) {
        audioPlayer.unpause();
        embed.description = "Resumed queue";
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        embed.description = "No audio queued up";
      } else {
        embed.description = "Cannot resume queue";
      }
      interaction.editReply({ embeds: [embed] });

    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("pause", { description: "Plays music" })
  async pause(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      const embed = new MessageEmbed();
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;
      if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
        audioPlayer.pause();
        embed.description = "Paused playback";
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        embed.description = "No audio queued up";
      } else {
        embed.description = "Cannot pause";
      }
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("ping", {
    description: "Returns the ping of the current voice connection",
  })
  async ping(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      const server = await SharedMethods.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
      if (getVoiceConnection(interaction.guildId) === undefined) {
        interaction.editReply("I'm not currently in an voice channels");
      } else {
        interaction.editReply(
          "My ping is " +
          getVoiceConnection(interaction.guildId).ping.udp +
          "ms"
        );
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("queue", { description: "View the current queue" })
  async viewQueue(interaction?: CommandInteraction): Promise<void> {
    try {
      const userCalled = interaction !== undefined;
      const server = await SharedMethods.getServer(interaction.guild);
      const queue = server.queue;
      const audioPlayer = server.audioPlayer;
      if (userCalled) {
        server.lastChannel = interaction.channel;
        await interaction.deferReply();
      }

      const embed = new MessageEmbed();
      const title =
        audioPlayer.state.status == AudioPlayerStatus.Playing
          ? "Now Playing"
          : "Current Queue";

      var description = "";

      if (queue.hasMedia()) {
        const queuedSongs = queue.getQueue();
        for (let i = 0; i < queuedSongs.length; i++) {
          const media = queuedSongs[i];
          const meta = media.meta as IMetadata;
          description += `\n${i + 1}. [${meta.title}](${media.url}) [${meta.queuedBy}]`;
        }
      } else {
        description = "No songs currently in queue";
      }

      embed.setTitle(title);
      embed.setDescription(description);

      if (userCalled) {
        interaction.editReply({ embeds: [embed] });
      } else {
        if (server.lastChannel !== undefined)
          server.lastChannel.send({
            embeds: [embed],
          });
      }

      server.updateQueueMessage(await interaction.fetchReply());
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("skip", { description: "Skip the currently playing song(s)" })
  async skip(
    @SlashOption("index", { description: "The index of the song to skip to" })
    skip: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      const queue = server.queue;
      var i = parseInt(skip);
      const embed = new MessageEmbed();
      const audioPlayer = server.audioPlayer;

      if (!queue.hasMedia()) {
        embed.description = "No songs to skip";
      } else if (!isNaN(i)) {
        await queue.dequeue(i);
        audioPlayer.stop();
        embed.description = "Skipped " + (i - 1).toString() + " songs";
      } else {
        audioPlayer.stop();
        embed.description = "Song skipped";
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("loop", { description: "Loops the current queue until looping is stoped" })
  async loop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      server.queue.loopQueue();
      interaction.editReply({ embeds: [new MessageEmbed().setDescription("Queue will loop until stoped")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("end-looping", { description: "Loops the current queue until looping is stoped" })
  async EndLoop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.updateStatusMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      server.queue.endLoop();
      interaction.editReply({ embeds: [new MessageEmbed().setDescription("Queue will no longer loop")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("now-playing", { description: "Loops the current queue until looping is stoped" })
  @Slash("np", { description: "Loops the current queue until looping is stoped" })
  async nowPlaying(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.updateQueueMessage(await interaction.deferReply({ fetchReply: true })); // Bot is thinking
      const nowPlaying: YouTubeVideo = await server.queue.currentItem();
      if (!server.queue.hasMedia()) {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription("No songs are currently queued")] })
      } else if (nowPlaying.meta instanceof Metadata) {
        const metadata: Metadata = nowPlaying.meta as Metadata;
        const playbackDuration = nowPlaying.resource.playbackDuration;
        const durationString = `${new Date(playbackDuration).getMinutes()}:${('0' + new Date(playbackDuration).getSeconds()).slice(-2)}`;
        const length = metadata.length;
        const lengthString = `${new Date(length).getMinutes()}:${('0' + new Date(length).getSeconds()).slice(-2)}`;
        const percPlayed: number = Math.ceil((playbackDuration / length) * 100);
        let msg = `[${metadata.title}](${nowPlaying.url}) [${metadata.queuedBy}]\n\n`;
        for (let i = 0; i < 35; i++) {
          if (percPlayed / 3 >= i) {
            msg += '█';
          } else {
            msg += '▁';
          }
        }
        msg += ` [${durationString}/${lengthString}]`;
        interaction.editReply({ embeds: [new MessageEmbed().setTitle("Now Playing").setDescription(msg)] });
      } else {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription("Could not get currently playing song")] });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @On("voiceStateUpdate")
  async voiceStatusUpdate(voiceStates: [oldState: VoiceState, newState: VoiceState], client: Client) {
    const user = voiceStates[0].member.user;
    const server = await SharedMethods.getServer(voiceStates[0].guild);

    if (user.id != "698214544560095362") {
      const channel = voiceStates[0].channel;
      if (channel != null) {
        if (channel.members.filter(m => m.user.bot == false).size == 0) {
          SharedMethods.DisconnectBot(server);
        }
      }
    }
  }

  /**
   * 
   * @param interaction the discord interaction
   * @returns "Joined " + voiceChannelName
   */
  private async joinVC(interaction: CommandInteraction): Promise<MessageEmbed> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
      const guildMember = await interaction.guild.members.fetch(
        interaction.user
      );
      const embed = new MessageEmbed;
      const vc = guildMember.voice.channel;
      if (vc === null) {
        embed.description = "You are not part of a voice chat, please join a voice chat first.";
      } else {
        await joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guildId,
          adapterCreator: vc.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
        });
        embed.description = "Joined " + vc.name;
      }
      return embed;
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }


}