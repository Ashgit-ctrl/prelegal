"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
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

        {submitted ? (
          <div>
            <div className="rounded-lg px-4 py-4 mb-6 text-sm bg-green-50 border border-green-200 text-green-800">
              If an account with <strong>{email}</strong> exists, you will receive a password reset link shortly. Please check your inbox.
            </div>
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm font-medium hover:underline"
              style={{ color: "#209dd7" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "#032147" }}>
              Forgot your password?
            </h2>
            <p className="text-sm mb-6" style={{ color: "#888888" }}>
              Enter the email address associated with your account and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                disabled={loading}
                className="mt-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "#753991" }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-6">
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: "#209dd7" }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
