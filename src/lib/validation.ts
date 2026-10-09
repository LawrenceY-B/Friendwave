import joi from "joi";

// A MongoDB ObjectId is 24 hex characters. Validating the format up front
// means bad IDs get a 400 instead of a Mongoose CastError (500).
export const objectId = () =>
  joi.string().hex().length(24).messages({
    "string.hex": "{{#label}} must be a valid id",
    "string.length": "{{#label}} must be a valid id",
  });

// Escape characters that have a special meaning in regular expressions, so
// user input is matched literally (prevents regex injection / ReDoS).
export const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ?cursor=&limit= accepted by every list endpoint
export const pageQuery = {
  cursor: objectId(),
  limit: joi.number().integer().min(1).max(50),
};

// /:id route parameter
export const idParams = joi.object({ id: objectId().required() });

export const pageOnly = joi.object(pageQuery);
