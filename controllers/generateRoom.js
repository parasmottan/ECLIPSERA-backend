import roomId from "../models/roomId.js";
import generateRoomCode from "../roomcode/roomCode.js";
import express from 'express';

const router = express.Router();


router.post('/createroom', (req, res) => {
  const roomCode = generateRoomCode();
  if (!roomCode) return res.status(500).json({ message: "Error generating room code" });

  roomId.findOne({ roomId: roomCode })
    .then((existingRoom) => {
      if (existingRoom) return res.status(409).json({ message: "Room code already exists" });

      const newRoom = new roomId({ roomId: roomCode });

      newRoom.save()
        .then(() => {
          res.status(201).json({ message: "Room created successfully", roomId: roomCode });
        })
        .catch((error) => {
          console.error("Error saving room:", error);
          res.status(500).json({ message: "Error creating room" });
        });
    });

});
router.get("/:roomId", async (req, res) => {
  try {
    const { roomId: id } = req.params;
    const room = await roomId.findOne({ roomId: id });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(200).json({ message: "Room exists", room });
  } catch (error) {
    console.error("Error checking room:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;