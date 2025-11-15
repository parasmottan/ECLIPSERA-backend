import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

// Set static ffmpeg + ffprobe paths for Zeabur / Render / Railway
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 🔍 Detect video & audio codec
const getCodec = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const audioStream = metadata.streams.find(s => s.codec_type === "audio");

      resolve({
        video: videoStream?.codec_name || null,
        audio: audioStream?.codec_name || null,
      });
    });
  });
};

export const convertToHLS = async (fileUrl, roomId) => {
  const tempDir = path.join(os.tmpdir(), `hls-${uuidv4()}`);
  const inputPath = path.join(tempDir, "input.mp4");
  const outputDir = path.join(tempDir, "hls");

  fs.mkdirSync(outputDir, { recursive: true });

  try {
    // 1️⃣ Download video
    const response = await axios.get(fileUrl, { responseType: "stream" });
    const writer = fs.createWriteStream(inputPath);

    response.data.pipe(writer);
    await new Promise((resolve) => writer.on("finish", resolve));

    // 2️⃣ Detect codecs
    const { video, audio } = await getCodec(inputPath);
    console.log("🎥 Input Video Codec:", video);
    console.log("🔊 Input Audio Codec:", audio);

    // 3️⃣ Build FFmpeg command
    let cmd = ffmpeg(inputPath);

    // Video codec logic
    if (video === "h264") {
      console.log("⚡ Using copy mode for video (FAST)");
      cmd = cmd.videoCodec("copy");
    } else {
      console.log("🐌 Re-encoding video → libx264 (H.265 detected or unsupported codec)");
      cmd = cmd.videoCodec("libx264").outputOptions(["-preset veryfast"]);
    }

    // Audio codec logic
    if (audio === "aac") {
      console.log("⚡ Copying AAC audio");
      cmd = cmd.audioCodec("copy");
    } else {
      console.log("🎧 Re-encoding audio → AAC");
      cmd = cmd.audioCodec("aac");
    }

    // 4️⃣ HLS settings
    await new Promise((resolve, reject) => {
      cmd
        .outputOptions([
          "-g 48",
          "-sc_threshold 0",
          "-f hls",
          "-hls_time 10",
          "-hls_list_size 0",
          "-hls_segment_filename",
          path.join(outputDir, "segment_%03d.ts"),
        ])
        .output(path.join(outputDir, "index.m3u8"))
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // 5️⃣ Upload everything to S3
    const timestamp = Date.now();
    const files = fs.readdirSync(outputDir);

    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const fileStream = fs.createReadStream(filePath);

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET,
          Key: `rooms/${roomId}/converted/${timestamp}/${file}`,
          Body: fileStream,
          ContentType: file.endsWith(".m3u8")
            ? "application/vnd.apple.mpegurl"
            : "video/MP2T",
        })
      );
    }

    // 6️⃣ Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    // 7️⃣ Final URL
    const hlsUrl = `https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_BUCKET}/rooms/${roomId}/converted/${timestamp}/index.m3u8`;

    return hlsUrl;

  } catch (err) {
    console.error("❌ FFmpeg Conversion Error:", err.message);
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
};
