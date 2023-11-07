import { NextFunction, Request, Response } from "express";
import User from "../models/user.model";
import Following from "../models/following.model";
import { validateBio, validateFollow } from "../services/user.service";
import Follower from "../models/follower.model";
import { Schema } from "mongoose";

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
    console.log(UserID, FollowingID);
    if (UserID === FollowingID) {
      return res
        .status(400)
        .json({ success: false, message: "Can't follow self" });
    }

    const following = await Following.findOne({
      userID: UserID,
      followingID: FollowingID,
    });
    if (!following) {
      //follow the new user
      const following = new Following({
        userID: UserID,
        followingID: FollowingID,
      });
      await following.save();

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
        // console.log(followers);
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
    // console.log(UserID, FollowingID);
    const following = await Following.findOneAndDelete({
      userID: UserID,
      followingID: FollowingID,
    });
    if (!following) {
      return res
        .status(404)
        .json({ success: false, message: "User not in following list." });
    }
    try {
      const followers = await Follower.findOneAndDelete({
        followerID: UserID,
        userID: FollowingID,
      });
      console.log(followers);
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
      res
        .status(404)
        .json({ success: false, message: "User not found." });
    user.save();
    res.status(200).json({ success: true, message: "Bio Updated" });
  } catch (error) {
    next(error);
  }
};

export const deleteBio = async (  req: Request,
  res: Response,
  next: NextFunction)=>{

  try {
    const UserID = req.user.userID;
    const user = await User.findOneAndUpdate(
     {UserID:UserID},
      { Bio: "" },
      { new: true, upsert: true }
    );
    if (!user)
      res
        .status(404)
        .json({ success: false, message: "User not found." });
    user.save();
    res.status(200).json({ success: true, message: "Bio Deleted" });
  } catch (error) {
    next(error);
  }
}

// export const getUser = (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const UserID = req.user.userID;
//    const userData = User.findById(UserID).populate.select("-_id -__v");
//   } catch (error) {
    
//   }
// }
