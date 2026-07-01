"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, X, MessageSquare, Trash2, Zap, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/api/config";

interface Message {
    role: "user" | "ai";
    content: string;
    timestamp: Date;
}

export function ChatInterface() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "ai",
            content: "👋 Hi! I'm your AI agent. I can help you find, rename, organize, or manage your files. Ask me anything!",
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingContent]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input;
        setInput("");
        setLoading(true);
        setStreamingContent("");
        setMessages((prev) => [...prev, { role: "user", content: userMsg, timestamp: new Date() }]);

        // Guard against unauthenticated calls — same check frontend_new already used
        const accessToken = getAccessToken();
        if (!accessToken) {
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: "Please sign in to use the AI assistant.", timestamp: new Date() },
            ]);
            setLoading(false);
            return;
        }

        try {
            // Build history from current messages (before the new user message was added)
            const history = messages.map((m) => ({
                role: m.role === "user" ? "human" : "ai",
                content: m.content,
            }));

            const res = await fetch(
                process.env.NEXT_PUBLIC_AGENT_URL
                    ? `${process.env.NEXT_PUBLIC_AGENT_URL}/chat`
                    : "http://localhost:8000/chat",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: userMsg,
                        history: history,
                        user_token: accessToken,
                    }),
                }
            );

            if (!res.ok) throw new Error(res.statusText);

            // Streaming logic with typewriter effect
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) return;

            let fullContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullContent += chunk;
                setStreamingContent(fullContent);
            }

            // Once streaming is complete, commit to the messages list
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: fullContent, timestamp: new Date() }
            ]);
            setStreamingContent("");

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: `⚠️ Sorry, something went wrong with the agent: ${errorMessage}`, timestamp: new Date() },
            ]);
            setStreamingContent("");
        } finally {
            setLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([
            {
                role: "ai",
                content: "Chat cleared! 🧹 How can I help you today?",
                timestamp: new Date(),
            }
        ]);
        setStreamingContent("");
    };

    const quickQuestions = [
        "Show me my recent files",
        "Help me find a document",
        "How do I organize files?",
        "What can you do?",
    ];

    return (
        <>
            {/* Floating Trigger Button */}
            <Button
                className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-110"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="size-6" /> : <MessageSquare className="size-6" />}
            </Button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-80 flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xl dark:border-light-100/20 dark:bg-dark-200 md:w-[420px]">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-brand to-brand-100 p-4 text-white">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                    <Bot className="size-6" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                                <h3 className="font-semibold">AI Assistant</h3>
                                <p className="flex items-center gap-1 text-xs text-white/80">
                                    <Zap className="size-3" />
                                    Ready to help
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-white hover:bg-white/20"
                                onClick={handleClearChat}
                                title="Clear chat"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-white hover:bg-white/20"
                                onClick={() => setIsOpen(false)}
                                title="Minimize"
                            >
                                <Minimize2 className="size-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-dark-100">
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex",
                                    m.role === "user" ? "justify-end" : "justify-start"
                                )}
                            >
                                <div className="flex max-w-[85%] flex-col gap-1">
                                    <div
                                        className={cn(
                                            "rounded-2xl p-3 text-sm break-words",
                                            m.role === "user"
                                                ? "bg-brand text-white rounded-br-md"
                                                : "bg-white dark:bg-dark-200 border border-slate-200 dark:border-light-100/20 text-slate-800 dark:text-white rounded-bl-md shadow-sm"
                                        )}
                                    >
                                        {m.role === "ai" ? (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    ul: ({ ...props }: any) => <ul className="ml-5 list-disc space-y-1" {...props} />,
                                                    ol: ({ ...props }: any) => <ol className="ml-5 list-decimal space-y-1" {...props} />,
                                                    li: ({ ...props }: any) => <li className="leading-relaxed" {...props} />,
                                                    p: ({ ...props }: any) => <p className="leading-relaxed" {...props} />,
                                                    a: ({ ...props }: any) => <a className="text-brand underline hover:text-brand-100" target="_blank" rel="noopener noreferrer" {...props} />,
                                                    strong: ({ ...props }: any) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
                                                    code: ({ inline, ...props }: any) =>
                                                        inline ?
                                                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 dark:bg-dark-100 dark:text-white" {...props} /> :
                                                        <code className="block overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs text-slate-800 dark:bg-dark-100 dark:text-white" {...props} />
                                                }}
                                            >
                                                {m.content}
                                            </ReactMarkdown>
                                        ) : (
                                            <div className="leading-relaxed">{m.content}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Streaming Message (typewriter effect) */}
                        {loading && streamingContent && (
                            <div className="flex justify-start">
                                <div className="flex max-w-[85%] flex-col gap-1">
                                    <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm dark:border-light-100/20 dark:bg-dark-200 dark:text-white">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                ul: ({ ...props }: any) => <ul className="ml-5 list-disc space-y-1" {...props} />,
                                                ol: ({ ...props }: any) => <ol className="ml-5 list-decimal space-y-1" {...props} />,
                                                li: ({ ...props }: any) => <li className="leading-relaxed" {...props} />,
                                                p: ({ ...props }: any) => <p className="leading-relaxed" {...props} />,
                                                a: ({ ...props }: any) => <a className="text-brand underline hover:text-brand-100" target="_blank" rel="noopener noreferrer" {...props} />,
                                                strong: ({ ...props }: any) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
                                            }}
                                        >
                                            {streamingContent}
                                        </ReactMarkdown>
                                        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-brand"></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Typing indicator before streaming starts */}
                        {loading && !streamingContent && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-light-100/20 dark:bg-dark-200">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            {[0, 150, 300].map((delay, i) => (
                                                <span
                                                    key={i}
                                                    className="size-2 animate-bounce rounded-full bg-brand"
                                                    style={{ animationDelay: `${delay}ms` }}
                                                ></span>
                                            ))}
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-light-200">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Questions */}
                    {messages.length <= 1 && !loading && (
                        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-light-100/20 dark:bg-dark-200">
                            <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-light-200">
                                <Zap className="size-3" />
                                Quick suggestions
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {quickQuestions.map((question, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setInput(question);
                                            setTimeout(() => {
                                                handleSubmit(new Event('submit') as unknown as React.FormEvent);
                                            }, 50);
                                        }}
                                        className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition-all duration-200 hover:scale-105 hover:!border-brand hover:!bg-brand hover:!text-white dark:border-light-100/20 dark:bg-dark-100 dark:text-light-200"
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 bg-white p-4 dark:border-light-100/20 dark:bg-dark-200">
                        <div className="relative flex-1">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask me anything about your files..."
                                disabled={loading}
                                className="pr-10 text-black focus-visible:ring-brand disabled:opacity-50 dark:border-light-100/20 dark:bg-dark-100 dark:text-white"
                            />
                            {input && (
                                <button
                                    type="button"
                                    onClick={() => setInput("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!input.trim() || loading}
                            className="shrink-0"
                        >
                            <Send className={cn("size-4", loading && "animate-pulse")} />
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-light-100/20 dark:bg-dark-100">
                        <p className="text-center text-xs text-slate-500 dark:text-light-200">
                            Powered by AI • Press Enter to send
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
