import multer from "multer";

// Files are kept in memory until uploaded to S3, so cap their size and count,
// and only accept images. Without limits one request could exhaust the server's RAM.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(Object.assign(new Error("Only image files are allowed"), { statusCode: 400 }));
  },
});

export default upload;
