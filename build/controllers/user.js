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
exports.editProfile = exports.getUser = exports.deleteBio = exports.AddBio = exports.removeFollow = exports.getFollowers = exports.getFollowing = exports.unFollow = exports.newFollow = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const following_model_1 = __importDefault(require("../models/following.model"));
const user_service_1 = require("../services/user.service");
const follower_model_1 = __importDefault(require("../models/follower.model"));
const newFollow = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { error } = (0, user_service_1.validateFollow)(req.body);
        if (error) {
            return res
                .status(400)
                .json({ success: false, message: error.details[0].message });
        }
        const { FollowingID } = req.body;
        const UserID = req.user.userID;
        if (UserID === FollowingID) {
            return res
                .status(400)
                .json({ success: false, message: "Can't follow self" });
        }
        const existingfollow = yield following_model_1.default.findOne({
            userID: UserID,
            followingID: FollowingID,
        });
        if (!existingfollow) {
            //follow the new user
            const following = new following_model_1.default({
                userID: UserID,
                followingID: FollowingID,
            });
            yield following.save();
            //move following to the users model
            const addFollowing = yield user_model_1.default.findById(UserID);
            addFollowing === null || addFollowing === void 0 ? void 0 : addFollowing.Followings.push(following.followingID);
            yield addFollowing.save();
            //update the other individuals followers list with MongoID
            try {
                const followers = yield follower_model_1.default.findOneAndUpdate({
                    userID: FollowingID,
                    followerID: UserID,
                }, { userID: FollowingID, followerID: UserID }, { new: true, upsert: true });
                const addFollowers = yield user_model_1.default.findById(FollowingID);
                addFollowers === null || addFollowers === void 0 ? void 0 : addFollowers.Followers.push(followers === null || followers === void 0 ? void 0 : followers.followerID);
                yield addFollowers.save();
            }
            catch (error) {
                next(error);
            }
            res.status(200).json({ success: true, message: "Following" });
        }
        else {
            res
                .status(400)
                .json({ success: false, message: "User has already been added" });
        }
    }
    catch (error) {
        next(error);
    }
});
exports.newFollow = newFollow;
const unFollow = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { error } = (0, user_service_1.validateFollow)(req.body);
        if (error) {
            return res
                .status(400)
                .json({ success: false, message: error.details[0].message });
        }
        const { FollowingID } = req.body;
        const UserID = req.user.userID;
        // Remove the following from the user's model
        const following = yield following_model_1.default.findOneAndDelete({
            userID: UserID,
            followingID: FollowingID,
        });
        if (!following) {
            return res
                .status(404)
                .json({ success: false, message: "User not in following list." });
        }
        const userData = following.userID;
        const user = yield user_model_1.default.findById(userData);
        if (!user) {
            return res
                .status(404)
                .json({ success: false, message: "Couldn't find user" });
        }
        user.Followings = user.Followings.filter((followingId) => followingId !== FollowingID);
        yield user.save();
        // Remove the follower from the user's model
        try {
            const followers = yield follower_model_1.default.findOneAndDelete({
                userID: FollowingID,
                followerID: UserID,
            });
            if (followers) {
                const userId = followers.userID;
                const user = yield user_model_1.default.findById(userId);
                if (user) {
                    user.Followers = user.Followers.filter((followerId) => followerId !== UserID);
                    yield user.save();
                }
            }
        }
        catch (error) {
            next(error);
        }
        res.status(200).json({ success: true, message: "Not Following" });
    }
    catch (error) {
        next(error);
    }
});
exports.unFollow = unFollow;
const getFollowing = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const following = yield following_model_1.default.find({
            userID: req.user.userID,
        })
            .populate({
            path: "followingID",
            options: {
                select: "-EmailVerified",
                sort: { name: -1 },
                strictPopulate: false,
            },
        })
            .select("-_id -__v");
        res.status(200).json({ success: true, following: following });
    }
    catch (err) {
        next(err);
    }
});
exports.getFollowing = getFollowing;
const getFollowers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const followers = yield follower_model_1.default.find({
            userID: req.user.userID,
        })
            .populate({
            path: "followerID",
            options: {
                select: "-EmailVerified",
                sort: { name: -1 },
                strictPopulate: false,
            },
        })
            .select("-_id -__v");
        res.status(200).json({ success: true, followers: followers });
    }
    catch (err) {
        next(err);
    }
});
exports.getFollowers = getFollowers;
const removeFollow = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { FollowerID } = req.body;
        const UserID = req.user.userID;
        const follower = yield follower_model_1.default.findOneAndDelete({
            userID: UserID,
            followerID: FollowerID,
        });
        if (!follower)
            res
                .status(404)
                .json({ success: false, message: "User not in followers list." });
        try {
            const following = yield following_model_1.default.findOneAndDelete({
                followingID: UserID,
                userID: FollowerID,
            });
        }
        catch (err) {
            next(err);
        }
        res.status(200).json({ success: true, message: "Removed." });
    }
    catch (error) {
        next(error);
    }
});
exports.removeFollow = removeFollow;
//find a way to update the id field
const AddBio = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const UserID = req.user.userID;
        const { error } = (0, user_service_1.validateBio)(req.body);
        if (error)
            res.status(400).json({ success: false, message: error.message });
        const { Bio } = req.body;
        const user = yield user_model_1.default.findByIdAndUpdate(UserID, { Bio: Bio }, { new: true, upsert: true });
        if (!user)
            res.status(404).json({ success: false, message: "User not found." });
        user.save();
        res.status(200).json({ success: true, message: "Bio Updated" });
    }
    catch (error) {
        next(error);
    }
});
exports.AddBio = AddBio;
const deleteBio = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const UserID = req.user.userID;
        const user = yield user_model_1.default.findOneAndUpdate({ UserID: UserID }, { Bio: "" }, { new: true, upsert: true });
        if (!user)
            res.status(404).json({ success: false, message: "User not found." });
        user.save();
        res.status(200).json({ success: true, message: "Bio Deleted" });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteBio = deleteBio;
const getUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const UserID = req.user.userID;
        const userData = yield user_model_1.default.find({ UserID: UserID })
            .select("-_id -__v -EmailVerified")
            .populate({
            path: "Posts",
            options: {
                select: "-__v -EmailVerified -userId",
                sort: { name: -1 },
                strictPopulate: false,
            },
        });
        res.status(200).json({ success: true, userData: userData });
        if (!userData)
            res.status(404).json({ success: false, message: "User not found" });
    }
    catch (error) {
        next(error);
    }
});
exports.getUser = getUser;
const editProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { Name, Username, Bio } = req.body;
        const image = req.file;
        const UserID = req.user.userID;
        const { error } = (0, user_service_1.validateProfile)(req.body);
        if (error)
            res.status(400).json({ success: false, message: error.message });
        let ImgUrl;
        if (image) {
            const link = yield (0, user_service_1.ImageUpload)(image, next, UserID);
            ImgUrl = link;
        }
        const user = yield user_model_1.default.findByIdAndUpdate(UserID, { Name: Name, Username: Username, Bio: Bio, ProfileUrl: ImgUrl }, { new: true, upsert: true });
        if (!user)
            res.status(404).json({ success: false, message: "User not found" });
        user.save();
        res.status(200).json({ success: true, message: "Profile Updated" });
    }
    catch (error) {
        next(error);
    }
});
exports.editProfile = editProfile;
