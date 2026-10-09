import dotenv from "dotenv";
dotenv.config({ quiet: true });

// Crash at startup if a required variable is missing, instead of failing
// later with a confusing error (e.g. connecting to the literal string "undefined").
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const PROD_ENV = process.env.PROD_ENV || "Development";
const PORT = Number(process.env.PORT) || 3000;
// Auth0 puts a trailing slash in the token's `iss` claim, so normalise to that
const issuer = required("ISSUERBASEURL").replace(/\/?$/, "/");

export const environment = {
  PORT,
  DBUrl: required("MONGODBURL"),
  PROD_ENV,
  isDevelopment: PROD_ENV.toLowerCase() === "development",
  // Public URL of this API (used to build image links), e.g. https://friendwave.onrender.com
  API_URL: (process.env.API_URL || `http://localhost:${PORT}`).replace(/\/$/, ""),
  // Your Auth0 tenant, e.g. https://dev-xxxx.us.auth0.com/
  AUTH0_ISSUER: issuer,
  // The "Identifier" of the API you created in Auth0 (Applications → APIs)
  AUTH0_AUDIENCE: required("AUTH0_AUDIENCE"),
  AWS_ACCESS_KEY: required("AWS_ACCESS_KEY"),
  AWS_SECRET_ACCESS_KEY: required("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: process.env.AWS_REGION || "eu-west-2",
  AWS_BUCKET: process.env.AWS_BUCKET || "fwstorage-trial",
  // Origin allowed to call the API / socket from a browser, e.g. https://friendwave.app
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "*",
};
