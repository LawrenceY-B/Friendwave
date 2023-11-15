"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const FollowingSchema = new mongoose_1.Schema({
    userID: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    followingID: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true }
});
const Following = (0, mongoose_1.model)("Following", FollowingSchema);
exports.default = Following;
