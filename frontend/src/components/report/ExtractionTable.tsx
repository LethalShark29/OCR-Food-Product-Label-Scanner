"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { fieldLabel, cn } from "@/lib/utils";
import type { LabelExtraction } from "@/types";

interface Props { extraction: LabelExtraction; }

const FIELD_KEYS = [
  "mrp","net_quantity","manufacturer_name","manufacturer_address",
  "country_of_origin","best_before","batch_lot_number","customer_care",
  "fssai_license","ingredients","nutritional_info",
  "allergen_info","veg_nonveg_symbol","language_declaration",
] as const;

export default function ExtractionTable({ extraction }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 glass-light">
      {/* Table header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Extracted Fields</p>
        <span className="text-xs text-slate-600">
          {FIELD_KEYS.filter(k => extraction[k]?.found).length}/{FIELD_KEYS.length} detected
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.05]">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
          </tr>
        </thead>
        <tbody>
          {FIELD_KEYS.map((key, i) => {
            const field = extraction[key];
            const found = field?.found ?? false;
            const value = field?.value ?? null;
            return (
              <tr key={key}
                className={cn(
                  "border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]",
                  i % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
                )}
              >
                <td className="px-4 py-3 font-medium text-slate-300 whitespace-nowrap text-xs">
                  {fieldLabel(key)}
                </td>
                <td className="px-4 py-3">
                  {found
                    ? <CheckCircle2 className="w-4 h-4 text-neon-green" aria-label="Found" />
                    : <XCircle className="w-4 h-4 text-red-500/60" aria-label="Not found" />
                  }
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {value
                    ? <span className="font-mono text-xs text-neon-cyan bg-surface-800 rounded px-1.5 py-0.5 break-all">
                        {value.length > 80 ? value.slice(0, 80) + "…" : value}
                      </span>
                    : <span className="text-slate-600 italic text-xs">Not detected</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Raw OCR toggle */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowRaw(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-slate-500
                     hover:text-slate-300 hover:bg-white/[0.02] transition-colors"
        >
          <span className="flex items-center gap-2 font-medium">
            <Terminal className="w-3.5 h-3.5" />
            Raw OCR Output
          </span>
          {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showRaw && (
          <div className="px-4 pb-4 animate-fade-in">
            <pre className="text-xs font-mono text-neon-cyan/70 bg-surface-900/80 rounded-lg p-3
                            overflow-x-auto whitespace-pre-wrap max-h-52 overflow-y-auto
                            border border-white/10 leading-relaxed">
              {extraction.raw_text || "(empty)"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
