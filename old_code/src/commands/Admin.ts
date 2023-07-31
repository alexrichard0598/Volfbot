import { CommandInteraction } from "discord.js";
import { Discord, Slash, Guard } from "discordx";
import { getClient } from "../app.ts";
import { IsAdmin } from "../guards/isAdmin.ts";
import { logger } from "../logging.ts";
import { MessageHandling } from "../functions/MessageHandling.ts";

@Discord()
export abstract class Voice {
  @Slash({
    name: "shutdown",
    description: "Shutdowns the bot, can only be accessed by bot admins",
  })
  @Guard(IsAdmin)
  public async Shutdown(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Shutting Down").then(() => {
      logger.info("Shutting Down from shutdown command")
      getClient().destroy();
    });
  }

  @Slash({
    name: "restart",
    description: "Restarts the bot, can only be accessed by bot admins",
  })
  @Guard(IsAdmin)
  public async Restart(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Restarting").then(() => {
      logger.info("Throwing an error to restart the bot")
      throw new Error("Restarting bot.");
    });
  }

  @Slash({
    name: "test-error",
    description: "Throws a test error, can only be accessed by bot admins",
  })
  @Guard(IsAdmin)
  public async TestError(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Throwing Error").then(() => {
      throw new Error("Test Error");
    }).catch((error) => {
      MessageHandling.LogError("TestError", error, interaction.guild);
    });
  }
}
