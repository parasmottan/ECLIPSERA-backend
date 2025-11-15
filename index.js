import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import router from "./controllers/generateRoom.js";
import connectDB from "./config/db.js";
import joinRoom from "./controllers/joinRoom.js";
import movieupload from "./routes/video.js";
import uploadRoute from "./routes/uploadRoute.js";

import RoomVideo from "./models/RoomVideo.js"; // ⭐IMPORTANT

const app = express();
const PORT = process.env.PORT || 5000;

// ⭐ Make io accessible inside controllers:
app.set("io", null);

// ✅ MongoDB connect
connectDB();

// ✅ Middleware
app.use(
  cors({
    origin: ["https://eclipsera-frontend.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

// ✅ Routes
app.use("/api/createroom", router);
app.use("/api/joinroom", joinRoom);
app.use("/api/:roomId", router);
app.use("/api/movieupload", movieupload);
app.use("/api", uploadRoute);

// ------------------------------------
// ⭐ Create HTTP + Socket.io server
// ------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://eclipsera-frontend.vercel.app"],
    methods: ["GET", "POST"],
  },
});

// ⭐ Register io global so controllers can use:
app.set("io", io);

// ------------------------------------
// 🔥 SOCKET.IO FINAL VERSION
// ------------------------------------
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // 🟢 Join Room
  socket.on("join_room", async (roomId) => {
    socket.join(roomId);
    console.log(`🟩 User ${socket.id} joined room ${roomId}`);

    // ⭐ NEW FIX: Send existing room video to this joining user
    try {
      const video = await RoomVideo.findOne({
        roomId: roomId.toLowerCase().trim(),
      });

      if (video && video.hlsUrl) {
        console.log(`🎥 Sending existing video to ${socket.id} → ${video.hlsUrl}`);
        socket.emit("video_ready", video.hlsUrl); // send only to joining client
      }
    } catch (err) {
      console.error("DB lookup error:", err.message);
    }
  });

  // 💬 Chat Message
  socket.on("send_message", ({ roomId, text, sender }) => {
    socket.to(roomId).emit("receive_message", { text, sender });
  });

  // 🎬 Video Ready (broadcast)
  socket.on("video_ready", ({ roomId, hlsUrl }) => {
    console.log(`🎬 Broadcasting converted video to room ${roomId}`);
    io.to(roomId).emit("video_ready", hlsUrl);
  });

  // 🗑 Movie Deleted
  socket.on("video_deleted", ({ roomId }) => {
    console.log(`🗑 Broadcasting delete event for room ${roomId}`);
    io.to(roomId).emit("video_deleted");
  });

  // ▶️ Play
  socket.on("play_video", ({ roomId, currentTime }) => {
    io.to(roomId).emit("play_video", { currentTime });
  });

  // ⏸ Pause
  socket.on("pause_video", ({ roomId, currentTime }) => {
    io.to(roomId).emit("pause_video", { currentTime });
  });

  // ⏩ Seek
  socket.on("seek_video", ({ roomId, currentTime }) => {
    io.to(roomId).emit("seek_video", { currentTime });
  });

  // ❌ Disconnect
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ------------------------------------
// 🔥 Start Server
// ------------------------------------
server.listen(PORT, () => {
  console.log(`🚀 Server running on https://eclipsera-backend.vercel.app:${PORT}`);
});
