import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  6
);

const generateRoomCode = () => {
  return nanoid();
};

export default generateRoomCode;
