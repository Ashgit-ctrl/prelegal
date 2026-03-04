"use client";

import { NDAFormData } from "@/types/nda";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

interface NDAFormProps {
  data: NDAFormData;
  onChange: (data: NDAFormData) => void;
}

function PartyFieldset({
  label,
  party,
  onChange,
}: {
  label: string;
  party: NDAFormData["party1"];
  onChange: (party: NDAFormData["party1"]) => void;
}) {
  // Slugify label to ensure valid HTML ids (e.g. "Party 1" → "party-1")
  const slug = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        {label}
      </h3>
      <div className="space-y-3">
        <div>
          <Label htmlFor={`${slug}-company`}>Company</Label>
          <Input
            id={`${slug}-company`}
            value={party.company}
            onChange={(e) => onChange({ ...party, company: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <Label htmlFor={`${slug}-name`}>Print Name</Label>
          <Input
            id={`${slug}-name`}
            value={party.printName}
            onChange={(e) => onChange({ ...party, printName: e.target.value })}
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <Label htmlFor={`${slug}-title`}>Title</Label>
          <Input
            id={`${slug}-title`}
            value={party.title}
            onChange={(e) => onChange({ ...party, title: e.target.value })}
            placeholder="CEO"
          />
        </div>
        <div>
          <Label htmlFor={`${slug}-address`}>Notice Address</Label>
          <Input
            id={`${slug}-address`}
            value={party.noticeAddress}
            onChange={(e) =>
              onChange({ ...party, noticeAddress: e.target.value })
            }
            placeholder="email@company.com or postal address"
          />
        </div>
      </div>
    </div>
  );
}

export function NDAForm({ data, onChange }: NDAFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">Agreement Details</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              value={data.purpose}
              onChange={(e) => onChange({ ...data, purpose: e.target.value })}
              rows={3}
              placeholder="How Confidential Information may be used"
            />
          </div>

          <div>
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={data.effectiveDate}
              onChange={(e) =>
                onChange({ ...data, effectiveDate: e.target.value })
              }
            />
          </div>

          <div>
            <Label className="mb-2 block">MNDA Term</Label>
            <RadioGroup
              value={data.mndaTermType}
              onValueChange={(v) =>
                onChange({
                  ...data,
                  mndaTermType: v as NDAFormData["mndaTermType"],
                })
              }
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="expires" id="term-expires" />
                <Label htmlFor="term-expires" className="font-normal flex items-center gap-2">
                  Expires
                  <Input
                    type="number"
                    min={1}
                    value={data.mndaTermYears}
                    onChange={(e) =>
                      // Always select "expires" radio and update years in a single update
                      onChange({
                        ...data,
                        mndaTermType: "expires",
                        mndaTermYears: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-16 h-7 text-center"
                  />
                  year(s) from Effective Date
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="until-terminated" id="term-terminated" />
                <Label htmlFor="term-terminated" className="font-normal">
                  Continues until terminated
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="mb-2 block">Term of Confidentiality</Label>
            <RadioGroup
              value={data.confidentialityTermType}
              onValueChange={(v) =>
                onChange({
                  ...data,
                  confidentialityTermType: v as NDAFormData["confidentialityTermType"],
                })
              }
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="years" id="conf-years" />
                <Label htmlFor="conf-years" className="font-normal flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={data.confidentialityTermYears}
                    onChange={(e) =>
                      // Always select "years" radio and update years in a single update
                      onChange({
                        ...data,
                        confidentialityTermType: "years",
                        confidentialityTermYears: Math.max(
                          1,
                          parseInt(e.target.value) || 1
                        ),
                      })
                    }
                    className="w-16 h-7 text-center"
                  />
                  year(s) from Effective Date
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="perpetuity" id="conf-perpetuity" />
                <Label htmlFor="conf-perpetuity" className="font-normal">
                  In perpetuity
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="governingLaw">Governing Law (State)</Label>
            <Input
              id="governingLaw"
              value={data.governingLaw}
              onChange={(e) =>
                onChange({ ...data, governingLaw: e.target.value })
              }
              placeholder="e.g. Delaware"
            />
          </div>

          <div>
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <Input
              id="jurisdiction"
              value={data.jurisdiction}
              onChange={(e) =>
                onChange({ ...data, jurisdiction: e.target.value })
              }
              placeholder="e.g. courts located in New Castle, DE"
            />
          </div>

          <div>
            <Label htmlFor="modifications">MNDA Modifications</Label>
            <Textarea
              id="modifications"
              value={data.modifications}
              onChange={(e) =>
                onChange({ ...data, modifications: e.target.value })
              }
              rows={3}
              placeholder="List any modifications to the MNDA (leave blank if none)"
            />
          </div>
        </div>
      </div>

      <Separator />

      <PartyFieldset
        label="Party 1"
        party={data.party1}
        onChange={(party1) => onChange({ ...data, party1 })}
      />

      <Separator />

      <PartyFieldset
        label="Party 2"
        party={data.party2}
        onChange={(party2) => onChange({ ...data, party2 })}
      />
    </div>
  );
}
