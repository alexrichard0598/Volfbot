import * as mysql from "mysql";
import { config as configDotenv } from "dotenv";
import path, { resolve } from "path/posix";

export class DataBase {
  public readonly connection = mysql.createConnection({
    host: 'localhost',
    user: 'volfbot',
    password: process.env.DATABASE_PASSWORD,
    database: 'volfbot',
    charset: 'utf8mb4',
  });

  constructor() {
    const __dirname = path.resolve(path.dirname(''));

    configDotenv();
  }
}