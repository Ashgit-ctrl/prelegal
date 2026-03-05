"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DocumentFieldsUpdate,
  mergeDocumentFields,
} from "@/types/document";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatApiResponse {
  message: string;
  documentType: string | null;
  fields: DocumentFieldsUpdate;
  isComplete: boolean;
}

interface DocumentChatProps {
  documentType: string | null;
  fields: DocumentFieldsUpdate;
  onDocumentTypeChange: (type: string) => void;
  onFieldsChange: (fields: DocumentFieldsUpdate) => void;
  onComplete: (complete: boolean) => void;
}

export function DocumentChat({
  documentType,
  fields,
  onDocumentTypeChange,
  onFieldsChange,
  onComplete,
}: DocumentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function fetchAIResponse(
    history: Message[],
    currentFields: DocumentFieldsUpdate,
    currentDocType: string | null
  ) {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          currentData: currentFields,
          documentType: currentDocType,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const result: ChatApiResponse = await res.json();

      setMessages([
        ...history,
        { role: "assistant", content: result.message },
      ]);

      const merged = mergeDocumentFields(currentFields, result.fields ?? {});
      onFieldsChange(merged);

      if (result.documentType && result.documentType !== currentDocType) {
        onDocumentTypeChange(result.documentType);
      }

      if (result.isComplete) {
        onComplete(true);
      }
    } catch {
      setMessages([
        ...history,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetchAIResponse([], fields, documentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Restore focus to the textarea after loading completes
  useEffect(() => {
    if (!loading) {
      textareaRef.current?.focus();
    }
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const updated: Message[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    await fetchAIResponse(updated, fields, documentType);
  }

  return (
    <div className="flex flex-col h-full rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b shrink-0"
        style={{ backgroundColor: "#032147" }}
      >
        <h2 className="text-sm font-semibold text-white">AI Legal Assistant</h2>
        {documentType && (
          <p className="text-xs mt-0.5" style={{ color: "#ecad0a" }}>
            Drafting: {documentType}
          </p>
        )}
        {!documentType && (
          <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
            Tell me what legal document you need
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white"
                  : "bg-white border text-gray-800"
              }`}
              style={
                msg.role === "user" ? { backgroundColor: "#753991" } : {}
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-2xl px-3.5 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t bg-gray-50 shrink-0 flex gap-2 items-end"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Type your message…"
          className="resize-none text-sm min-h-[40px] max-h-[120px]"
          rows={1}
          disabled={loading}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || loading}
          className="shrink-0 text-white"
          style={{ backgroundColor: "#753991" }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
