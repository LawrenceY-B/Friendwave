import mongoose from "mongoose";
import { environment } from "../environments/endpoints.config";


export const DB_Connection = async () => {
    mongoose
    .connect(`${environment.DBUrl}`, {})
    .then(() => {
      console.log("MongoDB connected!!");
    })
    .catch((err: Error) => {
      console.log("Failed to connect to MongoDB", err);
    });
};



