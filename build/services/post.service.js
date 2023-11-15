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
exports.ImageUpload = exports.validatePostID = exports.validatePost = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const joi_1 = __importDefault(require("joi"));
const endpoints_config_1 = require("../environments/endpoints.config");
const validatePost = (caption) => {
    const schema = joi_1.default.object({
        caption: joi_1.default.string().min(0).max(250),
    });
    return schema.validate(caption);
};
exports.validatePost = validatePost;
const validatePostID = (caption) => {
    const schema = joi_1.default.object({
        postID: joi_1.default.string().min(6),
    });
    return schema.validate(caption);
};
exports.validatePostID = validatePostID;
const ImageUpload = (images, next, userid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const awsS3 = new client_s3_1.S3Client({
            credentials: {
                accessKeyId: endpoints_config_1.environment.AWS_ACCESS_KEY,
                secretAccessKey: endpoints_config_1.environment.AWS_SECRET_ACCESS_KEY,
            },
            region: "eu-west-2",
        });
        const uploadPromises = images.map((element) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const MIMEtype = element.mimetype;
                const fileformat = MIMEtype.replace(MIMEtype.slice(0, 6), ".");
                const key = `/posts/${userid}${Date.now().toString()}${fileformat}`;
                const upload = new client_s3_1.PutObjectCommand({
                    Bucket: "fwstorage-trial",
                    Key: key,
                    Body: element.buffer,
                });
                yield awsS3.send(upload);
                // Generate a signed URL for the uploaded object
                const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(awsS3, new client_s3_1.GetObjectCommand({
                    Bucket: "fwstorage-trial",
                    Key: key,
                }));
                return signedUrl;
            }
            catch (error) {
                next(error);
            }
        }));
        const results = yield Promise.all(uploadPromises);
        return results;
    }
    catch (err) {
        next(err);
    }
});
exports.ImageUpload = ImageUpload;
