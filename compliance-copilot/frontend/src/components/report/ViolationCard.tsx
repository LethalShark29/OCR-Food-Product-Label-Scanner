"use client";

import React, { useState } from "react";
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { cn, fieldLabel } from "@/lib/utils";
import type { Violation } from "@/types";

interface Props {
  violation: Violation;
  index: number;
}

const SEVERITY_STYLES = {
  critical: {
    border:  "border-red-500/30",
    bg:      "bg-red-900/10",
    icon:    "text-neon-red",
    badge:   "bg-red-900/40 text-red-300 border border-red-500/40",
    glow:    "hover:border-red-500/50 hover:shadow-glow-red",
    dot:     "bg-neon-red",
  },
  warning: {
    border:  "border-amber-500/30",
    bg:      "bg-amber-900/10",
    icon:    "text-neon-amber",
    badge:   "bg-amber-900/40 text-amber-300 border border-amber-500/40",
    glow:    "hover:border-amber-500/50 hover:shadow-glow-amber",
    dot:     "bg-neon-amber",
  },
  info: {
    border:  "border-blue-500/30",
    bg:      "bg-blue-900/10",
    icon:    "text-neon-blue",
    badge:   "bg-blue-900/40 text-blue-300 border border-blue-500/40",
    glow:    "hover:border-blue-500/50",
    dot:     "bg-neon-blue",
  },
};

const ICON = { critical: XCircle, warning: AlertTriangle, info: Info };

export default function ViolationCard({ violation, index }: Props) {
  const [open, setOpen] = useState(false);
  const Icon = ICON[violation.severity] ?? Info;
  const s = SEVERITY_STYLES[violation.severity] ?? SEVERITY_STYLES.info;

  return (
    <div
      className={cn(
        "rounded-xl border glass-light transition-all duration-200 animate-fade-in overflow-hidden",
        s.border, s.bg, s.glow
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Severity dot + icon */}
        <div className="mt-0.5 flex-shrink-0 relative">
          <Icon className={cn("w-5 h-5", s.icon)} aria-hidden />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", s.badge)}>
              {violation.severity.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 font-mono bg-surface-700 rounded px-1.5 py-0.5">
              {violation.rule_id}
            </span>
            <span className="text-xs text-slate-600">{fieldLabel(violation.field)}</span>
          </div>
          <p className="text-sm font-semibold text-slate-200">{violation.title}</p>
        </div>

        <div className="ml-auto p-1 rounded-lg hover:bg-white/5 flex-shrink-0 transition-colors">
          {open
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />
          }
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-4 pl-12 space-y-3 animate-fade-in border-t border-white/5 pt-3">
          <p className="text-sm text-slate-400 leading-relaxed">{violation.description}</p>

          {violation.evidence && (
            <div className="rounded-lg bg-surface-900/60 border border-white/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Evidence on label
              </p>
              <p className="font-mono text-xs text-neon-cyan break-all">
                &quot;{violation.evidence}&quot;
              </p>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-xs text-slate-500">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-600" />
            <span>{violation.regulation_ref}</span>
          </div>
        </div>
      )}
    </div>
  );
}
