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
exports.deleteComment = exports.getAllComments = exports.createComment = exports.RemoveFromSaved = exports.AddtoSaved = exports.unlike = exports.addLikes = exports.deletePost = exports.newPost = void 0;
const post_model_1 = __importDefault(require("../models/post.model"));
const post_service_1 = require("../services/post.service");
const user_model_1 = __importDefault(require("../models/user.model"));
const savedpost_model_1 = __importDefault(require("../models/savedpost.model"));
const comment_model_1 = __importDefault(require("../models/comment.model"));
const newPost = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.userID;
        const { error } = (0, post_service_1.validatePost)(req.body);
        if (error) {
            res.status(400).json({ success: false, message: error.message });
        }
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
            saved: false,
        });
        yield post.save();
        const updatedPost = yield post_model_1.default.findOneAndUpdate({ _id: post._id }, { $set: { postId: post._id } }, { new: true });
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
        const { error } = (0, post_service_1.validatePostID)(req.body);
        if (error) {
            res.status(400).json({ success: false, message: error.message });
        }
        const { postID } = req.body;
        const isExisting = yield post_model_1.default.findOne({ postId: postID });
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
        const { error } = (0, post_service_1.validatePostID)(req.body);
        if (error) {
            res.status(400).json({ success: false, message: error.message });
        }
        const { postID } = req.body;
        const isExisting = yield post_model_1.default.findOne({ postId: postID });
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
        const updatedLikes = isExisting.likes.filter((like) => like != userID);
        isExisting.likes = updatedLikes;
        yield isExisting.save();
        res.status(200).json({ success: true, message: `Successfully unliked` });
    }
    catch (error) {
        next(error);
    }
});
exports.unlike = unlike;
const AddtoSaved = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userID = req.user.userID;
        const { error } = (0, post_service_1.validatePostID)(req.body);
        if (error) {
            res.status(400).json({ success: false, message: error.message });
        }
        const { postID } = req.body;
        const isSaved = yield savedpost_model_1.default.findOne({ postId: postID, userId: userID });
        if (!isSaved) {
            const savedPost = new savedpost_model_1.default({
                postId: postID,
                userId: userID,
            });
            yield savedPost.save();
            // const filter = { postId: postID, userId: userID };
            // const update = { saved: true };
            // const result = await Post.findByIdAndUpdate(
            //   postID , { $set: { saved:true }}
            // );
            const user = yield user_model_1.default.findOne({ UserID: userID });
            if (user) {
                user.SavedPosts.push(savedPost._id);
                yield user.save();
            }
            res
                .status(200)
                .json({ success: true, message: "Post saved successfully" });
        }
    }
    catch (error) {
        next(error);
    }
});
exports.AddtoSaved = AddtoSaved;
const RemoveFromSaved = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userID = req.user.userID;
        const { error } = (0, post_service_1.validatePostID)(req.body);
        if (error) {
            res.status(400).json({ success: false, message: error.message });
        }
        const { postID } = req.body;
        const filter = { postId: postID, userId: userID };
        console.log(filter);
        const removeSaved = yield savedpost_model_1.default.findOneAndDelete({
            userId: userID,
            postId: postID,
        });
        console.log(removeSaved);
        if (!removeSaved) {
            res.status(404).json({ success: false, message: "Post not found" });
        }
        const user = yield user_model_1.default.findOne({ UserID: userID });
        if (user) {
            user.SavedPosts = user.SavedPosts.filter((post) => post.toString() !== (removeSaved === null || removeSaved === void 0 ? void 0 : removeSaved._id.toString()));
            yield user.save();
        }
        return res.status(200).json({
            status: true,
            message: "Post removed from saved",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.RemoveFromSaved = RemoveFromSaved;
// work on comments here 👇🏽👇🏽👇🏽👇🏽
const createComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user.userID;
        const { postID, message } = req.body;
        const { error } = (0, post_service_1.validateComment)(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        const isExisting = yield post_model_1.default.findOne({ postId: postID });
        if (!isExisting) {
            return res
                .status(404)
                .json({ success: false, message: "Post not found" });
        }
        const newComment = new comment_model_1.default({
            userId: user,
            postId: postID,
            comment: message,
            dateTime: Date.now(),
        });
        yield newComment.save();
        const updatedPost = yield post_model_1.default.findOneAndUpdate({ postId: postID }, { $push: { comments: newComment._id } }, { new: true });
        if (!updatedPost) {
            return res
                .status(404)
                .json({ success: false, message: "Something went wrong" });
        }
        res.status(200).json({
            success: true,
            message: "Comment created successfully",
            comment: newComment,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createComment = createComment;
const getAllComments = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { postID } = req.body;
        const { error } = (0, post_service_1.validatePostID)(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        const isExisting = yield post_model_1.default.findOne({ postId: postID });
        if (!isExisting) {
            return res
                .status(404)
                .json({ success: false, message: "Post not found" });
        }
        const comments = yield comment_model_1.default.find({ postId: postID })
            .select("-postId")
            .populate({
            path: "userId",
            options: {
                select: "Username ProfileUrl ",
                sort: { name: -1 },
                strictPopulate: false,
            },
        })
            .sort({ dateTime: -1 });
        res
            .status(200)
            .json({
            success: true,
            message: "Comments retrieved successfully",
            comments: comments,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllComments = getAllComments;
const deleteComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { error } = (0, post_service_1.validateCommentID)(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        const commentId = req.body;
        const comment = yield comment_model_1.default.findOneAndDelete({ _id: commentId });
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        res.status(200).json({ success: true, message: "Comment deleted successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteComment = deleteComment;
/*

1. create a comment model  ✅
2. data to save in comment model ✅
    - userId
    - postId
    - message
    - replies
    - dateTime
3. A new comment should be added to the comment model ✅
4. The comment id should be added to the post model ✅

i. Get all coments under a particular post ✅

I. Delete a comment


a. Get all replies under a particular comment



*/
// if (user){
//     const index = user.Posts.indexOf(postId);
//     user.Posts.splice(index,1);
//     user.save();
// }
