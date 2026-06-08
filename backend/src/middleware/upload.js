import multer from "multer";

const storage = multer.memoryStorage();

// 文件過濾器 - 允許圖片與常見影片格式
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("僅支持 JPEG, PNG, GIF, WebP, MP4, WebM, MOV 格式"));
  }
};

// 創建 multer 實例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 限制
  },
});

export default upload;
