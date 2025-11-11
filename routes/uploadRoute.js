import express from "express";
import { getUploadUrl } from "../controllers/uploadController.js";
const uploadRoute = express.Router();

uploadRoute.get("/upload-url", getUploadUrl);

export default uploadRoute;
