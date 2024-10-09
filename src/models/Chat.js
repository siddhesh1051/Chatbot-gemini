import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  messages: [
    {
      role: { type: String, enum: ["human", "ai"], required: true },
      messageText: { type: String, required: true },
    },
  ],
  summary: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
});

export const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
