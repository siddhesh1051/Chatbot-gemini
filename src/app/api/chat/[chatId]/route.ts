import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  const { chatId } = params;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  try {
    // Connect to the database
    const db = await connectToDatabase();
    const collection = db.collection("chats");

    // Fetch the chat history from MongoDB by chatId
    const chat = await collection.findOne({ chatId });

    if (!chat) {
      return new NextResponse(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
      });
    }

    // Reverse the order and slice the messages for pagination
    const messages = chat.messages
      .slice()
      .reverse()
      .slice((page - 1) * limit, page * limit)
      .reverse(); // Reverse again to maintain chronological order
    const summary = chat.summary;

    return NextResponse.json({ messages, summary });
  } catch (error) {
    console.error("Error fetching chat:", error.message);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
      }
    );
  }
}
