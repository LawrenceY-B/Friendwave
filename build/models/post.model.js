"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const PostSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Schema.Types.ObjectId },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: [{ type: String }],
    caption: { type: String },
    likes: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Comment" }],
    dateTime: { type: Date },
    // saved:{type:Boolean}
});
const Post = (0, mongoose_1.model)("Posts", PostSchema);
exports.default = Post;
