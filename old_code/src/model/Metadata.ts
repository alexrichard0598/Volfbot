import { Snowflake } from "discord.js";
import { YouTubePlaylist } from "./PlayableResource.ts";

export interface IMetadata {
  title: string;
  length: number;
  queuedBy: Snowflake;
  playlist: YouTubePlaylist | null;
}

export class Metadata implements IMetadata {
  title: string;
  length: number;
  queuedBy: Snowflake;
  playlist: YouTubePlaylist | null;

  constructor() {
    this.title = "";
    this.length = 0;
    this.playlist = null;
  }
}
