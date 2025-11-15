import { convertToHLS } from "../utils/convertToHLS.js";
import {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import RoomVideo from "../models/RoomVideo.js";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Normalize helper (repeat mat kar)
const normalize = (id) => id.toLowerCase().trim();

// 🎬 PROCESS MOVIE (NO DUPLICATE PROCESSING)
export const processMovie = async (req, res) => {
  try {
    const { movieUrl, roomId } = req.body;
    if (!movieUrl || !roomId)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const normalizedRoomId = normalize(roomId);
    const fileKey = new URL(movieUrl).pathname.slice(1);

    console.log("🎥 Requested processing for:", normalizedRoomId);

    // 1️⃣ FETCH EXISTING
    const existing = await RoomVideo.findOne({ roomId: normalizedRoomId });

    if (existing) {
      if (existing.status === "ready") {
        console.log("⚡ Already ready → returning HLS");
        return res.status(200).json({ success: true, hlsUrl: existing.hlsUrl });
      }

      if (existing.status === "processing") {
        console.log("⏳ Already processing — skip duplicate job");
        return res.status(202).json({ success: true, status: "processing" });
      }
    }

    // 2️⃣ CLAIM JOB (PREVENT DUPLICATE CONVERSION)
    await RoomVideo.findOneAndUpdate(
      { roomId: normalizedRoomId },
      {
        roomId: normalizedRoomId,
        status: "processing",
        fileKey,
        hlsUrl: null,
        error: null,
      },
      { upsert: true }
    );

    console.log("🔐 Job claimed for:", normalizedRoomId);

    // 3️⃣ START CONVERSION
    const hlsUrl = await convertToHLS(movieUrl, normalizedRoomId);

    // 4️⃣ DELETE ORIGINAL MP4
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: fileKey,
      })
    );

    // 5️⃣ SAVE STATUS = READY
    const updated = await RoomVideo.findOneAndUpdate(
      { roomId: normalizedRoomId },
      {
        status: "ready",
        hlsUrl,
        fileKey,
        error: null,
      },
      { new: true }
    );

    console.log("✅ Final saved:", updated);

    return res.status(200).json({ success: true, hlsUrl });
  } catch (err) {
    console.error("❌ processMovie ERROR:", err.message);

    // Mark job as failed
    const rid = normalize(req.body.roomId || "");
    await RoomVideo.findOneAndUpdate(
      { roomId: rid },
      { status: "failed", error: err.message }
    );

    return res.status(500).json({
      success: false,
      message: "Processing failed",
      error: err.message,
    });
  }
};

// 🗑 DELETE MOVIE
export const deleteMovie = async (req, res) => {
  try {
    const { fileKey } = req.body;
    if (!fileKey)
      return res.status(400).json({ success: false, message: "Missing fileKey" });

    const roomId = fileKey.split("/")[1]; // rooms/{roomId}/converted
    const prefix = `rooms/${roomId}/`;

    console.log("🗑 Deleting files for prefix:", prefix);

    const objects = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET,
        Prefix: prefix,
      })
    );

    if (objects?.Contents?.length) {
      for (const obj of objects.Contents) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: obj.Key,
          })
        );
      }
    }

    await RoomVideo.deleteOne({ roomId });

    return res.status(200).json({
      success: true,
      message: "Movie + HLS deleted",
    });
  } catch (err) {
    console.error("❌ deleteMovie ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// 🎥 GET EXISTING MOVIE
export const getRoomVideo = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId)
      return res.status(400).json({ success: false, message: "Missing roomId" });

    const normalizedRoomId = normalize(roomId);
    console.log("🎯 Fetching video for:", normalizedRoomId);

    const video = await RoomVideo.findOne({ roomId: normalizedRoomId });

    if (!video)
      return res.status(404).json({
        success: false,
        message: "No movie found",
      });

    return res.status(200).json({ success: true, video });
  } catch (err) {
    console.error("❌ getRoomVideo ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
