"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    UserID: { type: mongoose_1.Schema.Types.ObjectId },
    Auth0ID: { type: String, required: true },
    Name: { type: String, required: true },
    Username: { type: String, required: true },
    Email: { type: String, required: true },
    EmailVerified: { type: Boolean, },
    ProfileUrl: { type: String, required: true },
    Bio: { type: String },
    Followers: [{ type: String, ref: "Followers", }],
    Followings: [{ type: String, ref: "Following", }],
    Posts: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Posts", }],
    SavedPosts: { type: mongoose_1.Schema.Types.ObjectId, ref: "SavedPosts", },
});
const User = (0, mongoose_1.model)("User", UserSchema);
exports.default = User;
