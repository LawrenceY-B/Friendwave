"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const isAuthorized_1 = require("../middleware/isAuthorized");
const user_1 = require("../controllers/user");
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
const UserRoutes = (0, express_1.Router)();
UserRoutes.post('/addFollowing', isAuthorized_1.verifyToken, user_1.newFollow);
UserRoutes.post('/unfollow', isAuthorized_1.verifyToken, user_1.unFollow);
UserRoutes.get('/getFollowing', isAuthorized_1.verifyToken, user_1.getFollowing);
UserRoutes.get('/getFollowers', isAuthorized_1.verifyToken, user_1.getFollowers);
UserRoutes.get('/getUser', isAuthorized_1.verifyToken, user_1.getUser);
UserRoutes.post('/removeFollower', isAuthorized_1.verifyToken, user_1.removeFollow);
UserRoutes.post('/addBio', isAuthorized_1.verifyToken, user_1.AddBio);
UserRoutes.delete('/deleteBio', isAuthorized_1.verifyToken, user_1.deleteBio);
UserRoutes.post('/editprofile', upload.single('images'), isAuthorized_1.verifyToken, user_1.editProfile);
//  UserRoutes.get('/register', verifyToken)
exports.default = UserRoutes;
