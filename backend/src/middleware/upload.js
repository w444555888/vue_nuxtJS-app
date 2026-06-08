import multer from "multer";

const storage = multer.memoryStorage();

// 文件過濾器 - 只允許圖片格式
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("僅支持 JPEG, PNG, GIF, WebP 圖片格式"));
  }
};

// 創建 multer 實例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
  },
});

export default upload;
