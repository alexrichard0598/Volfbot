import { Message } from "discord.js";

export class ServerMessages {
    status: Message | null;
    queue: Message | null;
    nowPlaying: Message | null;
}