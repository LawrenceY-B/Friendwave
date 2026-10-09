import { NextFunction, Request, Response } from "express";
import User, { USERNAME_COLLATION } from "../models/user.model";
import Following from "../models/following.model";
import {
  validateBio,
  validateFollow,
  validateProfile,
  validateRemoveFollower,
  validateSearch,
  validateUserID,
} from "../services/user.service";
import Follower from "../models/follower.model";
import { deleteImages, uploadImage } from "../lib/s3";
import { escapeRegex } from "../lib/validation";
import Logger from "../lib/logger";

// Fields of another user that are safe to show publicly
const PUBLIC_USER_FIELDS = "Username ProfileUrl UserID";

export const newFollow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateFollow(req.body);
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
    if (!(await User.exists({ _id: FollowingID }))) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const existingfollow = await Following.findOne({
      userID: UserID,
      followingID: FollowingID,
    });
    if (existingfollow) {
      return res
        .status(400)
        .json({ success: false, message: "User has already been added" });
    }

    await Following.create({ userID: UserID, followingID: FollowingID });
    await Follower.create({ userID: FollowingID, followerID: UserID });
    // $addToSet only adds the id if it isn't already in the array
    await User.updateOne({ _id: UserID }, { $addToSet: { Followings: FollowingID } });
    await User.updateOne({ _id: FollowingID }, { $addToSet: { Followers: UserID } });

    res.status(200).json({ success: true, message: "Following" });
  } catch (error) {
    next(error);
  }
};

export const unFollow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateFollow(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    const { FollowingID } = req.body;
    const UserID = req.user.userID;

    const following = await Following.findOneAndDelete({
      userID: UserID,
      followingID: FollowingID,
    });
    if (!following) {
      return res
        .status(404)
        .json({ success: false, message: "User not in following list." });
    }

    await Follower.deleteOne({ userID: FollowingID, followerID: UserID });
    await User.updateOne({ _id: UserID }, { $pull: { Followings: FollowingID } });
    await User.updateOne({ _id: FollowingID }, { $pull: { Followers: UserID } });

    res.status(200).json({ success: true, message: "Not Following" });
  } catch (error) {
    next(error);
  }
};

export const getFollowing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const following = await Following.find({
      userID: req.user.userID,
    })
      .populate({ path: "followingID", select: PUBLIC_USER_FIELDS })
      .select("-_id -__v");
    res.status(200).json({ success: true, following: following });
  } catch (err: any) {
    next(err);
  }
};

export const getFollowers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const followers = await Follower.find({
      userID: req.user.userID,
    })
      .populate({ path: "followerID", select: PUBLIC_USER_FIELDS })
      .select("-_id -__v");
    res.status(200).json({ success: true, followers: followers });
  } catch (err: any) {
    next(err);
  }
};
export const removeFollow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateRemoveFollower(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    const { FollowerID } = req.body;
    const UserID = req.user.userID;
    const follower = await Follower.findOneAndDelete({
      userID: UserID,
      followerID: FollowerID,
    });
    if (!follower) {
      return res
        .status(404)
        .json({ success: false, message: "User not in followers list." });
    }

    await Following.deleteOne({ followingID: UserID, userID: FollowerID });
    await User.updateOne({ _id: UserID }, { $pull: { Followers: FollowerID } });
    await User.updateOne({ _id: FollowerID }, { $pull: { Followings: UserID } });

    res.status(200).json({ success: true, message: "Removed." });
  } catch (error) {
    next(error);
  }
};

export const AddBio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const UserID = req.user.userID;
    const { error } = validateBio(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { Bio } = req.body;
    // No `upsert`: that would create a half-empty user if the id didn't exist.
    // findByIdAndUpdate already saves, so no extra save() is needed.
    const user = await User.findByIdAndUpdate(UserID, { Bio: Bio });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(200).json({ success: true, message: "Bio Updated" });
  } catch (error) {
    next(error);
  }
};

export const deleteBio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const UserID = req.user.userID;
    const user = await User.findByIdAndUpdate(UserID, { Bio: "" });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(200).json({ success: true, message: "Bio Deleted" });
  } catch (error) {
    next(error);
  }
};

// Your own profile includes your email; someone else's doesn't
const findProfile = (userID: string, isOwnProfile: boolean) =>
  User.find({ UserID: userID })
    .select(isOwnProfile ? "-_id -__v -EmailVerified" : "-_id -__v -EmailVerified -Email -Auth0ID")
    .populate({ path: "Posts", select: "-__v -userId" });

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userData = await findProfile(req.user.userID, true);
    // Check BEFORE responding: you can only send one response per request
    if (userData.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, userData: userData });
  } catch (error) {
    next(error);
  }
};

export const editProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateProfile(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const { Name, Username, Bio } = req.body;
    const image = req.file;
    const UserID = req.user.userID;

    // Check before uploading anything. Excluding yourself lets you change
    // the capitalisation of your own username.
    if (Username !== undefined) {
      const taken = await User.exists({ Username, _id: { $ne: UserID } }).collation(USERNAME_COLLATION);
      if (taken) {
        return res.status(409).json({ success: false, message: "Username already taken" });
      }
    }

    // Only change the fields that were actually sent
    const update: Record<string, string> = {};
    if (Name !== undefined) update.Name = Name;
    if (Username !== undefined) update.Username = Username;
    if (Bio !== undefined) update.Bio = Bio;
    if (image) update.ProfileUrl = await uploadImage(image, "profile", UserID);

    // Returns the document as it was BEFORE the update
    const before = await User.findByIdAndUpdate(UserID, update);
    if (!before) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (image) {
      // Remove the old picture from S3 (skipped automatically for Auth0 URLs)
      const oldPicture = before.get("ProfileUrl", null, { getters: false });
      deleteImages([oldPicture]).catch((err) => Logger.error(err));
    }
    res.status(200).json({ success: true, message: "Profile Updated" });
  } catch (error) {
    next(error);
  }
};

export const getotherUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateUserID(req.query);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const userData = await findProfile(req.query.userID as string, req.query.userID === req.user.userID);
    if (userData.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, userData: userData });
  } catch (error) {
    next(error);
  }
};

export const searchUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error } = validateSearch(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    // Escape the input so characters like ".*(" are matched literally
    const text = new RegExp(escapeRegex(req.body.username), "i");

    const user = await User.find({
      $or: [{ Username: text }, { Name: text }],
    })
      .select("-_id -__v -EmailVerified -Email -Auth0ID -Posts -SavedPosts -Followers -Followings -Stories")
      .limit(20);
    res.status(200).json({ success: true, message: "User found", user: user });
  } catch (error) {
    next(error);
  }
};
