import { DataBase } from "./DataBase.ts";

export interface IDiscordServer {
  id: string;
  lastChannelId: string;
  lastVCId: string;
}

export class DiscordServer implements IDiscordServer {
  id: string;
  lastChannelId: string;
  lastVCId: string;

  constructor(id, lastChannelId, lastVCId) {
    this.id = id;
    this.lastChannelId = lastChannelId;
    this.lastVCId = lastVCId;
  }
}

export abstract class DiscordServerManager {
  public static async GetAllServers(): Promise<Array<IDiscordServer>> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let servers: Array<IDiscordServer> = new Array<IDiscordServer>;

        db.connection.query('SELECT * FROM DiscordServers', function (error, results: [IDiscordServer], fields) {
          results.forEach(result => {
            servers.push(new DiscordServer(result.id, result.lastChannelId, result.lastVCId));
          });
        }).on("end", () => {
          db.connection.end();
          resolve(servers);
        });
      });
  }

  public static async GetServer(id: string): Promise<IDiscordServer | null> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let server: IDiscordServer;

        db.connection.query(`SELECT * FROM DiscordServers WHERE id = ${id}`, function (error, results, fields) {
          const result = results[0];
          if (result) {
            server = new DiscordServer(result.id, result.lastChannelId, result.lastVCId);
          } else {
            server = null;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(server);
        });
      });
  }

  public static async AddServer(server: IDiscordServer): Promise<void> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query('INSERT INTO DiscordServers SET ?', server, function (error, results, fields) {
          if (error) reject(error);
        }).on("end", () => {
          db.connection.end();
          resolve();
        });
      });
  }

  public static async UpdateServer(server: IDiscordServer): Promise<void> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(`UPDATE DiscordServers SET lastChannelId = ${server.lastChannelId}, lastVCId = ${server.lastVCId} WHERE id = ${server.id}`, server, function (error, results, fields) {
          if (error) reject(error);
        }).on("end", () => {
          db.connection.end();
          resolve();
        });
      });
  }
}