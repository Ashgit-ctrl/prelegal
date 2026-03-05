"use client";

import { useState } from "react";
import { Download, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentFieldsUpdate, PartyInfoUpdate } from "@/types/document";

interface GenericDocumentPreviewProps {
  documentType: string;
  fields: DocumentFieldsUpdate;
  isComplete: boolean;
  party1Label?: string;
  party2Label?: string;
}

function FieldValue({
  label,
  value,
  placeholder,
}: {
  label: string;
  value: string | undefined | null;
  placeholder: string;
}) {
  const isEmpty = !value?.trim();
  return (
    <div className="flex py-2 border-b border-gray-100 last:border-0">
      <span className="w-44 shrink-0 text-xs font-medium text-gray-500 pt-0.5">
        {label}
      </span>
      <span
        className={`flex-1 text-sm ${
          isEmpty
            ? "italic"
            : "font-medium"
        }`}
        style={isEmpty ? { color: "#ecad0a", backgroundColor: "#fefce8", padding: "0 4px", borderRadius: "4px" } : { color: "#209dd7" }}
      >
        {isEmpty ? placeholder : value}
      </span>
    </div>
  );
}

function PartySection({
  label,
  party,
}: {
  label: string;
  party?: PartyInfoUpdate | null;
}) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#032147" }}>
        {label}
      </h3>
      <FieldValue label="Company" value={party?.company} placeholder="[Company name]" />
      <FieldValue label="Name" value={party?.printName} placeholder="[Print name]" />
      <FieldValue label="Title" value={party?.title} placeholder="[Title]" />
      <FieldValue label="Notice Address" value={party?.noticeAddress} placeholder="[Address or email]" />
    </div>
  );
}

export function GenericDocumentPreview({
  documentType,
  fields,
  isComplete,
  party1Label = "Party 1 (Provider)",
  party2Label = "Party 2 (Customer)",
}: GenericDocumentPreviewProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const [{ pdf }, { GenericDocumentPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./generic-document-pdf"),
      ]);
      const blob = await pdf(
        <GenericDocumentPDF
          documentType={documentType}
          fields={fields}
          party1Label={party1Label}
          party2Label={party2Label}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentType.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // Build document-specific field rows
  const specificFields: Array<{ label: string; value: string | undefined | null; placeholder: string }> = [];

  if (fields.purpose) specificFields.push({ label: "Purpose", value: fields.purpose, placeholder: "[Purpose]" });
  if (fields.productName !== undefined) specificFields.push({ label: "Product / Service", value: fields.productName, placeholder: "[Product or service name]" });
  if (fields.servicesDescription !== undefined) specificFields.push({ label: "Services Description", value: fields.servicesDescription, placeholder: "[Services description]" });
  if (fields.deliverables !== undefined) specificFields.push({ label: "Deliverables", value: fields.deliverables, placeholder: "[Deliverables]" });
  if (fields.agreementTerm !== undefined) specificFields.push({ label: "Agreement Term", value: fields.agreementTerm, placeholder: "[Term / duration]" });
  if (fields.fees !== undefined) specificFields.push({ label: "Fees", value: fields.fees, placeholder: "[Fee structure]" });
  if (fields.paymentTerms !== undefined) specificFields.push({ label: "Payment Terms", value: fields.paymentTerms, placeholder: "[Payment terms]" });
  if (fields.coveredEntityType !== undefined) specificFields.push({ label: "Covered Entity Type", value: fields.coveredEntityType, placeholder: "[Type of covered entity]" });
  if (fields.processingPurposes !== undefined) specificFields.push({ label: "Processing Purposes", value: fields.processingPurposes, placeholder: "[Purposes for processing data]" });
  if (fields.personalDataTypes !== undefined) specificFields.push({ label: "Personal Data Types", value: fields.personalDataTypes, placeholder: "[Categories of personal data]" });
  if (fields.pilotDuration !== undefined) specificFields.push({ label: "Pilot / Trial Duration", value: fields.pilotDuration, placeholder: "[Duration]" });
  if (fields.pilotScope !== undefined) specificFields.push({ label: "Pilot Scope", value: fields.pilotScope, placeholder: "[Scope of evaluation]" });
  if (fields.feedbackObligations !== undefined) specificFields.push({ label: "Feedback Obligations", value: fields.feedbackObligations, placeholder: "[Feedback requirements]" });
  if (fields.partnershipScope !== undefined) specificFields.push({ label: "Partnership Scope", value: fields.partnershipScope, placeholder: "[Scope of partnership]" });
  if (fields.commissionTerms !== undefined) specificFields.push({ label: "Commission Terms", value: fields.commissionTerms, placeholder: "[Commission structure]" });
  if (fields.uptimeCommitment !== undefined) specificFields.push({ label: "Uptime Commitment", value: fields.uptimeCommitment, placeholder: "[Uptime % SLA]" });
  if (fields.supportLevels !== undefined) specificFields.push({ label: "Support Levels", value: fields.supportLevels, placeholder: "[Support tiers and response times]" });
  if (fields.serviceCreditTerms !== undefined) specificFields.push({ label: "Service Credits", value: fields.serviceCreditTerms, placeholder: "[Credit terms for SLA breach]" });
  if (fields.licenseScope !== undefined) specificFields.push({ label: "License Scope", value: fields.licenseScope, placeholder: "[License type and scope]" });
  if (fields.aiTrainingRestrictions !== undefined) specificFields.push({ label: "AI Training Restrictions", value: fields.aiTrainingRestrictions, placeholder: "[Data training restrictions]" });
  if (fields.baseAgreementRef !== undefined) specificFields.push({ label: "Base Agreement", value: fields.baseAgreementRef, placeholder: "[Main agreement this supplements]" });

  // NDA-specific fields
  if (fields.mndaTermType !== undefined || fields.mndaTermYears !== undefined) {
    const termText = fields.mndaTermType === "until-terminated"
      ? "Until terminated"
      : fields.mndaTermYears
        ? `${fields.mndaTermYears} year(s) from Effective Date`
        : null;
    specificFields.push({ label: "MNDA Term", value: termText, placeholder: "[MNDA term]" });
  }
  if (fields.confidentialityTermType !== undefined || fields.confidentialityTermYears !== undefined) {
    const confText = fields.confidentialityTermType === "perpetuity"
      ? "In perpetuity"
      : fields.confidentialityTermYears
        ? `${fields.confidentialityTermYears} year(s)`
        : null;
    specificFields.push({ label: "Confidentiality Term", value: confText, placeholder: "[Confidentiality term]" });
  }
  if (fields.modifications !== undefined) specificFields.push({ label: "Modifications", value: fields.modifications || "None", placeholder: "[Modifications]" });

  return (
    <div className="h-full flex flex-col rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#032147" }}>
              {documentType}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#888888" }}>
              Cover Page Preview — fields update as you chat
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="sm"
            className="text-white shrink-0"
            style={{ backgroundColor: "#753991" }}
          >
            {downloading ? (
              "Generating…"
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                Download PDF
              </>
            )}
          </Button>
        </div>

        {isComplete && (
          <div className="mt-3 flex items-center gap-2 text-xs font-medium" style={{ color: "#16a34a" }}>
            <CheckCircle className="h-4 w-4" />
            All information collected — document is ready to download
          </div>
        )}
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Date */}
        <div className="mb-4">
          <FieldValue
            label="Effective Date"
            value={fields.effectiveDate}
            placeholder="[Effective date]"
          />
          <FieldValue
            label="Governing Law"
            value={fields.governingLaw}
            placeholder="[State / jurisdiction]"
          />
          <FieldValue
            label="Jurisdiction"
            value={fields.jurisdiction}
            placeholder="[Court jurisdiction]"
          />
        </div>

        {/* Document-specific fields */}
        {specificFields.length > 0 && (
          <div className="mb-4">
            <h3
              className="text-xs font-bold uppercase tracking-wide mb-2"
              style={{ color: "#032147" }}
            >
              Key Terms
            </h3>
            {specificFields.map((f, i) => (
              <FieldValue key={i} label={f.label} value={f.value} placeholder={f.placeholder} />
            ))}
          </div>
        )}

        {/* Parties */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <PartySection label={party1Label} party={fields.party1} />
          <PartySection label={party2Label} party={fields.party2} />
        </div>

        {/* Signature block */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <td className="px-3 py-2 w-28 font-medium text-gray-500" />
                <td className="px-3 py-2 font-bold text-center" style={{ color: "#032147" }}>
                  {party1Label}
                </td>
                <td className="px-3 py-2 font-bold text-center" style={{ color: "#032147" }}>
                  {party2Label}
                </td>
              </tr>
            </thead>
            <tbody>
              {["Signature", "Print Name", "Title", "Company", "Date"].map((row) => (
                <tr key={row} className="border-t">
                  <td className="px-3 py-2 font-medium text-gray-500 bg-gray-50">{row}</td>
                  <td className="px-3 py-2 text-gray-300 text-center">&nbsp;</td>
                  <td className="px-3 py-2 text-gray-300 text-center">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
