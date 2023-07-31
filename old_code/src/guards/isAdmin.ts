import { ArgsOf, GuardFunction } from "discordx";
import { CommandInteraction } from "discord.js";

export const IsAdmin: GuardFunction<
  ArgsOf<"interactionCreate"> | CommandInteraction
> = async (arg, _client, next) => {
  const argObj = arg instanceof Array ? arg[0] : arg;
  if (argObj instanceof CommandInteraction) {
    if (argObj.user.id === "134131441175887872") {
      await next();
    } else {
      return IsAdmin;
    }
  }
};
