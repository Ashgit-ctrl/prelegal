"use client";

import { CATALOG } from "@/types/document";
import { FileText } from "lucide-react";

export function DocumentCatalogPanel() {
  return (
    <div className="h-full flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b" style={{ backgroundColor: "#032147" }}>
        <h2 className="text-sm font-semibold text-white">Supported Documents</h2>
        <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
          Tell the AI which document you need
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {CATALOG.map((doc) => (
          <div
            key={doc.name}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#209dd7" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "#032147" }}>
                {doc.name}
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#888888" }}>
                {doc.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
