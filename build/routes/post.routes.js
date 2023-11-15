"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const isAuthorized_1 = require("../middleware/isAuthorized");
const post_1 = require("../controllers/post");
const PostRoutes = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
const PostUpload = upload.array('images', 10);
PostRoutes.post('/newpost', PostUpload, isAuthorized_1.verifyToken, post_1.newPost);
PostRoutes.post('/deletepost', isAuthorized_1.verifyToken, post_1.deletePost);
PostRoutes.post('/likepost', isAuthorized_1.verifyToken, post_1.addLikes);
PostRoutes.post('/unlikepost', isAuthorized_1.verifyToken, post_1.unlike);
exports.default = PostRoutes;
