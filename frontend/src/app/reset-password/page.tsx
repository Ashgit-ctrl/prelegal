"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Failed to reset password. The link may have expired.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <div className="rounded-lg px-4 py-3 mb-6 text-sm bg-red-50 border border-red-200 text-red-700">
          Invalid or missing reset token. Please request a new password reset link.
        </div>
        <Link
          href="/forgot-password"
          className="flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: "#209dd7" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Request a new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="rounded-lg px-4 py-4 mb-6 text-sm bg-green-50 border border-green-200 text-green-800">
          Your password has been reset successfully. Redirecting you to sign in…
        </div>
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: "#209dd7" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "#032147" }}>
        Set a new password
      </h2>
      <p className="text-sm mb-6" style={{ color: "#888888" }}>
        Choose a strong password for your Prelegal account.
      </p>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: "#032147" }}>
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            className="border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: "#e5e7eb", color: "#032147" }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: "#032147" }}>
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
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
          {loading ? "Resetting…" : "Reset Password"}
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
  );
}

export default function ResetPasswordPage() {
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

        <Suspense fallback={<p className="text-sm text-gray-500">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
