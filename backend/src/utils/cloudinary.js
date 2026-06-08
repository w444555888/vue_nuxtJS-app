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
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "chat-images",
        resource_type: "image",
        ...options,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
};
