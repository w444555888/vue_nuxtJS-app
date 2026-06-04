import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// 獲取當前文件路徑和目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義上傳目錄
const uploadDir = path.join(__dirname, "../../public/uploads");

// 確保上傳目錄存在
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：字段名 + 时间戳 + 随机数 + 原始扩展名
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
        "-" +
        uniqueSuffix +
        path.extname(file.originalname)
    );
  },
});

// 文件過濾器 - 只允許圖片格式
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("仅支持 JPEG, PNG, GIF, WebP 图片格式"));
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
