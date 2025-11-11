import mongoose from "mongoose";

const roomIdSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  lastActive: { type: Date, default: Date.now, expires: 60 * 60 * 4 }, // delete 4h after last activity
});




export default mongoose.model("RoomId", roomIdSchema);
