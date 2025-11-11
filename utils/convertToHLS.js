import ffmpeg from "fluent-ffmpeg";
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

export const convertToHLS = async (fileUrl, roomId) => {
  const tempDir = path.join(os.tmpdir(), `hls-${uuidv4()}`);
  const inputPath = path.join(tempDir, "input.mp4");
  const outputDir = path.join(tempDir, "hls");
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    // 1️⃣ Download video from S3 → local
    const response = await axios.get(fileUrl, { responseType: "stream" });
    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);
    await new Promise((resolve) => writer.on("finish", resolve));

    // 2️⃣ Convert to HLS (m3u8 + ts)
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-preset veryfast",
          "-g 48",
          "-sc_threshold 0",
          "-map 0:v",
          "-map 0:a?",
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

    // 3️⃣ Upload all generated HLS files to S3
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

    // 4️⃣ Clean temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    // 5️⃣ Return final HLS URL
   const hlsUrl = `https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_BUCKET}/rooms/${roomId}/converted/${timestamp}/index.m3u8`;
return hlsUrl;
    return hlsUrl;
  } catch (err) {
    console.error("❌ FFmpeg Conversion Error:", err.message);
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
};
