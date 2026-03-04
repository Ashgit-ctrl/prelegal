import {
  mergeDocumentFields,
  toNDAFormData,
  defaultDocumentData,
  DocumentFieldsUpdate,
  CATALOG,
} from "../types/document";

describe("mergeDocumentFields", () => {
  it("returns current when updates are empty", () => {
    const current: DocumentFieldsUpdate = { effectiveDate: "2026-01-01", governingLaw: "Delaware" };
    const result = mergeDocumentFields(current, {});
    expect(result.effectiveDate).toBe("2026-01-01");
    expect(result.governingLaw).toBe("Delaware");
  });

  it("merges scalar fields from updates", () => {
    const current: DocumentFieldsUpdate = { governingLaw: "Delaware" };
    const updates: DocumentFieldsUpdate = { governingLaw: "California", jurisdiction: "San Francisco courts" };
    const result = mergeDocumentFields(current, updates);
    expect(result.governingLaw).toBe("California");
    expect(result.jurisdiction).toBe("San Francisco courts");
  });

  it("ignores null values in updates", () => {
    const current: DocumentFieldsUpdate = { effectiveDate: "2026-01-01" };
    const updates: DocumentFieldsUpdate = { effectiveDate: null, purpose: null };
    const result = mergeDocumentFields(current, updates);
    expect(result.effectiveDate).toBe("2026-01-01");
    expect(result.purpose).toBeUndefined();
  });

  it("merges party1 field by field", () => {
    const current: DocumentFieldsUpdate = {
      party1: { company: "Acme", printName: "John", title: "CEO", noticeAddress: "123 Main" },
    };
    const updates: DocumentFieldsUpdate = {
      party1: { company: "Acme Updated", printName: null },
    };
    const result = mergeDocumentFields(current, updates);
    expect(result.party1?.company).toBe("Acme Updated");
    expect(result.party1?.printName).toBe("John"); // null means no change
    expect(result.party1?.title).toBe("CEO");
  });

  it("merges party2 independently of party1", () => {
    const current: DocumentFieldsUpdate = {
      party1: { company: "Provider Inc." },
      party2: { company: "Customer Ltd." },
    };
    const updates: DocumentFieldsUpdate = {
      party2: { company: "Customer Updated Ltd." },
    };
    const result = mergeDocumentFields(current, updates);
    expect(result.party1?.company).toBe("Provider Inc.");
    expect(result.party2?.company).toBe("Customer Updated Ltd.");
  });

  it("handles undefined party in current when update provides one", () => {
    const current: DocumentFieldsUpdate = {};
    const updates: DocumentFieldsUpdate = {
      party1: { company: "NewCo", printName: "Alice" },
    };
    const result = mergeDocumentFields(current, updates);
    expect(result.party1?.company).toBe("NewCo");
    expect(result.party1?.printName).toBe("Alice");
  });

  it("merges all document-specific fields", () => {
    const current: DocumentFieldsUpdate = { productName: "OldApp" };
    const updates: DocumentFieldsUpdate = {
      productName: "NewApp",
      uptimeCommitment: "99.9%",
      serviceCreditTerms: "10% credit",
    };
    const result = mergeDocumentFields(current, updates);
    expect(result.productName).toBe("NewApp");
    expect(result.uptimeCommitment).toBe("99.9%");
    expect(result.serviceCreditTerms).toBe("10% credit");
  });
});

describe("toNDAFormData", () => {
  it("maps basic NDA fields correctly", () => {
    const fields: DocumentFieldsUpdate = {
      purpose: "Business evaluation",
      effectiveDate: "2026-03-04",
      governingLaw: "Delaware",
      jurisdiction: "New Castle County courts",
      mndaTermType: "expires",
      mndaTermYears: 2,
      confidentialityTermType: "years",
      confidentialityTermYears: 3,
      modifications: "None",
    };
    const nda = toNDAFormData(fields);
    expect(nda.purpose).toBe("Business evaluation");
    expect(nda.effectiveDate).toBe("2026-03-04");
    expect(nda.governingLaw).toBe("Delaware");
    expect(nda.mndaTermType).toBe("expires");
    expect(nda.mndaTermYears).toBe(2);
  });

  it("maps party1 fields including printName", () => {
    const fields: DocumentFieldsUpdate = {
      party1: { company: "Acme Corp", printName: "John Doe", title: "CEO", noticeAddress: "john@acme.com" },
    };
    const nda = toNDAFormData(fields);
    expect(nda.party1.company).toBe("Acme Corp");
    expect(nda.party1.printName).toBe("John Doe");
    expect(nda.party1.title).toBe("CEO");
    expect(nda.party1.noticeAddress).toBe("john@acme.com");
  });

  it("provides defaults for missing fields", () => {
    const nda = toNDAFormData({});
    expect(nda.purpose).toBe("");
    expect(nda.mndaTermType).toBe("expires");
    expect(nda.mndaTermYears).toBe(1);
    expect(nda.confidentialityTermType).toBe("years");
    expect(nda.confidentialityTermYears).toBe(1);
    expect(nda.party1.company).toBe("");
    expect(nda.party2.company).toBe("");
  });

  it("uses today's date as default effectiveDate", () => {
    const nda = toNDAFormData({});
    const today = new Date().toISOString().split("T")[0];
    expect(nda.effectiveDate).toBe(today);
  });
});

describe("defaultDocumentData", () => {
  it("returns null documentType initially", () => {
    const data = defaultDocumentData();
    expect(data.documentType).toBeNull();
  });

  it("includes today's date as effectiveDate", () => {
    const data = defaultDocumentData();
    const today = new Date().toISOString().split("T")[0];
    expect(data.fields.effectiveDate).toBe(today);
  });
});

describe("CATALOG", () => {
  it("contains 11 document types", () => {
    // Excluding "Mutual NDA Cover Page" which is a sub-document
    expect(CATALOG.length).toBe(11);
  });

  it("includes Mutual Non-Disclosure Agreement", () => {
    const names = CATALOG.map((d) => d.name);
    expect(names).toContain("Mutual Non-Disclosure Agreement");
  });

  it("each entry has required fields", () => {
    for (const doc of CATALOG) {
      expect(doc.name).toBeTruthy();
      expect(doc.description).toBeTruthy();
      expect(doc.filename).toBeTruthy();
    }
  });
});
