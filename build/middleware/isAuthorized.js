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
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const endpoints_config_1 = require("../environments/endpoints.config");
const verifyToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const Authorization = req.get("Authorization");
    ;
    if (!Authorization || !Authorization.startsWith("Bearer ")) {
        res.status(401).json({ message: "Invalid Authorization header" });
    }
    const token = Authorization.split(" ")[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, endpoints_config_1.environment.JWTKEY || "");
        if (!payload)
            res.status(401).json({ message: "Invalid access token" });
        // check expiry
        if (payload.exp < Date.now() / 1000) {
            res.status(401).json({ message: "Token has expired" });
        }
        req.user = payload;
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.verifyToken = verifyToken;
