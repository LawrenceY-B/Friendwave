import { ErrorRequestHandler, NextFunction, Request, Response } from "express"
import { environment } from "../environments/endpoints.config";

export const ErrorHandler = (err:any, req:Request, res:Response, next:NextFunction) => {
    const errStatus:number = err.statusCode || 500;
    const message = err.message || "Something went wrong";
    res.status(errStatus).json({
        success: false,
        errStatus,
        message,
        stack: environment.PROD_ENV !== "development" ? {} : err.stack,
    })
}