import express from "express";
import { processMovie, deleteMovie, getRoomVideo } from "../controllers/videoController.js";

const movieupload = express.Router();

movieupload.post("/process", processMovie);
movieupload.post("/delete", deleteMovie);
movieupload.get("/:roomId", getRoomVideo);
  

export default movieupload;
