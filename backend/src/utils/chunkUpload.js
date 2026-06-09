import fs from "fs";
import path from "path";
import os from "os";

// 系統臨時目錄下的分片存儲路徑
const getTempDir = () => {
  return path.join(os.tmpdir(), "chat-media-chunks");
};

// 確保臨時目錄存在，若不存在則創建
const ensureTempDir = () => {
  const dir = getTempDir();
  if (!fs.existsSync(dir)) {
    // 使用 recursive 選項確保父目錄也會被創建
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * 保存分片到臨時目錄
 * @param {string} uploadId - 上傳 ID，用於區分不同文件的分片
 * @param {number} chunkIndex - 分片索引
 * @param {Buffer} buffer - 分片數據
 * @returns {string} 分片文件的路徑
 */
export const saveChunk = (uploadId, chunkIndex, buffer) => {
  const tempDir = ensureTempDir();
  const chunkDir = path.join(tempDir, uploadId);
  
  // 確保分片目錄存在
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  
  // 分片文件命名規則：chunk_{index}
  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
  fs.writeFileSync(chunkPath, buffer);
  
  return chunkPath;
};

// 獲取分片文件路徑
export const getChunkDirPath = (uploadId) => {
  return path.join(getTempDir(), uploadId);
};

// 合併分片並返回完整文件的 Buffer
export const mergeChunks = (uploadId, totalChunks) => {
  const chunkDir = getChunkDirPath(uploadId);
  
  if (!fs.existsSync(chunkDir)) {
    throw new Error(`分片目錄不存在: ${uploadId}`);
  }
  
  const chunks = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(chunkDir, `chunk_${i}`);
    if (!fs.existsSync(chunkPath)) {
      throw new Error(`缺少分片: chunk_${i}`);
    }
    chunks.push(fs.readFileSync(chunkPath));
  }
  
  const mergedBuffer = Buffer.concat(chunks);
  
  return mergedBuffer;
};

// 清理分片文件
export const cleanupChunks = (uploadId) => {
  const chunkDir = getChunkDirPath(uploadId);
  
  if (fs.existsSync(chunkDir)) {
    // recursive 遞迴刪除 ， force 強制刪除
    fs.rmSync(chunkDir, { recursive: true, force: true });
  }
};

// 定期清理過期的分片文件（例如每天一次）
export const cleanupExpiredChunks = (maxAgeMs = 24 * 60 * 60 * 1000) => {
  const tempDir = getTempDir();
  
  if (!fs.existsSync(tempDir)) {
    return;
  }
  
  const now = Date.now();
  const dirs = fs.readdirSync(tempDir);
  
  dirs.forEach((dir) => {
    const dirPath = path.join(tempDir, dir);
    const stats = fs.statSync(dirPath);
    
    if (now - stats.mtimeMs > maxAgeMs) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });
};
