// Builds the Postman collection from the API's own OpenAPI spec (src/docs/openapi.ts), so it
// never drifts from the code:
//
//   npm run postman          → docs/friendwave.postman_collection.json
//
// Import it in Postman (Import → the file; choose "Replace" to update an existing copy).
// Set the collection variables: `baseUrl` (http://localhost:4000 or the Render URL) and
// `token` (`npm run token`). Creating a post, chat, comment… saves its id for the next requests.
import fs from "fs";
import path from "path";
import { openapi } from "../src/docs/openapi.ts";

const OUT = path.join("docs", "friendwave.postman_collection.json");

// Which variable fills each path parameter, by the path it appears in
const idVariable = (apiPath, param) => {
  if (param === "replyId") return "replyId";
  if (param === "key") return "mediaKey";
  if (apiPath.startsWith("/api/posts/")) return "postId";
  if (apiPath.startsWith("/api/comments/")) return "commentId";
  if (apiPath.startsWith("/api/chats/")) return "chatId";
  if (apiPath.startsWith("/api/messages/")) return "messageId";
  if (apiPath.startsWith("/api/stories/")) return "storyId";
  if (apiPath.startsWith("/api/notifications/")) return "notificationId";
  return "userId";
};

// Requests that create something save its id, so the next requests just work
const SAVES = {
  "POST /api/posts": "postId",
  "POST /api/posts/{id}/comments": "commentId",
  "POST /api/comments/{id}/replies": "replyId",
  "POST /api/chats": "chatId",
  "POST /api/chats/{id}/messages": "messageId",
  "POST /api/stories": "storyId",
  "GET /api/users/me": "myId",
};

const resolve = (schema) => {
  if (schema?.$ref) return resolve(openapi.components.schemas[schema.$ref.split("/").pop()]);
  return schema ?? {};
};

// A small, readable example value for a JSON schema
function example(schema, name = "") {
  schema = resolve(schema);
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  if (schema.oneOf || schema.anyOf) return example((schema.oneOf ?? schema.anyOf)[0], name);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  switch (type) {
    case "object": {
      const props = schema.properties ?? {};
      const keys = Object.keys(props).filter((k) => (schema.required ?? Object.keys(props)).includes(k));
      return Object.fromEntries(keys.map((k) => [k, example(props[k], k)]));
    }
    case "array":
      return [example(schema.items, name)];
    case "integer":
    case "number":
      return schema.minimum ?? 1;
    case "boolean":
      return true;
    default:
      if (/userId$/i.test(name)) return "{{userId}}";
      if (/postId$/i.test(name)) return "{{postId}}";
      if (name === "text") return "Hello from Postman 👋";
      if (name === "caption") return "Posted from Postman";
      if (name === "username") return "postman_user";
      if (name === "name") return "Postman User";
      if (name === "bio") return "Testing the API";
      return name || "string";
  }
}

function body(requestBody) {
  if (!requestBody) return undefined;
  const content = requestBody.content ?? {};
  if (content["multipart/form-data"]) {
    const schema = resolve(content["multipart/form-data"].schema);
    const formdata = Object.entries(schema.properties ?? {}).map(([key, prop]) => {
      const p = resolve(prop);
      const binary = p.format === "binary" || resolve(p.items).format === "binary";
      return binary
        ? { key, type: "file", src: [], description: p.description ?? "Choose an image file" }
        : { key, type: "text", value: String(example(p, key)), disabled: !(schema.required ?? []).includes(key) };
    });
    return { mode: "formdata", formdata };
  }
  if (content["application/json"]) {
    return {
      mode: "raw",
      raw: JSON.stringify(example(content["application/json"].schema), null, 2),
      options: { raw: { language: "json" } },
    };
  }
  return undefined;
}

function request(apiPath, method, op) {
  const params = op.parameters ?? [];
  const pathParams = params.filter((p) => p.in === "path");
  const query = params
    .filter((p) => p.in === "query")
    .map((p) => ({
      key: p.name,
      value: p.name === "search" ? "al" : p.name === "limit" ? "20" : p.name === "cursor" ? "" : String(example(p.schema, p.name)),
      description: p.description ?? (p.required ? "Required" : "Optional"),
      disabled: !p.required,
    }));
  const postmanPath = apiPath.replace(/\{(\w+)\}/g, ":$1");
  const queryString = query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join("&");
  const key = `${method.toUpperCase()} ${apiPath}`;
  const saves = SAVES[key];
  const item = {
    name: op.summary,
    request: {
      method: method.toUpperCase(),
      header: [],
      url: {
        raw: `{{baseUrl}}${postmanPath}${queryString ? `?${queryString}` : ""}`,
        host: ["{{baseUrl}}"],
        path: postmanPath.split("/").filter(Boolean),
        ...(query.length ? { query } : {}),
        ...(pathParams.length
          ? { variable: pathParams.map((p) => ({ key: p.name, value: `{{${idVariable(apiPath, p.name)}}}` })) }
          : {}),
      },
      description: `${op.summary}\n\n\`${key}\``,
    },
  };
  const b = body(op.requestBody);
  if (b) item.request.body = b;
  // Public routes (health, images) don't need the token
  if (Array.isArray(op.security) && op.security.length === 0) item.request.auth = { type: "noauth" };
  if (saves)
    item.event = [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: [
            "const json = pm.response.json();",
            `if (json.success && json.data && json.data.id) pm.collectionVariables.set("${saves}", json.data.id);`,
            'pm.test("succeeds", () => pm.expect(json.success).to.eql(true));',
          ],
        },
      },
    ];
  return item;
}

// One folder per tag, in the order the spec first mentions them
const folders = new Map();
for (const [apiPath, methods] of Object.entries(openapi.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    const tag = op.tags?.[0] ?? "Other";
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag).push(request(apiPath, method, op));
  }
}

const variables = ["postId", "commentId", "replyId", "chatId", "messageId", "storyId", "userId", "myId", "mediaKey"];
const collection = {
  info: {
    name: openapi.info.title,
    description: `${openapi.info.description}\n\nGenerated from the API's OpenAPI spec by \`npm run postman\`. Set \`baseUrl\` and \`token\` in the collection variables. Creating things saves their ids for the next requests.`,
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000", description: "or https://friendwave-api.onrender.com" },
    { key: "token", value: "", description: "An Auth0 access token (npm run token)" },
    ...variables.map((key) => ({ key, value: "" })),
  ],
  item: [...folders].map(([name, item]) => ({ name, item })),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(collection, null, 2)}\n`);
const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Wrote ${OUT}: ${count} requests in ${collection.item.length} folders`);
