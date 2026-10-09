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

export const environment = {
  PORT: Number(process.env.PORT) || 3000,
  DBUrl: required("MONGODBURL"),
  PROD_ENV,
  isDevelopment: PROD_ENV.toLowerCase() === "development",
  AUTH0SECRET: required("AUTH0SECRET"),
  AUTH0BASEURL: required("AUTH0BASEURL"),
  AUTH0CLIENTID: required("AUTH0CLIENTID"),
  ISSUERBASEURL: required("ISSUERBASEURL"),
  JWTKEY: required("JWTKEY"),
  AWS_ACCESS_KEY: required("AWS_ACCESS_KEY"),
  AWS_SECRET_ACCESS_KEY: required("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: process.env.AWS_REGION || "eu-west-2",
  AWS_BUCKET: process.env.AWS_BUCKET || "fwstorage-trial",
  // Origin allowed to call the API / socket from a browser, e.g. https://friendwave.app
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "*",
};
