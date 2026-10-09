import { Request, Response, NextFunction } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { environment } from "../environments/endpoints.config";
import Logger from "../lib/logger";

const ErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // If a response was already (partly) sent we can't send another one;
    // hand over to Express's default handler, which closes the connection.
    if (res.headersSent) return next(err);

    let status = err.statusCode || 500; // if no status code is provided, default to 500 (internal server error)
    // Client mistakes should be 4xx, not 500
    if (err instanceof mongoose.Error.CastError || err instanceof mongoose.Error.ValidationError) status = 400;
    if (err instanceof multer.MulterError) status = 400;
    if (err.type === "entity.parse.failed") status = 400; // malformed JSON body
    // Unique index violation, e.g. two people claiming the same username at the same moment
    if (err.code === 11000) {
        status = 409;
        err.message = `${Object.keys(err.keyPattern ?? {}).join(", ") || "Value"} already taken`;
    }

    if (status >= 500) Logger.error(err);
    const message = status >= 500 && !environment.isDevelopment ? "Something went wrong" : err.message;
    res.status(status).json({
        success: false,
        status,
        message,
        stack: environment.isDevelopment ? err.stack : {},
    })
}

export default ErrorHandler;
