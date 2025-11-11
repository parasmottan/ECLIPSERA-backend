import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const getUploadUrl = async (req, res) => {
  try {
    const rawBytes = crypto.randomBytes(16);
    const fileName = rawBytes.toString("hex");

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: `uploads/${fileName}`,
      ContentType: "video/mp4",
    });

    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.status(200).json({ uploadURL, fileKey: `uploads/${fileName}` });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({ error: "Failed to get upload URL" });
  }
};
