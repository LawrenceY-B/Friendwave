import { ErrorRequestHandler, NextFunction, Request, Response } from "express"
import { environment } from "../environments/endpoints.config";

class HttpError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

export const ErrorHandler: ErrorRequestHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    let errStatus: number = 500;
    let message: string = "Something went wrong";

    if (err instanceof HttpError) {
        errStatus = err.statusCode;
        message = err.message;
    }

    res.status(errStatus).json({
        success: false,
        errStatus,
        message,
        stack: environment.PROD_ENV !== "development" ? {} : err.stack,
    });
};
