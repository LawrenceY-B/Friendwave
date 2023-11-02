"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const endpoints_config_1 = require("./environments/endpoints.config");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
app.all("*", (req, res) => {
    res.status(404).json({ message: "Page Not Found" });
});
app.use(express_1.default.json());
app.listen(endpoints_config_1.environment.PORT, () => {
    console.log(`🚀🚀🚀Server is running on port ${process.env.PORT}`);
});
