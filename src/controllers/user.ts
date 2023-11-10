import { NextFunction, Request, Response } from "express";
import User from "../models/user.model";
import Following from "../models/following.model";
import {
  ImageUpload,
  validateBio,
  validateFollow,
  validateProfile,
} from "../services/user.service";
import Follower from "../models/follower.model";

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

    const existingfollow = await Following.findOne({
      userID: UserID,
      followingID: FollowingID,
    });
    if (!existingfollow) {
      //follow the new user
      const following = new Following({
        userID: UserID,
        followingID: FollowingID,
      });
      await following.save();
      //move following to the users model
      const addFollowing = await User.findById(UserID);
      addFollowing?.Followings.push(following.followingID);
      await addFollowing!.save();

      //update the other individuals followers list with MongoID
      try {
        const followers = await Follower.findOneAndUpdate(
          {
            userID: FollowingID,
            followerID: UserID,
          },
          { userID: FollowingID, followerID: UserID },
          { new: true, upsert: true }
        );
        const addFollowers = await User.findById(FollowingID);
        addFollowers?.Followers.push(followers?.followerID);
        await addFollowers!.save();
      } catch (error) {
        next(error);
      }

      res.status(200).json({ success: true, message: "Following" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "User has already been added" });
    }
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

    // Remove the following from the user's model
    const following = await Following.findOneAndDelete({
      userID: UserID,
      followingID: FollowingID,
    });

    if (!following) {
      return res
        .status(404)
        .json({ success: false, message: "User not in following list." });
    }

    const userData = following.userID;
    const user = await User.findById(userData);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Couldn't find user" });
    }

    user.Followings = user.Followings.filter(
      (followingId) => followingId !== FollowingID
    );
    await user.save();

    // Remove the follower from the user's model
    try {
      const followers = await Follower.findOneAndDelete({
        userID: FollowingID,
        followerID: UserID,
      });

      if (followers) {
        const userId = followers.userID;
        const user = await User.findById(userId);

        if (user) {
          user.Followers = user.Followers.filter(
            (followerId) => followerId !== UserID
          );
          await user.save();
        }
      }
    } catch (error) {
      next(error);
    }

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
      .populate({
        path: "followingID",
        options: {
          select: "-EmailVerified", // Exclude fields from the populated document
          sort: { name: -1 },
          strictPopulate: false,
        },
      })
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
      .populate({
        path: "followerID",
        options: {
          select: "-EmailVerified", // Exclude fields from the populated document
          sort: { name: -1 },
          strictPopulate: false,
        },
      })
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
    const { FollowerID } = req.body;
    const UserID = req.user.userID;
    const follower = await Follower.findOneAndDelete({
      userID: UserID,
      followerID: FollowerID,
    });
    if (!follower)
      res
        .status(404)
        .json({ success: false, message: "User not in followers list." });
    try {
      const following = await Following.findOneAndDelete({
        followingID: UserID,
        userID: FollowerID,
      });
    } catch (err) {
      next(err);
    }

    res.status(200).json({ success: true, message: "Removed." });
  } catch (error) {
    next(error);
  }
};
//find a way to update the id field
export const AddBio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const UserID = req.user.userID;
    const { error } = validateBio(req.body);
    if (error) res.status(400).json({ success: false, message: error.message });
    const { Bio } = req.body;
    const user = await User.findByIdAndUpdate(
      UserID,
      { Bio: Bio },
      { new: true, upsert: true }
    );
    if (!user)
      res.status(404).json({ success: false, message: "User not found." });
    user.save();
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
    const user = await User.findOneAndUpdate(
      { UserID: UserID },
      { Bio: "" },
      { new: true, upsert: true }
    );
    if (!user)
      res.status(404).json({ success: false, message: "User not found." });
    user.save();
    res.status(200).json({ success: true, message: "Bio Deleted" });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const UserID = req.user.userID;
    const userData = await User.findOne({ UserID: UserID }).select(
      "-_id -__v -EmailVerified"
    );
    res.status(200).json({ success: true, userData: userData });
    if (!userData)
      res.status(404).json({ success: false, message: "User not found" });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const editProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { Name, Username, Bio } = req.body;
    const image = req.file;
    const UserID = req.user.userID;

    const { error } = validateProfile(req.body);
    if (error) res.status(400).json({ success: false, message: error.message });

    let ImgUrl
    if(image){
      const link = await ImageUpload(image,next,UserID);
      ImgUrl = link
    }
    const user = await User.findByIdAndUpdate(
      UserID,
      { Name: Name, Username: Username, Bio: Bio, ProfileUrl:ImgUrl },
      { new: true, upsert: true }
    );
    if (!user)
      res.status(404).json({ success: false, message: "User not found" });
    user.save();
    res.status(200).json({ success: true, message: "Profile Updated"});
  } catch (error) {
    next(error);
  }
};
