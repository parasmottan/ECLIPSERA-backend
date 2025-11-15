import express from "express";
import roomId from "../models/roomId.js";

const verifyRoom = express.Router();

verifyRoom.get("/:roomId", async (req, res) => {
  try {
    const room = await roomId.findOne({ roomId: req.params.roomId });

    if (!room) {
      return res.status(404).json({ success: false });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

export default verifyRoom;
