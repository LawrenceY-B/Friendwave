// Test harness: the real app, in-process, with
//   - an in-memory MongoDB (mongodb-memory-server)
//   - a fake Auth0 (serves its public keys and /userinfo), so tests can mint real RS256 tokens
//   - a fake S3 (storage functions swapped out)
// Nothing touches the network, your database or your Auth0 tenant.
import http from "http";
import { AddressInfo } from "net";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as jose from "jose";
import { io as ioClient, Socket } from "socket.io-client";

const AUDIENCE = "https://api.friendwave.test";

export interface Profile {
  name?: string;
  nickname?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

export const startTestServer = async () => {
  // ---- fake Auth0 ----
  const key = await jose.generateKeyPair("RS256");
  const otherKey = await jose.generateKeyPair("RS256");
  const jwks = { keys: [{ ...(await jose.exportJWK(key.publicKey)), kid: "test", alg: "RS256", use: "sig" }] };
  const profiles = new Map<string, Profile>();
  let userinfoCalls = 0;
  const auth0Deleted: string[] = []; // Auth0 users deleted through the (fake) Management API
  const auth0 = http.createServer((req, res) => {
    if (req.url === "/.well-known/jwks.json") return res.end(JSON.stringify(jwks));
    if (req.url === "/oauth/token" && req.method === "POST") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ access_token: "mgmt-token", token_type: "Bearer" }));
    }
    if (req.url?.startsWith("/api/v2/users/") && req.method === "DELETE") {
      auth0Deleted.push(decodeURIComponent(req.url.slice("/api/v2/users/".length)));
      res.statusCode = 204;
      return res.end();
    }
    if (req.url === "/userinfo") {
      userinfoCalls++;
      const { sub } = jose.decodeJwt((req.headers.authorization ?? "").slice(7));
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ sub, ...profiles.get(String(sub)) }));
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => auth0.listen(0, resolve));
  const issuer = `http://localhost:${(auth0.address() as AddressInfo).port}/`;

  // ---- database + environment (must be set before the app is imported) ----
  const mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODBURL: mongo.getUri("friendwave-test"),
    ISSUERBASEURL: issuer,
    AUTH0_AUDIENCE: AUDIENCE,
    AWS_ACCESS_KEY: "test",
    AWS_SECRET_ACCESS_KEY: "test",
    PROD_ENV: "Test",
    RATE_LIMIT_PER_MINUTE: "100000",
    API_URL: "http://api.test",
    // Never pick these up from a developer's .env (tests switch them on where needed)
    AUTH0_ALLOWED_CLIENTS: "",
    AUTH0_MGMT_CLIENT_ID: "",
    AUTH0_MGMT_CLIENT_SECRET: "",
  });

  const { default: Logger } = await import("../src/lib/logger");
  Logger.silent = true;
  const { storage } = await import("../src/lib/s3");
  let uploads = 0;
  storage.uploadImage = async (file, folder, userId) => `${folder}/${userId}/fake-${++uploads}.${file.mimetype.split("/")[1]}`;
  const deletedKeys: string[] = [];
  storage.deleteImages = async (keys) => void deletedKeys.push(...keys);
  storage.signedUrl = async (key) => `https://fake-s3.test/${key}?X-Amz-Signature=x`;

  const mongoose = (await import("mongoose")).default;
  await mongoose.connect(process.env.MONGODBURL!);
  const { createAppServer } = await import("../src/app");
  const { httpServer, io } = createAppServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const base = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  // Build indexes now, so unique-index behaviour is in place before tests run
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  type SignOptions = { aud?: string; iss?: string; exp?: string | number; useOtherKey?: boolean; azp?: string };
  const sign = (sub: string, opts: SignOptions = {}) =>
    new jose.SignJWT({ scope: "openid profile email", azp: opts.azp ?? "web-app" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject(sub)
      .setIssuer(opts.iss ?? issuer)
      .setAudience(opts.aud ?? [AUDIENCE, `${issuer}userinfo`])
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "1h")
      .sign(opts.useOtherKey ? otherKey.privateKey : key.privateKey);

  // Raw request; returns status + parsed JSON
  const request = async (method: string, path: string, token?: string, body?: unknown) => {
    const isForm = body instanceof FormData;
    const res = await fetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
      },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json, headers: res.headers };
  };

  // A logged-in test user. The first request creates their account.
  const login = async (sub: string, profile: Profile = {}) => {
    profiles.set(sub, profile);
    const token = await sign(sub);
    const me = await request("GET", "/api/users/me", token);
    return {
      token,
      id: me.body?.data?.id as string,
      get: (path: string) => request("GET", path, token),
      post: (path: string, body?: unknown) => request("POST", path, token, body),
      patch: (path: string, body?: unknown) => request("PATCH", path, token, body),
      del: (path: string) => request("DELETE", path, token),
    };
  };

  const sockets: Socket[] = [];
  const connectSocket = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = ioClient(base, { auth: { token }, reconnection: false, transports: ["websocket"] });
      sockets.push(socket);
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", reject);
    });

  const stop = async () => {
    sockets.forEach((socket) => socket.close());
    await new Promise((resolve) => io.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    auth0.close();
  };

  return {
    base, request, login, sign, connectSocket, stop, mongoose,
    profiles, userinfoCalls: () => userinfoCalls, deletedKeys, auth0Deleted,
  };
};

export type TestServer = Awaited<ReturnType<typeof startTestServer>>;

// Waits for one socket event (or fails after `ms`)
export const nextEvent = <T = any>(socket: Socket, event: string, ms = 2000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

export const imageForm = (count = 1, fields: Record<string, string> = {}, type = "image/png") => {
  const form = new FormData();
  for (let i = 0; i < count; i++) form.append("images", new Blob(["fake image"], { type }), `photo${i}.png`);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
};
