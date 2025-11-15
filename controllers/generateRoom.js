import roomId from "../models/roomId.js";
import generateRoomCode from "../roomcode/roomCode.js";
import express from 'express';

const createRoom = express.Router();

createRoom.post("/", async (req, res) => {
  try {
    const roomCode = generateRoomCode();

    const exists = await roomId.findOne({ roomId: roomCode });
    if (exists) {
      return res.status(409).json({ success: false, message: "Room code exists" });
    }

    await roomId.create({ roomId: roomCode });
    return res.status(201).json({ success: true, roomId: roomCode });

  } catch (err) {
    return res.status(500).json({ success: false, message: "Error creating room" });
  }
});

export default createRoom;
