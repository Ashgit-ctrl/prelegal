"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DocumentChat } from "@/components/document-chat";
import { NDAPreview } from "@/components/nda-preview";
import { GenericDocumentPreview } from "@/components/generic-document-preview";
import { DocumentCatalogPanel } from "@/components/document-catalog-panel";
import { MyDocumentsSidebar } from "@/components/my-documents-sidebar";
import { DocumentFieldsUpdate, defaultDocumentData, toNDAFormData } from "@/types/document";
import { Separator } from "@/components/ui/separator";
import { FileText, LogOut, FolderOpen } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { authFetch } from "@/lib/api";

/** Party labels for each document type */
const PARTY_LABELS: Record<string, { party1: string; party2: string }> = {
  "AI Addendum": { party1: "Provider", party2: "Customer" },
  "Business Associate Agreement": { party1: "Provider (Business Associate)", party2: "Covered Entity" },
  "Cloud Service Agreement": { party1: "Provider", party2: "Customer" },
  "Data Processing Agreement": { party1: "Processor (Provider)", party2: "Controller (Customer)" },
  "Design Partner Agreement": { party1: "Provider", party2: "Design Partner" },
  "Mutual Non-Disclosure Agreement": { party1: "Party 1", party2: "Party 2" },
  "Partnership Agreement": { party1: "Vendor / Provider", party2: "Partner" },
  "Pilot Agreement": { party1: "Provider", party2: "Customer" },
  "Professional Services Agreement": { party1: "Service Provider", party2: "Client" },
  "Service Level Agreement": { party1: "Provider", party2: "Customer" },
  "Software License Agreement": { party1: "Licensor", party2: "Licensee" },
};

function generateDocumentTitle(
  documentType: string | null,
  fields: DocumentFieldsUpdate
): string {
  if (!documentType) return "Untitled Document";
  const p1 = fields.party1?.company;
  const p2 = fields.party2?.company;
  if (p1 && p2) return `${p1} × ${p2}`;
  if (p1) return `${p1} — ${documentType}`;
  return documentType;
}

export default function Home() {
  const router = useRouter();
  const { user, token, logout, isLoading } = useAuth();

  const initialData = defaultDocumentData();
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [fields, setFields] = useState<DocumentFieldsUpdate>(initialData.fields);
  const [isComplete, setIsComplete] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  // Document persistence
  const [currentDocumentId, setCurrentDocumentId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const isSavingRef = useRef(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  // Auto-save whenever fields, isComplete, or documentType changes
  const prevDocumentTypeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!documentType || !token || isSavingRef.current) return;

    isSavingRef.current = true;
    const title = generateDocumentTitle(documentType, fields);
    const body = JSON.stringify({ title, documentType, fields, isComplete });
    const savedId = currentDocumentId;

    (async () => {
      try {
        if (savedId) {
          await authFetch(`/api/documents/${savedId}`, token, { method: "PUT", body });
        } else {
          const res = await authFetch("/api/documents", token, { method: "POST", body });
          if (res.ok) {
            const data = await res.json();
            setCurrentDocumentId(data.id);
          }
        }
        setSidebarRefresh((n) => n + 1);
      } catch {
        // ignore save errors silently
      } finally {
        isSavingRef.current = false;
      }
    })();
  }, [fields, isComplete, documentType]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSignOut() {
    logout();
    router.push("/login");
  }

  function handleDocumentTypeChange(type: string) {
    setDocumentType(type);
    setIsComplete(false);
  }

  function handleNew() {
    setDocumentType(null);
    setFields(initialData.fields);
    setIsComplete(false);
    setCurrentDocumentId(null);
    prevDocumentTypeRef.current = null;
    setChatKey((k) => k + 1);
  }

  function handleLoadDocument(doc: {
    id: number;
    documentType: string | null;
    fields: DocumentFieldsUpdate;
    isComplete: boolean;
  }) {
    setDocumentType(doc.documentType);
    setFields(doc.fields as DocumentFieldsUpdate);
    setIsComplete(doc.isComplete);
    setCurrentDocumentId(doc.id);
    prevDocumentTypeRef.current = doc.documentType;
    setChatKey((k) => k + 1);
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm" style={{ color: "#888888" }}>Loading…</p>
      </div>
    );
  }

  const partyLabels = documentType
    ? (PARTY_LABELS[documentType] ?? { party1: "Party 1", party2: "Party 2" })
    : { party1: "Party 1", party2: "Party 2" };
  const isNDA = documentType === "Mutual Non-Disclosure Agreement";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6" style={{ color: "#209dd7" }} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: "#032147" }}>
                Prelegal
              </h1>
              <p className="text-xs" style={{ color: "#888888" }}>
                {documentType
                  ? `Drafting: ${documentType}`
                  : "AI-powered legal document assistant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors"
              style={
                sidebarOpen
                  ? { backgroundColor: "#032147", color: "white", borderColor: "#032147" }
                  : { color: "#888888", borderColor: "#e5e7eb" }
              }
            >
              <FolderOpen className="h-4 w-4" />
              My Documents
            </button>

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
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* My Documents Sidebar */}
        {sidebarOpen && (
          <MyDocumentsSidebar
            token={token}
            currentDocumentId={currentDocumentId}
            refreshTrigger={sidebarRefresh}
            onLoad={handleLoadDocument}
            onNew={handleNew}
            onClose={() => setSidebarOpen(false)}
            onDeleteActive={handleNew}
          />
        )}

        {/* Chat + Preview */}
        <div className="flex flex-1 gap-6 p-6 overflow-hidden min-h-0">
          {/* Left: AI Chat */}
          <aside className="w-[380px] shrink-0 overflow-hidden flex flex-col">
            <DocumentChat
              key={chatKey}
              documentType={documentType}
              fields={fields}
              onDocumentTypeChange={handleDocumentTypeChange}
              onFieldsChange={setFields}
              onComplete={setIsComplete}
            />
          </aside>

          <Separator orientation="vertical" />

          {/* Right: Preview */}
          <div className="flex-1 overflow-hidden">
            {!documentType ? (
              <DocumentCatalogPanel />
            ) : isNDA ? (
              <NDAPreview data={toNDAFormData(fields)} />
            ) : (
              <GenericDocumentPreview
                documentType={documentType}
                fields={fields}
                isComplete={isComplete}
                party1Label={partyLabels.party1}
                party2Label={partyLabels.party2}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
