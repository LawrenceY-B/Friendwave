"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const SavedPostSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Posts", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
});
const SavedPost = (0, mongoose_1.model)("SavedPosts", SavedPostSchema);
exports.default = SavedPost;
