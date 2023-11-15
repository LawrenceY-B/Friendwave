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
exports.DB_Connection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const endpoints_config_1 = require("../environments/endpoints.config");
const DB_Connection = () => __awaiter(void 0, void 0, void 0, function* () {
    mongoose_1.default
        .connect(`${endpoints_config_1.environment.DBUrl}`, {})
        .then(() => {
        console.log("MongoDB connected!!");
    })
        .catch((err) => {
        console.log("Failed to connect to MongoDB", err);
    });
});
exports.DB_Connection = DB_Connection;
