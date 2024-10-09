import { connectToDatabase } from "@/lib/mongodb";
import { ErrorResponse, RequestBody } from "@/types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userPrompt, chatId } = (await request.json()) as RequestBody;

    // Connect to the database and get the chats collection
    const db = await connectToDatabase();
    const collection = db.collection("chats");

    // Initialize Google AI client
    const genAI = new GoogleGenerativeAI(
      process.env.GOOGLE_GEMINI_API_KEY as string
    );
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Get the AI model
    const model: GenerativeModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    // Start a chat with no history
    const chat = model.startChat();

    (async () => {
      try {
        let fullResponse = "";
        const result = await chat.sendMessageStream(userPrompt);

        // Write each chunk from the stream
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullResponse += chunkText;
          await writer.write(encoder.encode(chunkText));
        }

        // Update MongoDB with the new messages
        await collection.updateOne(
          { chatId },
          {
            $push: {
              messages: { role: "human", messageText: userPrompt }, // Directly push user prompt
            },
          },
          { upsert: true }
        );

        await collection.updateOne(
          { chatId },
          {
            $push: {
              messages: { role: "ai", messageText: fullResponse }, // Directly push AI response
            },
          },
          { upsert: true }
        );

        const chatHistory = await collection.findOne({ chatId });
        const allMessages = chatHistory.messages
          .map(
            (msg: { role: string; messageText: string }) =>
              `${msg.role}: ${msg.messageText}`
          )
          .join("\n");
        const summaryPrompt = `Summarize the following conversation in a brief paragraph:\n\n${allMessages}`;
        const summaryResult = await model.generateContent(summaryPrompt);
        const summary = summaryResult.response.text();

        await writer.write(encoder.encode(`\nSUMMARY:${summary}`));

        await collection.updateOne(
          { chatId },
          { $set: { summary } },
          { upsert: true }
        );

        writer.close();
      } catch (error) {
        console.error(
          "Error during stream processing:",
          (error as ErrorResponse).message
        );
        writer.abort(error);
      }
    })();

    // Return the stream as a response
    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in POST request:", (error as ErrorResponse).message);
    return new NextResponse(
      JSON.stringify({ error: (error as ErrorResponse).message }),
      {
        status: 500,
      }
    );
  }
}
