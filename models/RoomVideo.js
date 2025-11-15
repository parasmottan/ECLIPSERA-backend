import mongoose from "mongoose";

const roomVideoSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },

   status: {
  type: String,
  enum: ["pending", "processing", "ready", "failed"],
  default: "pending",
},
hlsUrl: {
  type: String,
  default: null,
},
fileKey: {
  type: String,
  default: null,
},
    error: { type: String, default: null },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("RoomVideo", roomVideoSchema);
