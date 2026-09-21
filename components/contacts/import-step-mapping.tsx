"use client";

import { AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParsedCsv, ContactFieldKey } from "./csv-parser";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const FIELD_OPTIONS: { key: ContactFieldKey; label: string }[] = [
  { key: "__ignore__", label: "— Skip column —" },
  { key: "name", label: "Full Name (Required for new)" },
  { key: "email", label: "Email Address (Required)" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone Number" },
  { key: "title", label: "Job Title" },
  { key: "address", label: "Address" },
  { key: "notes", label: "Notes" },
  { key: "tags", label: "Tags (comma-separated)" },
];

interface ImportStepMappingProps {
  parsedCsv: ParsedCsv;
  mapping: Record<string, ContactFieldKey>;
  onMappingChange: (header: string, field: ContactFieldKey) => void;
  hasEmailMapped: boolean;
  t: NonNullable<Dictionary["platform"]["contacts"]>["import"];
}

export function ImportStepMapping({
  parsedCsv,
  mapping,
  onMappingChange,
  hasEmailMapped,
  t,
}: ImportStepMappingProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{t.mappingTitle}</h4>
        <p className="text-xs text-muted-foreground">{t.mappingSubtitle}</p>
      </div>

      {!hasEmailMapped && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>Email is required. Please map at least one CSV column to Email Address.</span>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {parsedCsv.headers.map((header, idx) => {
          const sampleVal = parsedCsv.rows[0]?.[idx] || "";
          return (
            <div
              key={header}
              className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-card"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{header}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {sampleVal ? `e.g. "${sampleVal}"` : "—"}
                </p>
              </div>
              <div>
                <Select
                  value={mapping[header] || "__ignore__"}
                  onValueChange={(val) => onMappingChange(header, val as ContactFieldKey)}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
