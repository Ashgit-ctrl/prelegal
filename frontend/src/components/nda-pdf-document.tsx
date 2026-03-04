import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { NDAFormData } from "@/types/nda";
import { formatDate, getMndaTermText, getConfidentialityTermText } from "@/lib/nda-template";

const BLUE = "#1e3a5f";
const GRAY = "#555555";
const LIGHT_GRAY = "#f5f5f5";
const BORDER = "#cccccc";
const LIGHT_BORDER = "#e5e7eb";

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 56,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: "#000000",
    lineHeight: 1.5,
  },
  // ── Cover page ──────────────────────────────────────────
  title: {
    fontSize: 20,
    fontFamily: "Times-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    textAlign: "center",
    color: GRAY,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  intro: {
    fontSize: 9.5,
    color: GRAY,
    marginBottom: 14,
    lineHeight: 1.5,
  },
  // Cover page field rows
  fieldRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_BORDER,
    paddingVertical: 8,
    minHeight: 30,
  },
  fieldLabel: {
    width: "33%",
  },
  fieldLabelText: {
    fontFamily: "Times-Bold",
    fontSize: 10,
  },
  fieldSublabel: {
    fontSize: 8,
    color: GRAY,
    marginTop: 2,
  },
  fieldValue: {
    width: "67%",
    fontSize: 10,
    lineHeight: 1.4,
  },
  // Signature table
  signingNote: {
    fontSize: 9.5,
    color: GRAY,
    marginTop: 20,
    marginBottom: 10,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: LIGHT_GRAY,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    minHeight: 24,
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 24,
  },
  tableSignatureRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    minHeight: 48,
  },
  colLabel: {
    width: "28%",
    padding: 5,
    fontFamily: "Times-Bold",
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    backgroundColor: LIGHT_GRAY,
    justifyContent: "center",
  },
  colValue: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    justifyContent: "center",
  },
  colValueLast: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    justifyContent: "center",
  },
  colHeader: {
    flex: 1,
    padding: 5,
    fontFamily: "Times-Bold",
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
  },
  colHeaderLast: {
    flex: 1,
    padding: 5,
    fontFamily: "Times-Bold",
    fontSize: 9,
    textAlign: "center",
  },
  colHeaderEmpty: {
    width: "28%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  coverAttribution: {
    marginTop: 14,
    fontSize: 8,
    color: GRAY,
  },
  // ── Standard Terms ───────────────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Times-Bold",
    marginBottom: 14,
  },
  term: {
    flexDirection: "row",
    marginBottom: 10,
  },
  termNum: {
    width: 24,
    fontFamily: "Times-Bold",
    fontSize: 11,
  },
  termBody: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.6,
    textAlign: "justify",
  },
  bold: { fontFamily: "Times-Bold" },
  value: { fontFamily: "Times-Italic", color: BLUE },
  attribution: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    fontSize: 8,
    color: GRAY,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: GRAY,
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel?: string;
  value: string;
}) {
  return (
    <View style={s.fieldRow}>
      <View style={s.fieldLabel}>
        <Text style={s.fieldLabelText}>{label}</Text>
        {sublabel ? <Text style={s.fieldSublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={s.fieldValue}>{value}</Text>
    </View>
  );
}

function Term({
  n,
  children,
}: {
  n: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.term} wrap={false}>
      <Text style={s.termNum}>{n}.</Text>
      <Text style={s.termBody}>{children}</Text>
    </View>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────

export function NDADocument({ data }: { data: NDAFormData }) {
  const purpose = data.purpose.trim() || "[Purpose not specified]";
  const effectiveDate = data.effectiveDate
    ? formatDate(data.effectiveDate)
    : "[Effective Date]";
  const mndaTerm = getMndaTermText(data);
  const confidentialityTerm = getConfidentialityTermText(data);
  const governingLaw = data.governingLaw.trim() || "[Governing Law State]";
  const jurisdiction = data.jurisdiction.trim() || "[Jurisdiction]";
  const p1 = data.party1.company.trim() || "Party 1";
  const p2 = data.party2.company.trim() || "Party 2";

  const mndaTermDisplay =
    data.mndaTermType === "expires"
      ? `Expires ${data.mndaTermYears} ${data.mndaTermYears === 1 ? "year" : "years"} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";

  const confidentialityTermDisplay =
    data.confidentialityTermType === "years"
      ? `${data.confidentialityTermYears} ${data.confidentialityTermYears === 1 ? "year" : "years"} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  const sigRows = [
    { label: "Signature", v1: "", v2: "", signature: true },
    { label: "Print Name", v1: data.party1.printName, v2: data.party2.printName },
    { label: "Title", v1: data.party1.title, v2: data.party2.title },
    { label: "Company", v1: data.party1.company, v2: data.party2.company },
    { label: "Notice Address", v1: data.party1.noticeAddress, v2: data.party2.noticeAddress },
    { label: "Date", v1: "", v2: "", last: true },
  ];

  return (
    <Document title="Mutual Non-Disclosure Agreement">
      <Page size="A4" style={s.page}>
        {/* ── Cover Page ─────────────────────────────── */}
        <Text style={s.title}>Mutual Non-Disclosure Agreement</Text>
        <Text style={s.subtitle}>Common Paper Mutual NDA Standard Terms Version 1.0</Text>

        <Text style={s.intro}>
          This Mutual Non-Disclosure Agreement (the "MNDA") consists of: (1)
          this Cover Page and (2) the Common Paper Mutual NDA Standard Terms
          Version 1.0. Any modifications of the Standard Terms should be made
          on the Cover Page, which will control over conflicts with the Standard
          Terms.
        </Text>

        <FieldRow
          label="Purpose"
          sublabel="How Confidential Information may be used"
          value={purpose}
        />
        <FieldRow label="Effective Date" value={effectiveDate} />
        <FieldRow
          label="MNDA Term"
          sublabel="The length of this MNDA"
          value={mndaTermDisplay}
        />
        <FieldRow
          label="Term of Confidentiality"
          sublabel="How long Confidential Information is protected"
          value={confidentialityTermDisplay}
        />
        <FieldRow
          label="Governing Law & Jurisdiction"
          value={`Governing Law: ${governingLaw}\nJurisdiction: ${jurisdiction}`}
        />
        {data.modifications.trim() ? (
          <FieldRow label="MNDA Modifications" value={data.modifications} />
        ) : null}

        {/* Signature table */}
        <Text style={s.signingNote}>
          By signing this Cover Page, each party agrees to enter into this MNDA
          as of the Effective Date.
        </Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <View style={s.colHeaderEmpty} />
            <Text style={s.colHeader}>{p1}</Text>
            <Text style={s.colHeaderLast}>{p2}</Text>
          </View>
          {sigRows.map((row) => (
            <View
              key={row.label}
              style={
                row.last
                  ? s.tableRowLast
                  : row.signature
                  ? s.tableSignatureRow
                  : s.tableRow
              }
            >
              <View style={s.colLabel}>
                <Text>{row.label}</Text>
              </View>
              <View style={s.colValue}>
                <Text>{row.v1 ?? ""}</Text>
              </View>
              <View style={s.colValueLast}>
                <Text>{row.v2 ?? ""}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.coverAttribution}>
          Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to
          use under CC BY 4.0.
        </Text>

        {/* ── Standard Terms (new page) ──────────────── */}
        <View break>
          <Text style={s.sectionTitle}>Standard Terms</Text>

          <Term n="1">
            <Text style={s.bold}>Introduction. </Text>
            {"This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page (defined below)) (\"MNDA\") allows each party (\"Disclosing Party\") to disclose or make available information in connection with the "}
            <Text style={s.value}>{purpose}</Text>
            {" which (1) the Disclosing Party identifies to the receiving party (\"Receiving Party\") as \"confidential\", \"proprietary\", or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure (\"Confidential Information\"). Each party's Confidential Information also includes the existence and status of the parties' discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how. To use this MNDA, the parties must complete and sign a cover page incorporating these Standard Terms (\"Cover Page\"). Each party is identified on the Cover Page and capitalized terms have the meanings given herein or on the Cover Page."}
          </Term>

          <Term n="2">
            <Text style={s.bold}>Use and Protection of Confidential Information. </Text>
            {"The Receiving Party shall: (a) use Confidential Information solely for the "}
            <Text style={s.value}>{purpose}</Text>
            {"; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the "}
            <Text style={s.value}>{purpose}</Text>
            {", provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care."}
          </Term>

          <Term n="3">
            <Text style={s.bold}>Exceptions. </Text>
            {"The Receiving Party's obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information."}
          </Term>

          <Term n="4">
            <Text style={s.bold}>Disclosures Required by Law. </Text>
            {"The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party's expense, with the Disclosing Party's efforts to obtain confidential treatment for the Confidential Information."}
          </Term>

          <Term n="5">
            <Text style={s.bold}>Term and Termination. </Text>
            {"This MNDA commences on the "}
            <Text style={s.value}>{effectiveDate}</Text>
            {" and expires at the end of the "}
            <Text style={s.value}>{mndaTerm}</Text>
            {". Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party's obligations relating to Confidential Information will survive for the "}
            <Text style={s.value}>{confidentialityTerm}</Text>
            {", despite any expiration or termination of this MNDA."}
          </Term>

          <Term n="6">
            <Text style={s.bold}>Return or Destruction of Confidential Information. </Text>
            {"Upon expiration or termination of this MNDA or upon the Disclosing Party's earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party's written request, destroy all Confidential Information in the Receiving Party's possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information."}
          </Term>

          <Term n="7">
            <Text style={s.bold}>Proprietary Rights. </Text>
            {"The Disclosing Party retains all of its intellectual property and other rights in its Confidential Information and its disclosure to the Receiving Party grants no license under such rights."}
          </Term>

          <Term n="8">
            <Text style={s.bold}>Disclaimer. </Text>
            {"ALL CONFIDENTIAL INFORMATION IS PROVIDED \"AS IS\", WITH ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE."}
          </Term>

          <Term n="9">
            <Text style={s.bold}>Governing Law and Jurisdiction. </Text>
            {"This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the State of "}
            <Text style={s.value}>{governingLaw}</Text>
            {", without regard to the conflict of laws provisions of such "}
            <Text style={s.value}>{governingLaw}</Text>
            {". Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in "}
            <Text style={s.value}>{jurisdiction}</Text>
            {". Each party irrevocably submits to the exclusive jurisdiction of such "}
            <Text style={s.value}>{jurisdiction}</Text>
            {" in any such suit, action, or proceeding."}
          </Term>

          <Term n="10">
            <Text style={s.bold}>Equitable Relief. </Text>
            {"A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies."}
          </Term>

          <Term n="11">
            <Text style={s.bold}>General. </Text>
            {"Neither party has an obligation under this MNDA to disclose Confidential Information to the other or proceed with any proposed transaction. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities. Any assignment in violation of this Section is null and void. This MNDA will bind and inure to the benefit of each party's permitted successors and assigns. Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct. If any provision of this MNDA is held unenforceable, it will be limited to the minimum extent necessary so the rest of this MNDA remains in effect. This MNDA (including the Cover Page) constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Notices, requests and approvals under this MNDA must be sent in writing to the email or postal addresses on the Cover Page and are deemed delivered on receipt. This MNDA may be executed in counterparts, including electronic copies, each of which is deemed an original and which together form the same agreement."}
          </Term>

          <Text style={s.attribution}>
            Common Paper Mutual Non-Disclosure Agreement Version 1.0 free to
            use under CC BY 4.0.
          </Text>
        </View>

        {/* Page numbers on every page */}
        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
