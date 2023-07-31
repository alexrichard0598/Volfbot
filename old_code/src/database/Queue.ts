import { DataBase } from "./DataBase.ts";

export interface ISong {
  id: string;
  url: string;
  title: string;
  length: number;
  queuedBy: string;
  youtubePlaylistId: string | null;
  discordServerId: string;
  queueOrder: number;
}

export class Song implements ISong {
  id: string;
  url: string;
  title: string;
  length: number;
  queuedBy: string;
  youtubePlaylistId: string | null;
  discordServerId: string;
  queueOrder: number = 1;

  constructor(
    id: string,
    url: string,
    title: string,
    length: number,
    queuedBy: string,
    youtubePlaylistId: string | null,
    discordServerId: string
  ) {
    this.id = id;
    this.url = url;
    this.title = title;
    this.length = length;
    this.queuedBy = queuedBy;
    this.youtubePlaylistId = youtubePlaylistId;
    this.discordServerId = discordServerId;
  }
}

export class Queue extends Array<ISong>{ }

export abstract class QueueManager {
  public static async GetServerQueue(serverId: string): Promise<Queue> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let queue: Queue = new Queue();

        db.connection.query(`SELECT * FROM Songs WHERE discordServerId = ${serverId}`, (error, results: [ISong], fields) => {
          queue = results;
        }).on("end", () => {
          db.connection.end();
          resolve(queue);
        });
      }
    );
  }

  public static async DequeueSong(serverId: string): Promise<Song> {
    let song = await QueueManager.GetCurrentSong(serverId);

    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(`DELETE FROM Songs WHERE discordServerId = ${serverId} AND queueOrder = 1`);
        db.connection.query(`UPDATE Songs SET queueOrder = queueOrder - 1 WHERE discordServerId = ${serverId}`);

        db.connection.end();

        resolve(song);
      }
    );
  }

  public static async GetQueueCount(serverId: string): Promise<number> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let count: number = 0;

        db.connection.query(`SELECT COUNT(*) AS count FROM Songs WHERE discordServerId = ${serverId}`, (error, results, fields) => {
          if (error) {
            reject(error)
          } else if (results) {
            count = results[0].count as number;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(count);
        });
      }
    );
  }

  public static async EnqueueSongs(songs: ISong[]): Promise<Queue> {
    if (songs[0] == undefined) throw new Error("Must provide a song to queue");

    let count = (await QueueManager.GetQueueCount(songs[0].discordServerId)) + 1;
    for (let i = 0; i < songs.length; i++) {
      songs[i].queueOrder = count + i;
    }

    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(
          'INSERT INTO Songs (`id`, `url`, `title`, `length`, `queuedBy`, `youtubePlaylistId`, `discordServerId`, `queueOrder`) VALUES ?', 
          [songs.map(song => [song.id, song.url, song.title, song.length, song.queuedBy, song.youtubePlaylistId, song.discordServerId, song.queueOrder])], (error, res, fields) => {
            if (error) reject(error);
            resolve(res);
          });
        db.connection.end();
      }
    );
  }

  public static async GetCurrentSong(serverId: string): Promise<Song> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let song: ISong;

        db.connection.query(`SELECT * FROM Songs WHERE discordServerId = ${serverId} AND queueOrder = 1`, (error, results: [ISong], fields) => {
          if (error) reject(error);
          const result = results[0];
          if (result) {
            song = new Song(result.id, result.url, result.title, result.length, result.queuedBy, result.youtubePlaylistId, result.discordServerId);
            song.queueOrder = result.queueOrder;
          } else {
            song = null;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(song);
        });
      }
    );
  }

  public static async GetSong(songId: number): Promise<Song> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let song: ISong;

        db.connection.query(`SELECT * FROM Songs WHERE id = ${songId}`, (error, results: [ISong], fields) => {
          if (error) reject(error);
          const result = results[0];
          if (result) {
            song = new Song(result.id, result.url, result.title, result.length, result.queuedBy, result.youtubePlaylistId, result.discordServerId);
            song.queueOrder = result.queueOrder;
          } else {
            song = null;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(song);
        });
      }
    );
  }

  public static async GetSongAt(serverId: string, queueOrder: number): Promise<Song> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let song: ISong;

        db.connection.query(`SELECT * FROM Songs  WHERE discordServerId = ${serverId} AND queueOrder = ${queueOrder}`, (error, results: [ISong], fields) => {
          if (error) reject(error);
          const result = results[0];
          if (result) {
            song = new Song(result.id, result.url, result.title, result.length, result.queuedBy, result.youtubePlaylistId, result.discordServerId);
            song.queueOrder = result.queueOrder;
          } else {
            song = null;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(song);
        });
      }
    );
  }

  public static async RemoveSongAt(serverId: string, queueOrder: number): Promise<ISong> {
    let song = await QueueManager.GetCurrentSong(serverId);

    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(`DELETE FROM Songs WHERE discordServerId = ${serverId} AND queueOrder = ${queueOrder}`);
        db.connection.query(`UPDATE Songs SET queueOrder = queueOrder - 1 WHERE discordServerId = ${serverId} AND queueOrder > ${queueOrder}`);

        db.connection.end();

        resolve(song);
      }
    );
  }

  public static async ClearQueue(serverId: string) {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(`DELETE FROM Songs WHERE discordServerId = ${serverId}`, (error, results, fields) => {
          resolve(results);
        });

        db.connection.end();
      }
    );
  }
}