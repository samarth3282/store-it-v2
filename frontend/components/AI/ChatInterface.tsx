"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "ai";
    content: string;
}

export function ChatInterface() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input;
        setInput("");
        setLoading(true);
        setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

        try {
            const res = await fetch("http://localhost:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg }),
            });

            if (!res.ok) throw new Error(res.statusText);

            // Streaming Logic
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) return;

            // Add placeholder AI message
            setMessages((prev) => [...prev, { role: "ai", content: "" }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsgIndex = newMessages.length - 1;
                    const lastMsg = { ...newMessages[lastMsgIndex] }; // Copy object

                    if (lastMsg.role === "ai") {
                        lastMsg.content += chunk;
                        newMessages[lastMsgIndex] = lastMsg;
                    }
                    return newMessages;
                });
            }

        } catch (error) {
            console.error(error);
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: "Sorry, something went wrong with the agent." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
            </Button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-white border rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
                    {/* Header */}
                    <div className="bg-brand p-4 text-white flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        <span className="font-semibold">AI Assistant</span>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.length === 0 && (
                            <p className="text-center text-slate-500 text-sm mt-10">
                                Hi! I can help you find, rename, or manage your files.
                            </p>
                        )}


                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "max-w-[80%] rounded-lg p-3 text-sm break-words",
                                    m.role === "user"
                                        ? "bg-brand text-white ml-auto"
                                        : "bg-white border text-slate-800"
                                )}
                            >
                                {m.role === "ai" ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            ul: ({ node, ...props }: any) => <ul className="list-disc ml-5" {...props} />,
                                            ol: ({ node, ...props }: any) => <ol className="list-decimal ml-5" {...props} />,
                                            a: ({ node, ...props }: any) => <a className="text-blue-500 underline" target="_blank" {...props} />,
                                        }}
                                    >
                                        {m.content}
                                    </ReactMarkdown>
                                ) : (
                                    m.content
                                )}
                            </div>
                        ))}

                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 bg-white border-t flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask something..."
                            className="flex-1"
                        />
                        <Button type="submit" size="icon" disabled={loading}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            )}
        </>
    );
}
