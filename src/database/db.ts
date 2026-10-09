import mongoose from "mongoose";
import { environment } from "../environments/endpoints.config";
import Logger from "../lib/logger";

// Returning (awaiting) the promise lets the caller wait for the connection
// and see the error if it fails.
export const DB_Connection = async () => {
  await mongoose.connect(environment.DBUrl);
  Logger.debug("MongoDB connected!!");
};
