import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, X, Send, Loader2, CheckCircle, AlertCircle, ChevronDown, MessageSquare, Minus, Paperclip, ImageIcon, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

const AGENT_NAME = "maker_assistant";

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const status = toolCall.status;
  const isError = ["failed", "error"].includes(status);
  const isPending = ["pending", "running", "in_progress"].includes(status);

  let icon;
  if (isPending) icon = <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />;
  else if (isError) icon = <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
  else icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;

  const label = toolCall.display_projection?.label || toolCall.name;
  const activeLabel = toolCall.display_projection?.active_label;
  const errorLabel = toolCall.display_projection?.error_label;
  const hideDetails =
    toolCall.display_projection?.hide_details && toolCall.display_projection?.details_redacted;

  const statusText = isPending
    ? activeLabel || "Working..."
    : isError
    ? errorLabel || "Failed"
    : "Done";

  let parsedArgs = toolCall.arguments_string;
  try {
    parsedArgs = JSON.parse(toolCall.arguments_string);
  } catch (_) {}

  let parsedResults = toolCall.results;
  if (typeof toolCall.results === "string") {
    try {
      parsedResults = JSON.parse(toolCall.results);
    } catch (_) {}
  }

  return (
    <div className="mt-2 text-xs border border-stone-200 rounded-lg bg-stone-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-100 transition-colors"
      >
        {icon}
        <span className="font-medium text-stone-700 truncate">{label}</span>
        <span className={`ml-auto shrink-0 ${isPending ? "text-stone-400" : isError ? "text-rose-500" : "text-emerald-600"}`}>
          {statusText}
        </span>
        {!hideDetails && <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`} />}
      </button>
      {!hideDetails && expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-stone-200">
          {parsedArgs && Object.keys(parsedArgs).length > 0 && (
            <div>
              <p className="font-semibold text-stone-500 mb-1">Parameters:</p>
              <pre className="bg-white rounded p-2 overflow-x-auto text-stone-600">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults != null && (
            <div>
              <p className="font-semibold text-stone-500 mb-1">Result:</p>
              <pre className="bg-white rounded p-2 overflow-x-auto text-stone-600 max-h-40">{JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function MakerAssistantWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || sending || uploading) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const conv = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conv, {
        role: "user",
        content: "Please log the items on this receipt photo — extract vendor, purchase date, and each line item, then update inventory stock.",
        file_urls: [file_url],
      });
      setTimeout(() => {
        queryClient.invalidateQueries();
      }, 3000);
    } catch (err) {
      console.error("Failed to upload receipt", err);
      alert("Could not upload receipt: " + (err?.message || err));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv = (convs || [])[0];
        if (!conv) {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: "Maker Assistant" },
          });
        }
        if (!cancelled) {
          setConversationId(conv.id);
          setMessages(conv.messages || []);
        }
      } catch (err) {
        console.error("Failed to init conversation", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!conversationId) return;
    let unsubscribe = () => {};
    try {
      const unsub = base44.agents?.subscribeToConversation?.(conversationId, (data) => {
        setMessages(data.messages || []);
      });
      if (typeof unsub === "function") unsubscribe = unsub;
    } catch (err) {
      console.error("Failed to subscribe to conversation", err);
    }
    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      const conv = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conv, { role: "user", content });
      setTimeout(() => {
        queryClient.invalidateQueries();
      }, 3000);
    } catch (err) {
      console.error("Failed to send message", err);
      alert("Could not send message: " + (err?.message || err));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white pl-4 pr-5 py-3 rounded-full shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 group"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-medium text-sm hidden sm:inline">Maker Assistant</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[420px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Maker Assistant</h3>
              {!minimized && <p className="text-xs text-emerald-100 truncate">Help with materials, sales, quotes, expenses & more</p>}
            </div>
            <a
              href={base44.agents.getWhatsAppConnectURL(AGENT_NAME)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Connect WhatsApp to send receipts from your phone"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <button onClick={() => setMinimized((m) => !m)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title={minimized ? "Expand" : "Minimize"}>
              <Minus className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/50 ${minimized ? "hidden" : ""}`}>
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="p-3 bg-emerald-100 rounded-full w-fit mx-auto mb-3">
                  <Sparkles className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-stone-700 mb-1">Hi! I'm your Maker Assistant</p>
                <p className="text-xs text-stone-500 mb-4">Ask me anything, or paste a receipt to log purchases.</p>
                <div className="space-y-2 text-left">
                  {[
                    "I just bought from Houston Acrylic:\n3x Clear Acrylic 1/8\" 12x20 - $14.50 each\n5x Black Acrylic 1/8\" 12x12 - $22.00 each",
                    "Log a sale: $85 cash from a local customer on 8/12",
                    "Add a business expense: $45.99 Amazon order for Baltic Birch on 8/10",
                  ].map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(ex)}
                      className="w-full text-xs p-2.5 rounded-lg border border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-stone-600 whitespace-pre-wrap"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div key={idx} className={isUser ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[90%] ${isUser ? "" : "w-full"}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2 ${
                        isUser
                          ? "bg-emerald-600 text-white"
                          : "bg-white border border-stone-200 text-stone-800"
                      }`}
                    >
                      {msg.content &&
                        (isUser ? (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                            {msg.content}
                          </ReactMarkdown>
                        ))}
                    </div>
                    {msg.tool_calls?.map((tc, tIdx) => (
                      <FunctionDisplay key={tIdx} toolCall={tc} />
                    ))}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`border-t border-stone-200 p-3 ${minimized ? "hidden" : ""}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything or paste a receipt... (⌘+Enter)"
                rows={2}
                className="resize-none text-sm min-h-[44px] max-h-32"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sending}
                className="h-10 w-10 shrink-0 border-stone-300 text-stone-600 hover:bg-stone-100"
                title="Upload receipt photo"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                size="icon"
                className="bg-emerald-600 hover:bg-emerald-700 h-10 w-10 shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {uploading && (
              <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Uploading receipt…
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}