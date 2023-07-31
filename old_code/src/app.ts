import { importx, resolve } from "@discordx/importer";
import { Client } from "discordx";
import * as dotenv from "dotenv";
import path from "path/posix";
import { logger } from "./logging.ts";
import { ActivityType, Events, GatewayIntentBits, Guild, Interaction, Partials } from "discord.js";
import { VolfbotServer } from "./model/VolfbotServer.ts";

let client: Client;

async function Start() {
  try {
    const __dirname = path.resolve(path.dirname(''));

    await importx(`${__dirname}/src/{commands,model,guards}/*.{ts,js}`);

    dotenv.config();

    client = new Client({
      silent: false,
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
      ],
      botGuilds: process.env.DEV == "true" ? ["664999986974687242"] : undefined,
      presence: process.env.DEV == "true" ? { status: "dnd", activities: [{ name: "Bot is underdevelopment", type: ActivityType.Listening }] } : { status: "online", activities: [{ name: "music", type: ActivityType.Listening }] },
    });

    if (process.env.DEV == "true") {
      logger.debug("Developer Mode");
    } else {
      logger.debug("Live");
    }

    client.once("ready", async () => {
      await client.initApplicationCommands();
    });

    client.on("interactionCreate", async (interaction: Interaction) => {
      try {
        client.executeInteraction(interaction);
      } catch (error) {
        logger.error(error);
      }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      client.executeReaction(reaction, user);
    });

    await client.login(process.env.TOKEN).then(() => {
      logger.debug("Volfbot Online");
      client.guilds.cache.forEach((guild: Guild) => VolfbotServer.GetServerFromGuild(guild));
    });
  } catch (error) {
    logger.error(error);
  }
}

export function getClient(): Client {
  return client;
}

Start();
