"use client";

import Image from "next/image";
import React, { useState, useEffect, useRef, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import unmute from "@/assets/unmute.png";
import mute from "@/assets/mute.png";
import InfiniteLoader from "@/components/InfiniteLoader";
import sendIcon from "@/assets/send-icon.svg";

interface Message {
  role: "human" | "ai" | "error";
  messageText: string;
}

interface ChatData {
  messages: Message[];
  summary: string;
}

const PAGE_SIZE = 10;

export default function ChatPage({ chatId }: { chatId: string }) {
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [initialLoadComplete, setInitialLoadComplete] =
    useState<boolean>(false);

  // const chatBoxRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomDivRef = useRef<HTMLDivElement>(null);
  const latestMsgRef = useRef<HTMLDivElement>(null);

  const {
    transcript: speechTranscript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    // if (initialLoadComplete && bottomDivRef.current)
    //   bottomDivRef.current?.scrollIntoView({
    //     behavior: "smooth",
    //   });
    fetchMessages(page);
  }, [page]);

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser does not support speech recognition.");
    }
  }, [browserSupportsSpeechRecognition]);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1,
    };

    setTimeout(() => {
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (
          entry.isIntersecting &&
          hasMore &&
          !loadingMore &&
          initialLoadComplete
        ) {
          handleLoadMore();
        }
      }, options);

      if (topSentinelRef.current) {
        observerRef.current.observe(topSentinelRef.current);
      }
    }, 1000);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, initialLoadComplete]);

  const fetchMessages = async (page: number) => {
    try {
      setLoadingMore(true);
      const res = await fetch(
        `/api/chat/${chatId}?page=${page}&limit=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error("Failed to load chat history");

      const data: ChatData = await res.json();

      if (data.messages.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setMessages((prev) => [...data.messages, ...prev]);
      setSummary(data.summary);

      if (page === 1) {
        setInitialLoadComplete(true);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          messageText: "Failed to load chat history.",
        },
      ]);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (page === 1) {
      bottomDivRef.current?.scrollIntoView();
    } else {
      latestMsgRef.current?.scrollIntoView();
    }
  }, [messages]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      setPage((prev) => prev + 1);
      fetchMessages(page + 1);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "human", messageText: userPrompt },
    ];

    setMessages(newMessages);
    setUserPrompt("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userPrompt, chatId }),
      });

      if (!response.ok) {
        throw new Error("HTTP error!");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is null");

      const decoder = new TextDecoder();
      let aiResponse = "";

      setMessages((prev) => [...prev, { role: "ai", messageText: aiResponse }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);

        if (chunk.startsWith("\nSUMMARY:")) {
          const newSummary = chunk.slice(9);
          setSummary(newSummary);
        } else {
          aiResponse += chunk;
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "ai", messageText: aiResponse },
          ]);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          messageText: "An error occurred while fetching the response.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = async () => {
    setIsRecording(!isRecording);

    if (isRecording) {
      SpeechRecognition.stopListening();
      if (speechTranscript) {
        console.log("Transcript:", speechTranscript);

        const newMessages: Message[] = [
          ...messages,
          { role: "human", messageText: speechTranscript },
        ];
        setMessages(newMessages);
        setIsLoading(true);

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userPrompt: speechTranscript, chatId }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("Response body is null");

          const decoder = new TextDecoder();
          let aiResponse = "";
          setMessages((prev) => [
            ...prev,
            { role: "ai", messageText: aiResponse },
          ]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);

            if (chunk.startsWith("\nSUMMARY:")) {
              const newSummary = chunk.slice(9);
              setSummary(newSummary);
            } else {
              aiResponse += chunk;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "ai", messageText: aiResponse },
              ]);
            }
          }
        } catch (error) {
          console.error("Error:", error);
          setMessages((prev) => [
            ...prev,
            {
              role: "error",
              messageText: "An error occurred while fetching the response.",
            },
          ]);
        } finally {
          setIsLoading(false);
        }

        resetTranscript();
      }
    } else {
      console.log("Starting recording...");
      SpeechRecognition.startListening({ continuous: false });
    }
  };

  return (
    <div className="container mx-auto max-w-5xl min-h-screen flex flex-col ">
      {!isLoading ? (
        <div className="fixed md:block hidden top-2 right-2 p-4 max-w-sm border-2 border-emerald-200 bg-[#f5fffa] shadow-lg shadow-emerald-100 rounded-xl z-10">
          <h3 className="font-bold mb-2 text-lg">Summary</h3>
          <p className="text-sm">{summary}</p>
        </div>
      ) : (
        <div>He;;p</div>
      )}
      <div
        // ref={chatBoxRef}
        className="chat-box rounded-md flex-grow flex flex-col overflow-y-auto"
        style={{ position: "relative" }}
      >
        <div ref={topSentinelRef} />
        {loadingMore && (
          <div className="text-center text-gray-500 py-4">
            <InfiniteLoader />
          </div>
        )}
        {messages?.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 my-4 ${
              message.role === "human" ? "ml-auto" : ""
            }`}
            ref={index === PAGE_SIZE + 10 ? latestMsgRef : null}
          >
            {message.role === "ai" && (
              <Image
                src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg"
                alt={message.role}
                height={40}
                width={40}
                className="my-2"
              />
            )}
            <div
              className={`p-3 rounded-xl my-2 w-fit shadow-xl shadow-emerald-50 ${
                message.role === "human"
                  ? "bg-gradient-to-t from-green-200 to-green-50 text-black"
                  : message.role === "error"
                  ? "bg-red-500 text-white max-w-[80%]"
                  : "bg-[#fcfffd] max-w-[100%] border-2 border-green-200"
              }`}
            >
              <ReactMarkdown className="prose max-w-none dark:prose-invert">
                {message.messageText}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {/* {isLoading && !loadingMore && (
          <div className="text-center text-gray-500 py-4">Loading...</div>
        )} */}
      </div>
      <div ref={bottomDivRef} />
      <form
        onSubmit={handleSubmit}
        className="flex items-center space-x-4 pb-4 pt-6 bg-[#f9fffc] sticky bottom-0"
      >
        <div className="flex w-full shadow-md border border-emerald-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Type your message..."
            className="w-full bg-transparent focus:outline-none"
          />
          <button type="button" onClick={toggleRecording}>
            {isRecording ? (
              <Image src={mute} alt="stop" width={40} height={50} />
            ) : (
              <Image src={unmute} alt="start" width={40} height={50} />
            )}
          </button>
        </div>
        <button
          type="submit"
          className="bg-gradient-to-t from-emerald-500 to-emerald-100 shadow-2xl shadow-emerald-400 text-black px-6 py-2 rounded-full hover:bg-blue-600 transition duration-300 ease-in-out flex gap-2 items-center justify-center font-medium text-xl disabled:opacity-50"
          disabled={isLoading || !userPrompt.trim()}
        >
          <span>Send</span>
          <Image src={sendIcon} alt="send" width={20} height={20} />
        </button>
      </form>
    </div>
  );
}
