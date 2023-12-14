import mongoose from "mongoose";
import { environment } from "../environments/endpoints.config";
import Logger from "../lib/logger";


export const DB_Connection = async () => {
    mongoose
    .connect(`${environment.DBUrl}`, {})
    .then(() => {
      Logger.debug("MongoDB connected!!");
    })
    .catch((err: Error) => {
      Logger.error("Failed to connect to MongoDB", err);
    });
};



