import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Sparkles, Loader2, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";

const AGENT_NAME = "inventory_assistant";

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
        <span className="font-medium text-stone-700">{label}</span>
        <span className={`ml-auto ${isPending ? "text-stone-400" : isError ? "text-rose-500" : "text-emerald-600"}`}>
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

export default function InventoryAssistantChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const convs = base44.agents.listConversations({ agent_name: AGENT_NAME }) || [];
        let conv = convs[0];
        if (!conv) {
          conv = base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: "Inventory Assistant" },
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
    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      const conv = base44.agents.getConversation(conversationId);
      base44.agents.addMessage(conv, { role: "user", content });
      // Invalidate inventory queries after a short delay so refreshed data appears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["materialTypes"] });
        queryClient.invalidateQueries({ queryKey: ["material-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      }, 2500);
    } catch (err) {
      console.error("Failed to send message", err);
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

  const examples = [
    "I just bought from Houston Acrylic:\n2x Clear Acrylic 1/8\" 12x20 - $14.50\n5x Black Acrylic 1/8\" 12x12 - $22.00\n1x Mirror Acrylic 1/4\" 12x12 - $18.75",
    "Amazon order 8/10/2026:\nBaltic Birch Plywood 1/8\" pack of 5 - $45.99\nMasking tape 2 rolls - $12.50",
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-200">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Inventory Assistant</h3>
            <p className="text-xs text-stone-500">
              Paste a receipt, invoice, or shopping list — it'll create your materials and log the purchases.
            </p>
          </div>
        </div>

        <div className="h-80 overflow-y-auto px-5 py-4 space-y-4 bg-stone-50/50">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-500 mb-4">
                Tell me what you bought and from where. I'll add the materials and log the purchases.
              </p>
              <div className="space-y-2 max-w-md mx-auto">
                {examples.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(ex)}
                    className="w-full text-left text-xs p-3 rounded-lg border border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-stone-600"
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
                <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
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

        <div className="border-t border-stone-200 p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your receipt or list here... (Cmd/Ctrl+Enter to send)"
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="bg-emerald-600 hover:bg-emerald-700 self-end"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}