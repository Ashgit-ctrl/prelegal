export interface PartyInfo {
  company: string;
  printName: string;
  title: string;
  noticeAddress: string;
}

export const defaultParty: PartyInfo = {
  company: "",
  printName: "",
  title: "",
  noticeAddress: "",
};

/** Partial party update — all fields optional and nullable (null = no change) */
export interface PartyInfoUpdate {
  company?: string | null;
  printName?: string | null;
  title?: string | null;
  noticeAddress?: string | null;
}

/** Unified field model for all document types — mirrors backend DocumentFieldsUpdate */
export interface DocumentFieldsUpdate {
  // Common
  effectiveDate?: string | null;
  governingLaw?: string | null;
  jurisdiction?: string | null;
  party1?: PartyInfoUpdate | null;
  party2?: PartyInfoUpdate | null;

  // NDA-specific
  purpose?: string | null;
  mndaTermType?: "expires" | "until-terminated" | null;
  mndaTermYears?: number | null;
  confidentialityTermType?: "years" | "perpetuity" | null;
  confidentialityTermYears?: number | null;
  modifications?: string | null;

  // Product / service name
  productName?: string | null;

  // Term / duration
  agreementTerm?: string | null;

  // Fees
  fees?: string | null;
  paymentTerms?: string | null;

  // Services / deliverables
  servicesDescription?: string | null;
  deliverables?: string | null;

  // BAA
  coveredEntityType?: string | null;

  // DPA
  processingPurposes?: string | null;
  personalDataTypes?: string | null;

  // Design Partner / Pilot
  pilotDuration?: string | null;
  feedbackObligations?: string | null;
  pilotScope?: string | null;

  // Partnership
  partnershipScope?: string | null;
  commissionTerms?: string | null;

  // SLA
  uptimeCommitment?: string | null;
  supportLevels?: string | null;
  serviceCreditTerms?: string | null;

  // Software License
  licenseScope?: string | null;

  // AI Addendum
  aiTrainingRestrictions?: string | null;
  baseAgreementRef?: string | null;
}

/** The current state of a document being drafted */
export interface DocumentData {
  documentType: string | null;
  fields: DocumentFieldsUpdate;
}

export function defaultDocumentData(): DocumentData {
  const today = new Date().toISOString().split("T")[0];
  return {
    documentType: null,
    fields: {
      effectiveDate: today,
    },
  };
}

/** Merge a partial fields update into existing fields */
export function mergeDocumentFields(
  current: DocumentFieldsUpdate,
  updates: DocumentFieldsUpdate
): DocumentFieldsUpdate {
  const merged: DocumentFieldsUpdate = { ...current };

  // Simple scalar fields
  const scalarFields = [
    "effectiveDate", "governingLaw", "jurisdiction",
    "purpose", "mndaTermType", "mndaTermYears", "confidentialityTermType",
    "confidentialityTermYears", "modifications",
    "productName", "agreementTerm", "fees", "paymentTerms",
    "servicesDescription", "deliverables", "coveredEntityType",
    "processingPurposes", "personalDataTypes",
    "pilotDuration", "feedbackObligations", "pilotScope",
    "partnershipScope", "commissionTerms",
    "uptimeCommitment", "supportLevels", "serviceCreditTerms",
    "licenseScope", "aiTrainingRestrictions", "baseAgreementRef",
  ] as const;

  for (const key of scalarFields) {
    if (updates[key] != null) {
      (merged as Record<string, unknown>)[key] = updates[key];
    }
  }

  // Party objects — merge field by field (null means "no change")
  if (updates.party1 != null) {
    merged.party1 = {
      company: updates.party1.company != null ? updates.party1.company : current.party1?.company,
      printName: updates.party1.printName != null ? updates.party1.printName : current.party1?.printName,
      title: updates.party1.title != null ? updates.party1.title : current.party1?.title,
      noticeAddress: updates.party1.noticeAddress != null ? updates.party1.noticeAddress : current.party1?.noticeAddress,
    };
  }
  if (updates.party2 != null) {
    merged.party2 = {
      company: updates.party2.company != null ? updates.party2.company : current.party2?.company,
      printName: updates.party2.printName != null ? updates.party2.printName : current.party2?.printName,
      title: updates.party2.title != null ? updates.party2.title : current.party2?.title,
      noticeAddress: updates.party2.noticeAddress != null ? updates.party2.noticeAddress : current.party2?.noticeAddress,
    };
  }

  return merged;
}

/** Map DocumentFieldsUpdate to NDAFormData for the existing NDA preview component */
export function toNDAFormData(fields: DocumentFieldsUpdate) {
  const today = new Date().toISOString().split("T")[0];
  return {
    purpose: fields.purpose ?? "",
    effectiveDate: fields.effectiveDate ?? today,
    mndaTermType: (fields.mndaTermType ?? "expires") as "expires" | "until-terminated",
    mndaTermYears: fields.mndaTermYears ?? 1,
    confidentialityTermType: (fields.confidentialityTermType ?? "years") as "years" | "perpetuity",
    confidentialityTermYears: fields.confidentialityTermYears ?? 1,
    governingLaw: fields.governingLaw ?? "",
    jurisdiction: fields.jurisdiction ?? "",
    modifications: fields.modifications ?? "",
    party1: {
      company: fields.party1?.company ?? "",
      printName: fields.party1?.printName ?? "",
      title: fields.party1?.title ?? "",
      noticeAddress: fields.party1?.noticeAddress ?? "",
    },
    party2: {
      company: fields.party2?.company ?? "",
      printName: fields.party2?.printName ?? "",
      title: fields.party2?.title ?? "",
      noticeAddress: fields.party2?.noticeAddress ?? "",
    },
  };
}

export const CATALOG: Array<{ name: string; description: string; filename: string }> = [
  { name: "AI Addendum", description: "An addendum governing the use of AI services within a broader service agreement.", filename: "templates/AI-Addendum.md" },
  { name: "Business Associate Agreement", description: "A HIPAA-compliant agreement governing the relationship between a covered entity and a business associate that handles protected health information.", filename: "templates/BAA.md" },
  { name: "Cloud Service Agreement", description: "A comprehensive agreement for cloud-hosted software services.", filename: "templates/CSA.md" },
  { name: "Data Processing Agreement", description: "A GDPR-compliant agreement governing how a data processor handles personal data on behalf of a data controller.", filename: "templates/DPA.md" },
  { name: "Design Partner Agreement", description: "An agreement for early-stage design partnerships where a customer provides feedback in exchange for early access.", filename: "templates/design-partner-agreement.md" },
  { name: "Mutual Non-Disclosure Agreement", description: "A bilateral confidentiality agreement for protecting sensitive information shared between two parties.", filename: "templates/Mutual-NDA.md" },
  { name: "Partnership Agreement", description: "An agreement governing a reseller or referral partnership.", filename: "templates/Partnership-Agreement.md" },
  { name: "Pilot Agreement", description: "A short-term trial agreement allowing a customer to evaluate a provider's product.", filename: "templates/Pilot-Agreement.md" },
  { name: "Professional Services Agreement", description: "An agreement governing the delivery of professional or consulting services.", filename: "templates/psa.md" },
  { name: "Service Level Agreement", description: "An agreement defining the service quality commitments for a cloud service.", filename: "templates/sla.md" },
  { name: "Software License Agreement", description: "An agreement for on-premise or self-hosted software licensing.", filename: "templates/Software-License-Agreement.md" },
];
