"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DocumentChat } from "@/components/document-chat";
import { NDAPreview } from "@/components/nda-preview";
import { GenericDocumentPreview } from "@/components/generic-document-preview";
import { DocumentCatalogPanel } from "@/components/document-catalog-panel";
import { DocumentFieldsUpdate, defaultDocumentData, toNDAFormData } from "@/types/document";
import { Separator } from "@/components/ui/separator";
import { FileText, LogOut } from "lucide-react";

interface User {
  name: string;
  email: string;
}

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

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const initialData = defaultDocumentData();
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [fields, setFields] = useState<DocumentFieldsUpdate>(initialData.fields);
  const [isComplete, setIsComplete] = useState(false);

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

  function handleDocumentTypeChange(type: string) {
    setDocumentType(type);
    setIsComplete(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm" style={{ color: "#888888" }}>Loading...</p>
      </div>
    );
  }

  const partyLabels = documentType ? (PARTY_LABELS[documentType] ?? { party1: "Party 1", party2: "Party 2" }) : { party1: "Party 1", party2: "Party 2" };
  const isNDA = documentType === "Mutual Non-Disclosure Agreement";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
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
          {/* Left: AI Chat */}
          <aside className="w-[380px] shrink-0 overflow-hidden flex flex-col">
            <DocumentChat
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
      </main>
    </div>
  );
}
