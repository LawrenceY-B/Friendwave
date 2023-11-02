import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import { environment } from "./environments/endpoints.config";
import { Server } from "http";
import {DB_Connection}  from "./database/db";

dotenv.config();

const app = express();
app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.get("/hii", (req: Request, res: Response) => {
  res.status(200).json({message:"👋🏽👋🏽👋🏽👋🏽👋🏽👋🏽"});
});

app.all("*", (req: Request, res: Response) => {
  res.status(404).json({ message: "Page Not Found 😔" });
});

const server: Server = app.listen(environment.PORT, async () => {
    await DB_Connection();
  console.log(`🚀🚀🚀Server is running on port ${process.env.PORT}`);
});
