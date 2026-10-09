import { NextFunction, Request, Response } from "express";
import { ObjectSchema } from "joi";
import { badRequest } from "../lib/http";

interface Schemas {
  params?: ObjectSchema;
  query?: ObjectSchema;
  body?: ObjectSchema;
}

// Route-level validation: validate({ params, query, body }) runs before the
// controller, so controllers can trust their input. Unknown fields are rejected.
export const validate = (schemas: Schemas) => (req: Request, res: Response, next: NextFunction) => {
  for (const part of ["params", "query", "body"] as const) {
    const schema = schemas[part];
    if (!schema) continue;
    const { error, value } = schema.validate(req[part] ?? {});
    if (error) throw badRequest(error.details[0].message.replace(/"/g, ""));
    // In Express 5 req.query and req.params are read-only; body can take the cleaned value
    if (part === "body") req.body = value;
  }
  next();
};
