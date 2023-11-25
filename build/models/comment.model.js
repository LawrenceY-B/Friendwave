"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const CommentSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Post", required: true },
    replies: [{ type: String }],
    comment: { type: String, required: true },
    dateTime: { type: Date, required: true },
});
const Comment = (0, mongoose_1.model)("Comment", CommentSchema);
exports.default = Comment;
