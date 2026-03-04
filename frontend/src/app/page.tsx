"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NDAChat } from "@/components/nda-chat";
import { NDAPreview } from "@/components/nda-preview";
import { NDAFormData, defaultFormData } from "@/types/nda";
import { Separator } from "@/components/ui/separator";
import { FileText, LogOut } from "lucide-react";

interface User {
  name: string;
  email: string;
}

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState<NDAFormData>(defaultFormData);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/login");
    } else {
      setUser(JSON.parse(stored));
      setLoading(false);
    }
  }, [router]);

  function handleSignOut() {
    localStorage.removeItem("user");
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm" style={{ color: "#888888" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6" style={{ color: "#209dd7" }} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: "#032147" }}>
                Mutual NDA Creator
              </h1>
              <p className="text-xs" style={{ color: "#888888" }}>
                Chat with the AI assistant to generate your Mutual Non-Disclosure Agreement
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: "#888888" }}>
                {user.name}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
                style={{ color: "#888888", borderColor: "#e5e7eb" }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="flex gap-6 h-[calc(100vh-100px)]">
          <aside className="w-[380px] shrink-0 overflow-hidden flex flex-col">
            <NDAChat data={formData} onDataChange={setFormData} />
          </aside>

          <Separator orientation="vertical" />

          <div className="flex-1 overflow-hidden">
            <NDAPreview data={formData} />
          </div>
        </div>
      </main>
    </div>
  );
}
