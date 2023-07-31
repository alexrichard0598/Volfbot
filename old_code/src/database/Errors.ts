import { DataBase } from "./DataBase.ts";

export interface IDiscordError {
  id: string;
  errorTime: Date;
  errorMessage: string;
}

export class DiscordError implements IDiscordError {
  id: string;
  errorTime: Date;
  errorMessage: string;

  constructor(errorTime, errorMessage) {
    this.errorTime = errorTime;
    this.errorMessage = errorMessage;
  }
}

export abstract class ErrorManager {
  public static async getLastError(): Promise<IDiscordError> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let discordError: IDiscordError;

        db.connection.query('SELECT * FROM Errors ORDER BY ID DESC LIMIT 1', function (error, results, fields) {
          const result = results[0];
          if (result) {
            discordError = new DiscordError(result.errorTime, result.errorMessage);
          } else {
            discordError = null;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(discordError);
        });
      });
  }

  public static async addError(error: IDiscordError): Promise<void> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query('INSERT INTO Errors SET ?', error, function (error, results, fields) {

          if (error) reject(error);
        }).on("end", () => {
          db.connection.end();
          resolve();
        });
      });
  }
}