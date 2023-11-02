import mongoose from "mongoose";
import { environment } from "../environments/endpoints.config";


export const DB_Connection = async () => {
    mongoose
    .connect(`${process.env.MONGODBURL}`, {})
    .then(() => {
      console.log("MongoDB connected!!");
    })
    .catch((err) => {
      console.log("Failed to connect to MongoDB", err);
    });
};



