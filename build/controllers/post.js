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
exports.unlike = exports.addLikes = exports.deletePost = exports.newPost = void 0;
const post_model_1 = __importDefault(require("../models/post.model"));
const post_service_1 = require("../services/post.service");
const user_model_1 = __importDefault(require("../models/user.model"));
const newPost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.userID;
        const { error } = (0, post_service_1.validatePost)(req.body);
        const { caption } = req.body;
        const images = req.files;
        const imageUrls = yield (0, post_service_1.ImageUpload)(images, next, userId);
        const post = new post_model_1.default({
            userId: userId,
            imageUrl: imageUrls,
            caption: caption,
            likes: [],
            comments: [],
            dateTime: Date.now(),
        });
        yield post.save();
        const updatedPost = yield post_model_1.default.findOneAndUpdate({ _id: post._id }, { $set: { postId: post._id } }, { new: true });
        // console.log(updatedPost);
        const updateUser = yield user_model_1.default.findById(userId);
        updateUser === null || updateUser === void 0 ? void 0 : updateUser.Posts.push(updatedPost === null || updatedPost === void 0 ? void 0 : updatedPost.postId);
        updateUser === null || updateUser === void 0 ? void 0 : updateUser.save();
        return res
            .status(200)
            .json({ success: true, message: "Post created successfully", post });
    }
    catch (error) {
        next(error);
    }
});
exports.newPost = newPost;
const deletePost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.userID;
        const { error } = (0, post_service_1.validatePostID)(req.body);
        if (error) {
            res.status(400).json({ success: false, message: error.message });
        }
        const { postID } = req.body;
        const post = yield post_model_1.default.findById(postID);
        if (!post)
            return res
                .status(404)
                .json({ success: false, message: "Post not found" });
        const deletePost = yield post_model_1.default.findOneAndDelete({
            postId: postID,
            userId: userId,
        });
        if (deletePost) {
            const deletedpostID = deletePost.postId;
            const user = yield user_model_1.default.findById(userId);
            if (user) {
                user.Posts = user.Posts.filter((postId) => postId.toString() !== deletedpostID.toString());
                yield user.save();
            }
        }
        return res
            .status(200)
            .json({ success: true, message: "Post deleted successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.deletePost = deletePost;
const addLikes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userID = req.user.userID;
        const { PostID } = req.body;
        const isExisting = yield post_model_1.default.findOne({ postId: PostID });
        if (!isExisting) {
            res.status(404).json({ success: false, message: "Post not found" });
        }
        if (isExisting) {
            if (isExisting.likes.includes(userID)) {
                return res.status(400).json({
                    success: false,
                    message: "You have already liked this post",
                });
            }
            isExisting === null || isExisting === void 0 ? void 0 : isExisting.likes.push(userID);
            isExisting === null || isExisting === void 0 ? void 0 : isExisting.save();
        }
        res.status(200).json({ success: true, message: `Successfully added` });
    }
    catch (error) {
        next(error);
    }
});
exports.addLikes = addLikes;
const unlike = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userID = req.user.userID;
        const { PostID } = req.body;
        const isExisting = yield post_model_1.default.findOne({ postId: PostID });
        console.log(userID);
        if (!isExisting) {
            return res
                .status(404)
                .json({ success: false, message: "Post not found" });
        }
        if (!isExisting.likes.includes(userID)) {
            return res.status(400).json({
                success: false,
                message: "You have not liked this post",
            });
        }
        console.log("isExisting.likes:", isExisting.likes);
        console.log("userID:", userID);
        const updatedLikes = isExisting.likes.filter((like) => like != userID);
        console.log("updatedLikes:", updatedLikes);
        console.log(updatedLikes);
        isExisting.likes = updatedLikes;
        yield isExisting.save();
        res.status(200).json({ success: true, message: `Successfully unliked` });
    }
    catch (error) {
        next(error);
    }
});
exports.unlike = unlike;
// if (user){
//     const index = user.Posts.indexOf(postId);
//     user.Posts.splice(index,1);
//     user.save();
// }
