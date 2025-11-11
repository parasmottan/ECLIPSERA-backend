import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import router from "./controllers/generateRoom.js";
import connectDB from "./config/db.js";
import joinRoom from "./controllers/joinRoom.js";
import movieupload from "./routes/video.js";
import uploadRoute from "./routes/uploadRoute.js";

const app = express();
const PORT = process.env.PORT || 5000;

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

// ✅ Create HTTP + Socket.io server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://eclipsera-frontend.vercel.app"],
    methods: ["GET", "POST"],
  },
});

// ✅ Socket.io logic
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // 🟢 Join Room
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`🟩 User ${socket.id} joined room ${roomId}`);
  });

  // 💬 Chat Message
  socket.on("send_message", (data) => {
    const { roomId, text, sender } = data;
    socket.to(roomId).emit("receive_message", { text, sender });
  });

  // 🎥 Video Sync Events
  // ▶️ Play
  socket.on("play_video", ({ roomId, currentTime }) => {
    console.log(`▶️ Video played in room ${roomId} at ${currentTime}s`);
    socket.to(roomId).emit("play_video", { currentTime });
  });

  // ⏸️ Pause
  socket.on("pause_video", ({ roomId, currentTime }) => {
    console.log(`⏸️ Video paused in room ${roomId} at ${currentTime}s`);
    socket.to(roomId).emit("pause_video", { currentTime });
  });

  // ⏩ Seek
  socket.on("seek_video", ({ roomId, currentTime }) => {
    console.log(`⏩ Video seeked in room ${roomId} to ${currentTime}s`);
    socket.to(roomId).emit("seek_video", { currentTime });
  });

  // ❌ Disconnect
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ✅ Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on https://eclipsera-backend.vercel.app:${PORT}`);
});
