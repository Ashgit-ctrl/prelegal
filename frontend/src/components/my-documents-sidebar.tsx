"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, Trash2, CheckCircle, Clock, X } from "lucide-react";
import { authFetch } from "@/lib/api";
import { DocumentFieldsUpdate } from "@/types/document";

interface SavedDocument {
  id: number;
  title: string;
  documentType: string | null;
  fields: DocumentFieldsUpdate;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MyDocumentsSidebarProps {
  token: string | null;
  currentDocumentId: number | null;
  refreshTrigger: number;
  onLoad: (doc: SavedDocument) => void;
  onNew: () => void;
  onClose: () => void;
  onDeleteActive?: () => void;
}

function timeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MyDocumentsSidebar({
  token,
  currentDocumentId,
  refreshTrigger,
  onLoad,
  onNew,
  onClose,
  onDeleteActive,
}: MyDocumentsSidebarProps) {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch("/api/documents", token);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  async function handleDelete(e: React.MouseEvent, docId: number) {
    e.stopPropagation();
    if (!token) return;
    setDeletingId(docId);
    try {
      await authFetch(`/api/documents/${docId}`, token, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (docId === currentDocumentId) {
        onDeleteActive?.();
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside
      className="flex flex-col shrink-0 border-r bg-white"
      style={{ width: "280px" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ backgroundColor: "#032147" }}
      >
        <h2 className="text-sm font-semibold text-white">My Documents</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="Close sidebar"
        >
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>

      {/* New Document button */}
      <div className="p-3 border-b shrink-0">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#753991" }}
        >
          <Plus className="h-4 w-4" />
          New Document
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm" style={{ color: "#888888" }}>
            Loading…
          </div>
        ) : documents.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: "#e5e7eb" }} />
            <p className="text-sm" style={{ color: "#888888" }}>
              No documents yet
            </p>
            <p className="text-xs mt-1" style={{ color: "#b0b0b0" }}>
              Start a chat to create your first document
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {documents.map((doc) => {
              const isActive = doc.id === currentDocumentId;
              return (
                <li
                  key={doc.id}
                  onClick={() => onLoad(doc)}
                  className="group px-3 py-3 cursor-pointer transition-colors hover:bg-gray-50"
                  style={isActive ? { backgroundColor: "#f0f9ff" } : {}}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <FileText
                        className="h-4 w-4 mt-0.5 shrink-0"
                        style={{ color: isActive ? "#209dd7" : "#888888" }}
                      />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium truncate leading-tight"
                          style={{ color: isActive ? "#032147" : "#374151" }}
                        >
                          {doc.title}
                        </p>
                        {doc.documentType && (
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "#888888" }}
                          >
                            {doc.documentType}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          {doc.isComplete ? (
                            <CheckCircle className="h-3 w-3" style={{ color: "#16a34a" }} />
                          ) : (
                            <Clock className="h-3 w-3" style={{ color: "#ecad0a" }} />
                          )}
                          <span className="text-xs" style={{ color: "#888888" }}>
                            {doc.isComplete ? "Complete" : "In progress"} ·{" "}
                            {timeAgo(doc.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, doc.id)}
                      disabled={deletingId === doc.id}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                      title="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
