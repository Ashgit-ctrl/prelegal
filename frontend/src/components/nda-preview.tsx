"use client";

import { useState, useCallback } from "react";
import { NDAFormData } from "@/types/nda";
import { Button } from "@/components/ui/button";
import { formatDate, getMndaTermText, getConfidentialityTermText, STANDARD_TERMS } from "@/lib/nda-template";
import { Download } from "lucide-react";

interface NDAPreviewProps {
  data: NDAFormData;
}

function Placeholder({ value, fallback }: { value: string; fallback: string }) {
  const display = value.trim() || fallback;
  const isEmpty = !value.trim();
  return (
    <span
      className={
        isEmpty
          ? "bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-300 italic"
          : "font-medium text-blue-900"
      }
    >
      {display}
    </span>
  );
}

function CoverPage({ data }: { data: NDAFormData }) {
  const mndaTermText =
    data.mndaTermType === "expires"
      ? `Expires ${data.mndaTermYears} ${data.mndaTermYears === 1 ? "year" : "years"} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";

  const confidentialityText =
    data.confidentialityTermType === "years"
      ? `${data.confidentialityTermYears} ${data.confidentialityTermYears === 1 ? "year" : "years"} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  return (
    <div className="space-y-6">
      <div className="text-center border-b pb-6">
        <h1 className="text-2xl font-bold">Mutual Non-Disclosure Agreement</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Common Paper Mutual NDA Standard Terms Version 1.0
        </p>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          This Mutual Non-Disclosure Agreement (the &ldquo;MNDA&rdquo;) consists of: (1) this
          Cover Page and (2) the Common Paper Mutual NDA Standard Terms Version
          1.0. Any modifications of the Standard Terms should be made on the
          Cover Page, which will control over conflicts with the Standard Terms.
        </p>
      </div>

      <div className="space-y-5">
        <CoverRow label="Purpose" sublabel="How Confidential Information may be used">
          <p className="text-sm">
            <Placeholder
              value={data.purpose}
              fallback="[Enter purpose]"
            />
          </p>
        </CoverRow>

        <CoverRow label="Effective Date">
          <p className="text-sm font-medium">
            {data.effectiveDate ? formatDate(data.effectiveDate) : <span className="text-yellow-700 italic">[Enter effective date]</span>}
          </p>
        </CoverRow>

        <CoverRow label="MNDA Term" sublabel="The length of this MNDA">
          <p className="text-sm">{mndaTermText}</p>
        </CoverRow>

        <CoverRow label="Term of Confidentiality" sublabel="How long Confidential Information is protected">
          <p className="text-sm">{confidentialityText}</p>
        </CoverRow>

        <CoverRow label="Governing Law & Jurisdiction">
          <p className="text-sm">
            Governing Law:{" "}
            <Placeholder
              value={data.governingLaw}
              fallback="[Enter state]"
            />
          </p>
          <p className="text-sm mt-1">
            Jurisdiction:{" "}
            <Placeholder
              value={data.jurisdiction}
              fallback="[Enter city/county and state]"
            />
          </p>
        </CoverRow>

        {data.modifications && (
          <CoverRow label="MNDA Modifications">
            <p className="text-sm whitespace-pre-wrap">{data.modifications}</p>
          </CoverRow>
        )}
      </div>

      <div className="mt-8">
        <p className="text-sm text-muted-foreground mb-4">
          By signing this Cover Page, each party agrees to enter into this MNDA
          as of the Effective Date.
        </p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 w-1/3 font-medium"></td>
              <td className="border border-gray-300 p-2 bg-gray-50 text-center font-medium">
                <Placeholder value={data.party1.company} fallback="PARTY 1" />
              </td>
              <td className="border border-gray-300 p-2 bg-gray-50 text-center font-medium">
                <Placeholder value={data.party2.company} fallback="PARTY 2" />
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 font-medium">Signature</td>
              <td className="border border-gray-300 p-2 h-12"></td>
              <td className="border border-gray-300 p-2 h-12"></td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 font-medium">Print Name</td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party1.printName} fallback="" />
              </td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party2.printName} fallback="" />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 font-medium">Title</td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party1.title} fallback="" />
              </td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party2.title} fallback="" />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 font-medium">Company</td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party1.company} fallback="" />
              </td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party2.company} fallback="" />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 font-medium">
                Notice Address
              </td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party1.noticeAddress} fallback="" />
              </td>
              <td className="border border-gray-300 p-2">
                <Placeholder value={data.party2.noticeAddress} fallback="" />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2 bg-gray-50 font-medium">Date</td>
              <td className="border border-gray-300 p-2"></td>
              <td className="border border-gray-300 p-2"></td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">
          Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to
          use under CC BY 4.0.
        </p>
      </div>
    </div>
  );
}

function CoverRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b last:border-b-0">
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function StandardTermsSection({ data }: { data: NDAFormData }) {
  const purpose = escapeHtml(data.purpose.trim() || "[Purpose]");
  const effectiveDate = data.effectiveDate ? formatDate(data.effectiveDate) : "[Effective Date]";
  const mndaTerm = getMndaTermText(data);
  const confidentialityTerm = getConfidentialityTermText(data);
  const governingLaw = escapeHtml(data.governingLaw.trim() || "[Governing Law State]");
  const jurisdiction = escapeHtml(data.jurisdiction.trim() || "[Jurisdiction]");

  const html = STANDARD_TERMS
    .replace(/class="coverpage-value purpose-value"><\/em>/g, `class="coverpage-value purpose-value">${purpose}</em>`)
    .replace(/class="coverpage-value effective-date-value"><\/em>/g, `class="coverpage-value effective-date-value">${effectiveDate}</em>`)
    .replace(/class="coverpage-value mnda-term-value"><\/em>/g, `class="coverpage-value mnda-term-value">${mndaTerm}</em>`)
    .replace(/class="coverpage-value confidentiality-term-value"><\/em>/g, `class="coverpage-value confidentiality-term-value">${confidentialityTerm}</em>`)
    .replace(/class="coverpage-value governing-law-value"><\/em>/g, `class="coverpage-value governing-law-value">${governingLaw}</em>`)
    .replace(/class="coverpage-value jurisdiction-value"><\/em>/g, `class="coverpage-value jurisdiction-value">${jurisdiction}</em>`);

  return (
    <div
      className="nda-standard-terms prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function NDAPreview({ data }: NDAPreviewProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const [{ pdf }, { NDADocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./nda-pdf-document"),
      ]);
      const blob = await pdf(<NDADocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Mutual-NDA.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [data]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Document Preview</h2>
        <Button onClick={handleDownload} size="sm" className="gap-2" disabled={downloading}>
          <Download className="h-4 w-4" />
          {downloading ? "Generating PDF…" : "Download PDF"}
        </Button>
      </div>

      <div
        className="flex-1 bg-white border rounded-lg p-8 overflow-auto shadow-sm text-gray-900"
        style={{ fontFamily: "Georgia, serif", fontSize: "14px", lineHeight: "1.6" }}
      >
        <CoverPage data={data} />

        <div className="mt-12 pt-8 border-t-2">
          <StandardTermsSection data={data} />
        </div>
      </div>
    </div>
  );
}
