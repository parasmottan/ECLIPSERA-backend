import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
// import router from "./controllers/generateRoom.js";
import connectDB from "./config/db.js";
import createRoom from "./controllers/generateRoom.js";
import verifyRoom from "./controllers/verifyRoomRoute.js";
import joinRoom from "./controllers/joinRoom.js";
import movieupload from "./routes/video.js";
import uploadRoute from "./routes/uploadRoute.js";

import RoomVideo from "./models/RoomVideo.js"; // ⭐IMPORTANT

const app = express();
const PORT = process.env.PORT || 5000;


app.set("io", null);


connectDB();

app.use(
  cors({
    origin: ["https://eclipsera-frontend.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());



app.use("/api/createroom", createRoom);    // POST create
app.use("/api/verifyroom", verifyRoom);    // GET room verify
app.use("/api/joinroom", joinRoom);  
app.use("/api/movieupload", movieupload);
app.use("/api", uploadRoute);



const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://eclipsera-frontend.vercel.app"],
    methods: ["GET", "POST"],
  },
});


app.set("io", io);



io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);


  socket.on("join_room", async (roomId) => {
    socket.join(roomId);
    console.log(`🟩 User ${socket.id} joined room ${roomId}`);


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




  socket.on("send_message", ({ roomId, text, sender }) => {
    socket.to(roomId).emit("receive_message", { text, sender });
  });




  socket.on("video_ready", ({ roomId, hlsUrl }) => {
    console.log(`🎬 Broadcasting converted video to room ${roomId}`);
    io.to(roomId).emit("video_ready", hlsUrl);
  });




  socket.on("video_deleted", ({ roomId }) => {
    console.log(`🗑 Broadcasting delete event for room ${roomId}`);
    io.to(roomId).emit("video_deleted");
  });




  socket.on("play_video", ({ roomId, currentTime }) => {
    io.to(roomId).emit("play_video", { currentTime });
  });



  socket.on("pause_video", ({ roomId, currentTime }) => {
    io.to(roomId).emit("pause_video", { currentTime });
  });




  socket.on("seek_video", ({ roomId, currentTime }) => {
    io.to(roomId).emit("seek_video", { currentTime });
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});



server.listen(PORT, () => {
  console.log(`🚀 Server running on https://eclipsera-backend.vercel.app:${PORT}`);
});
