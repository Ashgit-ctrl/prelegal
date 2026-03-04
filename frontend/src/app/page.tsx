"use client";

import { useState } from "react";
import { NDAForm } from "@/components/nda-form";
import { NDAPreview } from "@/components/nda-preview";
import { NDAFormData, defaultFormData } from "@/types/nda";
import { Separator } from "@/components/ui/separator";
import { FileText } from "lucide-react";

export default function Home() {
  const [formData, setFormData] = useState<NDAFormData>(defaultFormData);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold">Mutual NDA Creator</h1>
            <p className="text-xs text-muted-foreground">
              Fill in the form to generate your Mutual Non-Disclosure Agreement
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="flex gap-6 h-[calc(100vh-100px)]">
          {/* Left: Form */}
          <aside className="w-[380px] shrink-0 overflow-y-auto pr-2">
            <NDAForm data={formData} onChange={setFormData} />
          </aside>

          <Separator orientation="vertical" />

          {/* Right: Preview */}
          <div className="flex-1 overflow-hidden">
            <NDAPreview data={formData} />
          </div>
        </div>
      </main>
    </div>
  );
}
