"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const FollowerSchema = new mongoose_1.Schema({
    userID: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    followerID: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true }
});
const Follower = (0, mongoose_1.model)("Follower", FollowerSchema);
exports.default = Follower;
