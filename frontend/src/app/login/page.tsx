"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    localStorage.setItem("user", JSON.stringify({ name: name.trim(), email: email.trim() }));
    router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8" style={{ color: "#209dd7" }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#032147" }}>
              Prelegal
            </h1>
            <p className="text-sm" style={{ color: "#888888" }}>
              AI-powered legal document drafting
            </p>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-6" style={{ color: "#032147" }}>
          Sign in to your account
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "#032147" }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "#e5e7eb", color: "#032147" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "#032147" }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              required
              className="border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: "#e5e7eb", color: "#032147" }}
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#753991" }}
          >
            Continue to Prelegal
          </button>
        </form>
      </div>
    </div>
  );
}
