import { Request, Response, NextFunction } from "express";
import { environment } from "../environments/endpoints.config";

const ErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.statusCode || 500; // if no status code is provided, default to 500 (internal server error)
    const message = err.message || "Something went wrong";
    res.status(status).json({
        success: false,
        status,
        message,
        stack: environment.PROD_ENV !== "development" ? {} : err.stack,
    })
}

export default ErrorHandler;