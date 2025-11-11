import roomId from "../models/roomId.js";
import express from "express";

const joinRoom = express.Router();

joinRoom.put("/:roomId", async (req, res) => {
  try {
    const { roomId: id } = req.params;
    const room = await roomId.findOne({ roomId: id });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.status(200).json({ message: "Room joined successfully", room });
    await roomId.updateOne({ roomId: id }, { $set: { lastActive: new Date() } });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default joinRoom;
