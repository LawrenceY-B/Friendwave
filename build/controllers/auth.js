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
exports.Logout = exports.Login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const endpoints_config_1 = require("../environments/endpoints.config");
const Login = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield user_model_1.default.findOne({ Auth0ID: req.oidc.user.sub });
        if (!user) {
            const result = yield user_model_1.default.create({
                Auth0ID: req.oidc.user.sub,
                Name: req.oidc.user.name,
                Username: req.oidc.user.nickname,
                Email: req.oidc.user.email,
                EmailVerified: req.oidc.user.email_verified,
                ProfileUrl: req.oidc.user.picture,
            });
            if (result) {
                const token = jsonwebtoken_1.default.sign({
                    Auth0id: req.oidc.user.sub,
                    userID: result === null || result === void 0 ? void 0 : result._id,
                    userMail: req.oidc.user.email,
                }, `${endpoints_config_1.environment.JWTKEY}`, {
                    expiresIn: "7d",
                });
                const addID = yield user_model_1.default.findByIdAndUpdate(result === null || result === void 0 ? void 0 : result._id, { UserID: result === null || result === void 0 ? void 0 : result._id });
                res
                    .status(200)
                    .json({ message: "User created successfully", token: token, userID: result === null || result === void 0 ? void 0 : result._id });
            }
            else {
                res.status(404).json({ message: "User not found" });
            }
        }
        else {
            const token = jsonwebtoken_1.default.sign({
                Auth0id: req.oidc.user.sub,
                userID: user === null || user === void 0 ? void 0 : user._id,
                userMail: req.oidc.user.email,
            }, `${endpoints_config_1.environment.JWTKEY}`, {
                expiresIn: "7d",
            });
            res
                .status(200)
                .json({ message: "Login Successful ✅✅✅", token: token, userID: user === null || user === void 0 ? void 0 : user._id });
        }
    }
    catch (error) {
        next(error);
    }
});
exports.Login = Login;
const Logout = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const payload = {
            // sub: req.user.userID,
            iat: Date.now() / 1000,
            exp: 0,
        };
        const newToken = jsonwebtoken_1.default.sign(payload, `${endpoints_config_1.environment.JWTKEY}`);
        res.oidc.logout();
        // Respond with a success message and the new token
        return res.status(200).json({ message: "Logged out", token: newToken });
    }
    catch (error) {
        next(error);
    }
});
exports.Logout = Logout;
