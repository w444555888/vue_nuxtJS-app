import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    secure: true,
  });
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

const ensureCloudinaryConfig = () => {
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasParts = Boolean(cloudName && apiKey && apiSecret);

  if (!hasUrl && !hasParts) {
    const error = new Error("Cloudinary 未配置，請設置 CLOUDINARY_URL 或 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET");
    error.status = 500;
    throw error;
  }
};

export const uploadImageBuffer = (buffer, options = {}) => {
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const configuredChunkSize = Number(process.env.CLOUDINARY_CHUNK_SIZE);
    const chunkSize = Number.isFinite(configuredChunkSize) && configuredChunkSize >= 5000000
      ? configuredChunkSize
      : 6000000;
    let settled = false;

    const stream = cloudinary.uploader.upload_chunked_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "chat-images",
        resource_type: "auto",
        chunk_size: chunkSize,
        ...options,
      },
      (error, result) => {
        if (settled) {
          return;
        }

        if (error) {
          settled = true;
          return reject(error);
        }

        if (!result || result.done === false) {
          return;
        }

        settled = true;
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
};
