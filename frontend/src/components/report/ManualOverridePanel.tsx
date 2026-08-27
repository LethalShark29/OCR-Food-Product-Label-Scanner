"use client";

import React, { useState, useMemo } from "react";
import {
  PenLine, ChevronDown, ChevronUp, RefreshCw,
  AlertTriangle, CheckCircle2, Sparkles, Info,
} from "lucide-react";
import { cn, fieldLabel } from "@/lib/utils";
import type { LabelExtraction, ComplianceReport } from "@/types";

// ---------------------------------------------------------------------------
// Field definitions — grouped by category for a cleaner form layout
// ---------------------------------------------------------------------------

const FIELD_GROUPS: { label: string; icon: string; fields: (keyof LabelExtraction)[] }[] = [
  {
    label: "Pricing & Quantity",
    icon: "💰",
    fields: ["mrp", "net_quantity"],
  },
  {
    label: "Manufacturer Details",
    icon: "🏭",
    fields: ["manufacturer_name", "manufacturer_address", "country_of_origin"],
  },
  {
    label: "Dates & Traceability",
    icon: "📅",
    fields: ["best_before", "batch_lot_number"],
  },
  {
    label: "Regulatory & Contact",
    icon: "📋",
    fields: ["fssai_license", "customer_care"],
  },
  {
    label: "Food Information",
    icon: "🥗",
    fields: ["ingredients", "nutritional_info", "allergen_info", "veg_nonveg_symbol"],
  },
  {
    label: "Language & Compliance",
    icon: "🌐",
    fields: ["language_declaration"],
  },
];

// Multi-line fields that need a textarea
const MULTILINE_FIELDS = new Set(["ingredients", "nutritional_info", "allergen_info", "manufacturer_address"]);

// Placeholder hints per field
const PLACEHOLDERS: Partial<Record<keyof LabelExtraction, string>> = {
  mrp:                  "e.g. ₹ 149 (Incl. of all taxes)",
  net_quantity:         "e.g. 500 g",
  manufacturer_name:    "e.g. Sunrise Foods Pvt. Ltd.",
  manufacturer_address: "e.g. Plot 42, MIDC, Pune, Maharashtra – 411 019",
  country_of_origin:    "e.g. India",
  best_before:          "e.g. Best Before: 12 months from manufacture",
  batch_lot_number:     "e.g. BT-2024-0815",
  fssai_license:        "e.g. 10019022003456  (14 digits)",
  customer_care:        "e.g. 1800-123-4567",
  ingredients:          "e.g. Wheat flour (60%), Sugar, Edible oil, Salt…",
  nutritional_info:     "e.g. Energy: 420 kcal, Protein: 8 g, Carbs: 68 g…",
  allergen_info:        "e.g. Contains: Gluten, Milk. May contain traces of nuts.",
  veg_nonveg_symbol:    "e.g. Vegetarian  or  Non-Vegetarian",
  language_declaration: "e.g. सामग्री: मैदा, चीनी…",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  extraction: LabelExtraction;
  report: ComplianceReport;
  onRecheck: (overrides: Record<string, string>) => Promise<void>;
  overriddenFields?: string[];
  isRechecking?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ManualOverridePanel({
  extraction,
  report,
  onRecheck,
  overriddenFields = [],
  isRechecking = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Fields the OCR missed — pre-populate their input as empty so they're
  // highlighted immediately as "needs attention"
  const missedFields = useMemo(() => {
    const all = FIELD_GROUPS.flatMap((g) => g.fields) as string[];
    return all.filter((f) => {
      const field = extraction[f as keyof LabelExtraction] as { found?: boolean } | null;
      return !field?.found;
    });
  }, [extraction]);

  function handleChange(field: string, val: string) {
    setValues((prev) => ({ ...prev, [field]: val }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleSubmit() {
    // Only send fields the user actually typed something into
    const overrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (touched[k]) overrides[k] = v;
    }
    if (Object.keys(overrides).length === 0) return;
    onRecheck(overrides);
  }

  const dirtyCount = Object.keys(touched).filter((k) => touched[k]).length;

  // Current value to show in input: user's typed value → OCR value → ""
  function currentValue(field: string): string {
    if (touched[field]) return values[field] ?? "";
    const f = extraction[field as keyof LabelExtraction] as { value?: string | null } | null;
    return f?.value ?? "";
  }

  function isOverridden(field: string) {
    return overriddenFields.includes(field);
  }

  function isOcrFound(field: string) {
    const f = extraction[field as keyof LabelExtraction] as { found?: boolean } | null;
    return f?.found ?? false;
  }

  return (
    <div className={cn(
      "glass rounded-2xl border transition-all duration-300",
      open ? "border-brand-500/40" : "border-white/[0.06]"
    )}>
      {/* ── Header toggle ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
            open ? "bg-brand-600/30" : "bg-surface-700"
          )}>
            <PenLine className={cn("w-4 h-4", open ? "text-neon-cyan" : "text-slate-400")} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Manual Field Correction</p>
            <p className="text-xs text-slate-500">
              Fix fields the OCR missed or misread, then re-run the compliance check
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {/* Badges */}
          {missedFields.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold bg-amber-900/40 text-amber-300
                             border border-amber-500/30 rounded-full px-2.5 py-1">
              <AlertTriangle className="w-3 h-3" />
              {missedFields.length} missed
            </span>
          )}
          {dirtyCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold bg-brand-600/30 text-neon-cyan
                             border border-brand-500/40 rounded-full px-2.5 py-1">
              <PenLine className="w-3 h-3" />
              {dirtyCount} edited
            </span>
          )}
          {overriddenFields.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold bg-green-900/30 text-neon-green
                             border border-green-500/30 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" />
              {overriddenFields.length} applied
            </span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />
          }
        </div>
      </button>

      {/* ── Form body ── */}
      {open && (
        <div className="px-5 pb-5 border-t border-white/[0.06] pt-5 animate-fade-in">

          {/* Info banner */}
          <div className="flex items-start gap-2.5 glass-light rounded-xl border border-brand-500/20
                          px-4 py-3 mb-5 bg-brand-900/10">
            <Info className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Fields highlighted in <span className="text-neon-amber font-semibold">amber</span> were
              not detected by OCR. Fill in what you can read directly from the label.
              Fields in <span className="text-neon-cyan font-semibold">cyan</span> were detected — edit
              only if the OCR value is incorrect. Click <strong className="text-white">Re-run Check</strong> when done.
            </p>
          </div>

          {/* Field groups */}
          <div className="space-y-6">
            {FIELD_GROUPS.map((group) => (
              <div key={group.label}>
                {/* Group heading */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{group.icon}</span>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {group.label}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.fields.map((field) => {
                    const key = field as string;
                    const found = isOcrFound(key);
                    const overridden = isOverridden(key);
                    const dirty = touched[key];
                    const val = currentValue(key);
                    const isMulti = MULTILINE_FIELDS.has(key);

                    const inputBorder = overridden
                      ? "border-green-500/50 focus:border-neon-green"
                      : dirty
                      ? "border-brand-500/60 focus:border-neon-cyan"
                      : !found
                      ? "border-amber-500/40 focus:border-neon-amber"
                      : "border-white/10 focus:border-brand-500/60";

                    const labelColor = overridden
                      ? "text-neon-green"
                      : !found
                      ? "text-neon-amber"
                      : "text-slate-400";

                    const sharedInputClass = cn(
                      "w-full bg-surface-900/60 rounded-lg px-3 py-2.5 text-xs text-slate-200",
                      "border transition-all duration-200 outline-none",
                      "placeholder:text-slate-600 font-mono",
                      inputBorder,
                      "focus:ring-1 focus:ring-brand-500/30"
                    );

                    return (
                      <div key={key} className={cn(
                        isMulti && "sm:col-span-2"
                      )}>
                        {/* Label row */}
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={cn("text-xs font-semibold", labelColor)}>
                            {fieldLabel(key)}
                          </label>
                          <div className="flex items-center gap-1.5">
                            {overridden && (
                              <span className="text-xs text-neon-green flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> applied
                              </span>
                            )}
                            {!found && !dirty && (
                              <span className="text-xs text-neon-amber flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> not detected
                              </span>
                            )}
                            {found && !dirty && !overridden && (
                              <span className="text-xs text-slate-600 flex items-center gap-1">
                                OCR
                              </span>
                            )}
                            {dirty && (
                              <span className="text-xs text-neon-cyan flex items-center gap-1">
                                <PenLine className="w-3 h-3" /> edited
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Input / Textarea */}
                        {isMulti ? (
                          <textarea
                            rows={3}
                            value={val}
                            onChange={(e) => handleChange(key, e.target.value)}
                            placeholder={PLACEHOLDERS[field as keyof typeof PLACEHOLDERS] ?? `Enter ${fieldLabel(key)}…`}
                            className={cn(sharedInputClass, "resize-none leading-relaxed")}
                          />
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleChange(key, e.target.value)}
                            placeholder={PLACEHOLDERS[field as keyof typeof PLACEHOLDERS] ?? `Enter ${fieldLabel(key)}…`}
                            className={sharedInputClass}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/[0.06]">
            <button
              onClick={() => { setValues({}); setTouched({}); }}
              disabled={dirtyCount === 0 || isRechecking}
              className="btn-secondary text-xs px-4 py-2 disabled:opacity-30"
            >
              Clear edits
            </button>

            <button
              onClick={handleSubmit}
              disabled={dirtyCount === 0 || isRechecking}
              className={cn(
                "btn-primary text-xs px-5 py-2.5 gap-2",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {isRechecking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Re-running…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Re-run Compliance Check
                  {dirtyCount > 0 && (
                    <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-bold">
                      {dirtyCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
