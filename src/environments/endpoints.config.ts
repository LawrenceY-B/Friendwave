import dotenv from "dotenv";
dotenv.config();
export const environment = {
  PORT: Number(process.env.PORT) || 3000,
  DBUrl: String(process.env.MONGODBURL),
  PROD_ENV: String(process.env.PROD_ENV),
  AUTH0SECRET: String(process.env.AUTH0SECRET),
  AUTH0BASEURL: String(process.env.AUTH0BASEURL),
  AUTH0CLIENTID: String(process.env.AUTH0CLIENTID),
  ISSUERBASEURL: String(process.env.ISSUERBASEURL),
  JWTKEY: String(process.env.JWTKEY),
  AWS_ACCESS_KEY: String(process.env.AWS_ACCESS_KEY),
AWS_SECRET_ACCESS_KEY: String(process.env.AWS_SECRET_ACCESS_KEY),
};
