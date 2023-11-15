"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const endpoints_config_1 = require("./environments/endpoints.config");
const db_1 = require("./database/db");
const express_openid_connect_1 = require("express-openid-connect");
const errorhandler_1 = __importDefault(require("./middleware/errorhandler"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const post_routes_1 = __importDefault(require("./routes/post.routes"));
const app = (0, express_1.default)();
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: `${endpoints_config_1.environment.AUTH0SECRET}`,
    baseURL: `${endpoints_config_1.environment.AUTH0BASEURL}`,
    clientID: `${endpoints_config_1.environment.AUTH0CLIENTID}`,
    issuerBaseURL: `${endpoints_config_1.environment.ISSUERBASEURL}`,
};
app
    .use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
})
    .use(express_1.default.json())
    .use((0, express_openid_connect_1.auth)(config))
    .use("/api", auth_routes_1.default)
    .use("/api/users", user_routes_1.default)
    .use("/api/posts", post_routes_1.default);
// auth router attaches /login, /logout, and /callback routes to the baseURL
app.get("/", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.status(200).send(req.oidc.isAuthenticated());
    }
    catch (error) {
        next(error);
    }
}));
app.all("*", (req, res) => {
    res.status(404).json({ message: "Page Not Found 😔" });
});
app.use(errorhandler_1.default);
const server = app.listen(endpoints_config_1.environment.PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.DB_Connection)();
    console.log(`🚀🚀🚀Server is running on port ${process.env.PORT}`);
}));
