import fs from "fs";
import path from "path";
import os from "os";

const getTempDir = () => {
  return path.join(os.tmpdir(), "chat-media-chunks");
};

const ensureTempDir = () => {
  const dir = getTempDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const saveChunk = (uploadId, chunkIndex, buffer) => {
  const tempDir = ensureTempDir();
  const chunkDir = path.join(tempDir, uploadId);
  
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir, { recursive: true });
  }
  
  const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
  fs.writeFileSync(chunkPath, buffer);
  
  return chunkPath;
};

export const getChunkDirPath = (uploadId) => {
  return path.join(getTempDir(), uploadId);
};

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

export const cleanupChunks = (uploadId) => {
  const chunkDir = getChunkDirPath(uploadId);
  
  if (fs.existsSync(chunkDir)) {
    fs.rmSync(chunkDir, { recursive: true, force: true });
  }
};

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
