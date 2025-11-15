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


// 🎬 PROCESS MOVIE (Safe: No duplicate processing)
export const processMovie = async (req, res) => {
  try {
    const { movieUrl, roomId } = req.body;

    if (!movieUrl || !roomId) {
      return res.status(400).json({
        success: false,
        message: "Missing movieUrl or roomId",
      });
    }

    const normalizedRoomId = roomId.toLowerCase().trim();

    console.log("🎥 Processing movie for room:", normalizedRoomId);

    // 1️⃣ CHECK IF ALREADY READY
    const existing = await RoomVideo.findOne({ roomId: normalizedRoomId });

    if (existing && existing.status === "ready") {
      console.log("⚡ Already processed → returning existing HLS link");
      return res.status(200).json({
        success: true,
        hlsUrl: existing.hlsUrl,
        message: "Already processed",
      });
    }

    // 2️⃣ CHECK IF PROCESSING
    if (existing && existing.status === "processing") {
      console.log("⏳ Already processing → returning status");
      return res.status(202).json({
        success: true,
        message: "Processing already in progress",
        status: "processing",
      });
    }

    // 3️⃣ CLAIM THE JOB (NO DUPLICATE CONVERSION EVER)
    const claimed = await RoomVideo.findOneAndUpdate(
      { roomId: normalizedRoomId },
      {
        roomId: normalizedRoomId,
        status: "processing",
        fileKey: new URL(movieUrl).pathname.slice(1),
      },
      { upsert: true, new: true }
    );

    console.log("🔐 Job claimed:", claimed.roomId);

    // 4️⃣ START CONVERSION
    const hlsUrl = await convertToHLS(movieUrl, normalizedRoomId);

    // 5️⃣ DELETE ORIGINAL MP4
    const key = claimed.fileKey;
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: key,
      })
    );

    // 6️⃣ UPDATE AS READY
    const updated = await RoomVideo.findOneAndUpdate(
      { roomId: normalizedRoomId },
      {
        status: "ready",
        hlsUrl,
        fileKey: key,
      },
      { new: true }
    );

    console.log("✅ Final saved video:", updated);

    return res.status(200).json({ success: true, hlsUrl });
  } catch (err) {
    console.error("🎬 processMovie Error:", err);

    // 7️⃣ MARK FAILED
    await RoomVideo.findOneAndUpdate(
      { roomId: req.body.roomId.toLowerCase().trim() },
      {
        status: "failed",
        error: err.message,
      }
    );

    return res.status(500).json({
      success: false,
      message: "Video processing failed",
      error: err.message,
    });
  }
};






// 🧹 DELETE MOVIE (remove from S3 + DB)
export const deleteMovie = async (req, res) => {
  try {
    const { fileKey } = req.body;

    if (!fileKey || typeof fileKey !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing fileKey",
      });
    }

    // Extract prefix (for converted HLS segments)
    const prefixParts = fileKey.split("/");
    const roomPrefix = prefixParts[prefixParts.length - 1]?.split(".")[0];

    // 🗑️ Delete all converted HLS files from S3
    const listedObjects = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET,
        Prefix: `rooms/`, // broader path to catch all rooms folders
      })
    );

    if (listedObjects.Contents) {
      const matchingObjects = listedObjects.Contents.filter((obj) =>
        obj.Key.includes(roomPrefix)
      );
      for (const obj of matchingObjects) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key: obj.Key,
          })
        );
      }
    }

    // 🧹 Delete original uploaded file
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: fileKey,
      })
    );

    // 🧼 Remove entry from MongoDB
    await RoomVideo.deleteOne({ fileKey });

    console.log("🗑️ Deleted movie from S3 and DB:", fileKey);

    res.status(200).json({
      success: true,
      message: "Movie and converted files deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete Movie Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// 🎥 GET ROOM VIDEO (Auto-fetch existing movie when room opens)
export const getRoomVideo = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Missing roomId",
      });
    }

    const normalizedRoomId = roomId.toLowerCase().trim();
    console.log("🎯 Fetching video for room:", normalizedRoomId);

    const video = await RoomVideo.findOne({ roomId: normalizedRoomId });

    if (!video) {
      console.log("⚠️ No video found for room:", normalizedRoomId);
      return res.status(404).json({
        success: false,
        message: "No video found for this room",
      });
    }

    console.log("✅ Found video:", video.hlsUrl);
    res.status(200).json({ success: true, video });
  } catch (err) {
    console.error("Fetch Room Video Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
