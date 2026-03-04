"use client";

import { useState, useEffect, useRef } from "react";
import { NDAFormData } from "@/types/nda";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PartyDetailsUpdate {
  company?: string | null;
  printName?: string | null;
  title?: string | null;
  noticeAddress?: string | null;
}

interface NDAFieldsUpdate {
  purpose?: string | null;
  effectiveDate?: string | null;
  mndaTermType?: "expires" | "until-terminated" | null;
  mndaTermYears?: number | null;
  confidentialityTermType?: "years" | "perpetuity" | null;
  confidentialityTermYears?: number | null;
  governingLaw?: string | null;
  jurisdiction?: string | null;
  modifications?: string | null;
  party1?: PartyDetailsUpdate | null;
  party2?: PartyDetailsUpdate | null;
}

interface ChatApiResponse {
  message: string;
  fields: NDAFieldsUpdate;
}

interface NDAChatProps {
  data: NDAFormData;
  onDataChange: (data: NDAFormData) => void;
}

function mergeFields(current: NDAFormData, updates: NDAFieldsUpdate): NDAFormData {
  const merged = { ...current };
  if (updates.purpose != null) merged.purpose = updates.purpose;
  if (updates.effectiveDate != null) merged.effectiveDate = updates.effectiveDate;
  if (updates.mndaTermType != null) merged.mndaTermType = updates.mndaTermType;
  if (updates.mndaTermYears != null) merged.mndaTermYears = updates.mndaTermYears;
  if (updates.confidentialityTermType != null) merged.confidentialityTermType = updates.confidentialityTermType;
  if (updates.confidentialityTermYears != null) merged.confidentialityTermYears = updates.confidentialityTermYears;
  if (updates.governingLaw != null) merged.governingLaw = updates.governingLaw;
  if (updates.jurisdiction != null) merged.jurisdiction = updates.jurisdiction;
  if (updates.modifications != null) merged.modifications = updates.modifications;
  if (updates.party1 != null) {
    merged.party1 = {
      company: updates.party1.company ?? current.party1.company,
      printName: updates.party1.printName ?? current.party1.printName,
      title: updates.party1.title ?? current.party1.title,
      noticeAddress: updates.party1.noticeAddress ?? current.party1.noticeAddress,
    };
  }
  if (updates.party2 != null) {
    merged.party2 = {
      company: updates.party2.company ?? current.party2.company,
      printName: updates.party2.printName ?? current.party2.printName,
      title: updates.party2.title ?? current.party2.title,
      noticeAddress: updates.party2.noticeAddress ?? current.party2.noticeAddress,
    };
  }
  return merged;
}

export function NDAChat({ data, onDataChange }: NDAChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetchAIResponse([], data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAIResponse(history: Message[], currentData: NDAFormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currentData }),
      });
      if (!res.ok) throw new Error("Chat request failed");
      const result: ChatApiResponse = await res.json();
      setMessages([...history, { role: "assistant", content: result.message }]);
      onDataChange(mergeFields(currentData, result.fields));
    } catch {
      setMessages([
        ...history,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newHistory: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newHistory);
    await fetchAIResponse(newHistory, data);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white rounded-br-sm"
                  : "bg-white border rounded-bl-sm text-gray-800"
              }`}
              style={msg.role === "user" ? { backgroundColor: "#753991" } : {}}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2 shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Type your message…"
          className="flex-1 rounded-xl"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !input.trim()}
          className="rounded-xl shrink-0"
          style={{ backgroundColor: "#753991" }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
