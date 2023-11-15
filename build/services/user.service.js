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
exports.ImageUpload = exports.validateProfile = exports.validateBio = exports.validateFollow = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const joi_1 = __importDefault(require("joi"));
const endpoints_config_1 = require("../environments/endpoints.config");
const validateFollow = (person) => {
    const schema = joi_1.default.object({
        FollowingID: joi_1.default.string().min(3),
    });
    return schema.validate(person);
};
exports.validateFollow = validateFollow;
const validateBio = (bio) => {
    const schema = joi_1.default.object({
        Bio: joi_1.default.string().min(3),
    });
    return schema.validate(bio);
};
exports.validateBio = validateBio;
const validateProfile = (profile) => {
    const schema = joi_1.default.object({
        Name: joi_1.default.string().min(3),
        Username: joi_1.default.string().min(3),
        Bio: joi_1.default.string().min(0).max(150),
    });
    return schema.validate(profile);
};
exports.validateProfile = validateProfile;
const ImageUpload = (images, next, userid) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let MIMEtype = images.mimetype;
        const fileformat = MIMEtype.replace(MIMEtype.slice(0, 6), ".");
        const awsS3 = new client_s3_1.S3Client({
            credentials: {
                accessKeyId: `${endpoints_config_1.environment.AWS_ACCESS_KEY}`,
                secretAccessKey: `${endpoints_config_1.environment.AWS_SECRET_ACCESS_KEY}`,
            },
            region: "eu-west-2",
        });
        const key = `/profile/${userid}${Date.now().toString()}${fileformat}`;
        let upload = new client_s3_1.PutObjectCommand({
            Bucket: "fwstorage-trial",
            Key: `${key}`,
            Body: images.buffer,
        });
        yield awsS3.send(upload);
        let retrieve = new client_s3_1.GetObjectCommand({
            Bucket: "fwstorage-trial",
            Key: `${key}`,
        });
        const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(awsS3, retrieve);
        return signedUrl;
    }
    catch (err) {
        next(err);
    }
});
exports.ImageUpload = ImageUpload;
