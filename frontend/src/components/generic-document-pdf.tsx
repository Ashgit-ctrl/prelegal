import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { DocumentFieldsUpdate } from "@/types/document";

const s = StyleSheet.create({
  page: { fontFamily: "Times-Roman", fontSize: 10, padding: 54, color: "#1a1a1a" },
  title: { fontFamily: "Times-Bold", fontSize: 18, textAlign: "center", marginBottom: 4, color: "#032147" },
  subtitle: { fontSize: 10, textAlign: "center", color: "#888888", marginBottom: 24 },
  sectionHeader: { fontFamily: "Times-Bold", fontSize: 11, color: "#032147", marginTop: 16, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", borderBottomStyle: "solid", paddingBottom: 3 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontFamily: "Times-Bold", width: 160, fontSize: 10, color: "#374151" },
  value: { flex: 1, fontSize: 10, color: "#1e40af", fontFamily: "Times-Italic" },
  emptyValue: { flex: 1, fontSize: 10, color: "#d97706", fontFamily: "Times-Italic" },
  // Use individual border properties — react-pdf does not support the `border` shorthand
  partyBox: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", padding: 10 },
  partyBoxLeft: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid", padding: 10, marginRight: 8 },
  partyTitle: { fontFamily: "Times-Bold", fontSize: 10, color: "#032147", marginBottom: 6 },
  partyRow: { flexDirection: "row", marginBottom: 3 },
  partyLabel: { fontFamily: "Times-Bold", fontSize: 9, color: "#6b7280", width: 80 },
  partyValue: { flex: 1, fontSize: 9, color: "#1e40af" },
  // No `gap` — use marginRight on the first child instead
  partiesRow: { flexDirection: "row", marginBottom: 8 },
  sigRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", borderBottomStyle: "solid", paddingTop: 6, paddingBottom: 6 },
  sigLabel: { fontFamily: "Times-Bold", fontSize: 9, color: "#6b7280", width: 100 },
  sigCell: { flex: 1, fontSize: 9, color: "#9ca3af", textAlign: "center" },
});

function FieldRow({ label, value }: { label: string; value: string | undefined | null }) {
  const isEmpty = !value?.trim();
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={isEmpty ? s.emptyValue : s.value}>{isEmpty ? "[Not provided]" : value!}</Text>
    </View>
  );
}

interface GenericDocumentPDFProps {
  documentType: string;
  fields: DocumentFieldsUpdate;
  party1Label: string;
  party2Label: string;
}

export function GenericDocumentPDF({ documentType, fields, party1Label, party2Label }: GenericDocumentPDFProps) {
  const specificFields: Array<{ label: string; value: string | null | undefined }> = [];

  if (fields.purpose !== undefined) specificFields.push({ label: "Purpose", value: fields.purpose });
  if (fields.productName !== undefined) specificFields.push({ label: "Product / Service", value: fields.productName });
  if (fields.servicesDescription !== undefined) specificFields.push({ label: "Services Description", value: fields.servicesDescription });
  if (fields.deliverables !== undefined) specificFields.push({ label: "Deliverables", value: fields.deliverables });
  if (fields.agreementTerm !== undefined) specificFields.push({ label: "Agreement Term", value: fields.agreementTerm });
  if (fields.fees !== undefined) specificFields.push({ label: "Fees", value: fields.fees });
  if (fields.paymentTerms !== undefined) specificFields.push({ label: "Payment Terms", value: fields.paymentTerms });
  if (fields.coveredEntityType !== undefined) specificFields.push({ label: "Covered Entity Type", value: fields.coveredEntityType });
  if (fields.processingPurposes !== undefined) specificFields.push({ label: "Processing Purposes", value: fields.processingPurposes });
  if (fields.personalDataTypes !== undefined) specificFields.push({ label: "Personal Data Types", value: fields.personalDataTypes });
  if (fields.pilotDuration !== undefined) specificFields.push({ label: "Pilot / Trial Duration", value: fields.pilotDuration });
  if (fields.pilotScope !== undefined) specificFields.push({ label: "Pilot Scope", value: fields.pilotScope });
  if (fields.feedbackObligations !== undefined) specificFields.push({ label: "Feedback Obligations", value: fields.feedbackObligations });
  if (fields.partnershipScope !== undefined) specificFields.push({ label: "Partnership Scope", value: fields.partnershipScope });
  if (fields.commissionTerms !== undefined) specificFields.push({ label: "Commission Terms", value: fields.commissionTerms });
  if (fields.uptimeCommitment !== undefined) specificFields.push({ label: "Uptime Commitment", value: fields.uptimeCommitment });
  if (fields.supportLevels !== undefined) specificFields.push({ label: "Support Levels", value: fields.supportLevels });
  if (fields.serviceCreditTerms !== undefined) specificFields.push({ label: "Service Credits", value: fields.serviceCreditTerms });
  if (fields.licenseScope !== undefined) specificFields.push({ label: "License Scope", value: fields.licenseScope });
  if (fields.aiTrainingRestrictions !== undefined) specificFields.push({ label: "AI Training Restrictions", value: fields.aiTrainingRestrictions });
  if (fields.baseAgreementRef !== undefined) specificFields.push({ label: "Base Agreement", value: fields.baseAgreementRef });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{documentType}</Text>
        <Text style={s.subtitle}>Cover Page</Text>

        {/* Key Terms */}
        <Text style={s.sectionHeader}>Key Terms</Text>
        <FieldRow label="Effective Date" value={fields.effectiveDate} />
        <FieldRow label="Governing Law" value={fields.governingLaw} />
        <FieldRow label="Jurisdiction" value={fields.jurisdiction} />
        {specificFields.map((f, i) => (
          <FieldRow key={i} label={f.label} value={f.value} />
        ))}

        {/* Parties */}
        <Text style={s.sectionHeader}>Parties</Text>
        <View style={s.partiesRow}>
          <View style={s.partyBoxLeft}>
            <Text style={s.partyTitle}>{party1Label}</Text>
            <View style={s.partyRow}><Text style={s.partyLabel}>Company</Text><Text style={s.partyValue}>{fields.party1?.company || "[Not provided]"}</Text></View>
            <View style={s.partyRow}><Text style={s.partyLabel}>Name</Text><Text style={s.partyValue}>{fields.party1?.printName || "[Not provided]"}</Text></View>
            <View style={s.partyRow}><Text style={s.partyLabel}>Title</Text><Text style={s.partyValue}>{fields.party1?.title || "[Not provided]"}</Text></View>
            <View style={s.partyRow}><Text style={s.partyLabel}>Address</Text><Text style={s.partyValue}>{fields.party1?.noticeAddress || "[Not provided]"}</Text></View>
          </View>
          <View style={s.partyBox}>
            <Text style={s.partyTitle}>{party2Label}</Text>
            <View style={s.partyRow}><Text style={s.partyLabel}>Company</Text><Text style={s.partyValue}>{fields.party2?.company || "[Not provided]"}</Text></View>
            <View style={s.partyRow}><Text style={s.partyLabel}>Name</Text><Text style={s.partyValue}>{fields.party2?.printName || "[Not provided]"}</Text></View>
            <View style={s.partyRow}><Text style={s.partyLabel}>Title</Text><Text style={s.partyValue}>{fields.party2?.title || "[Not provided]"}</Text></View>
            <View style={s.partyRow}><Text style={s.partyLabel}>Address</Text><Text style={s.partyValue}>{fields.party2?.noticeAddress || "[Not provided]"}</Text></View>
          </View>
        </View>

        {/* Signature block */}
        <Text style={s.sectionHeader}>Signatures</Text>
        {["Signature", "Print Name", "Title", "Company", "Date"].map((row) => (
          <View key={row} style={s.sigRow}>
            <Text style={s.sigLabel}>{row}</Text>
            <Text style={s.sigCell}>{party1Label}</Text>
            <Text style={s.sigCell}>{party2Label}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
