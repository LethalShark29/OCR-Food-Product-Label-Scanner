"use client";

import React, { useState } from "react";
import {
  CheckCircle2, AlertTriangle, XCircle,
  FileText, Clock, Download, Shield,
} from "lucide-react";
import ScoreGauge from "./ScoreGauge";
import ViolationCard from "./ViolationCard";
import ExtractionTable from "./ExtractionTable";
import { cn, formatTimestamp, statusColor, statusLabel, scoreRingColor } from "@/lib/utils";
import type { ComplianceReport as ReportType, ComplianceStatus, Severity } from "@/types";

interface Props { report: ReportType; }
type Tab = "violations" | "passed" | "extraction";

// status → neon border class
const STATUS_GLOW: Record<ComplianceStatus, string> = {
  compliant:     "neon-border-green border",
  non_compliant: "neon-border-red border",
  needs_review:  "neon-border-amber border",
};

export default function ComplianceReport({ report }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("violations");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");

  const filteredViolations = filterSeverity === "all"
    ? report.violations
    : report.violations.filter(v => v.severity === filterSeverity);

  function downloadReport() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${report.report_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ringColor = scoreRingColor(report.compliance_score);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "violations", label: "Violations",       count: report.violations.length },
    { key: "passed",     label: "Passed Checks",    count: report.passed_checks.length },
    { key: "extraction", label: "Extracted Fields" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Status header card ── */}
      <div className={cn("glass rounded-2xl p-5", STATUS_GLOW[report.overall_status])}>
        <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          {/* Score gauge */}
          <ScoreGauge score={report.compliance_score} status={report.overall_status} />

          <div className="flex-1 space-y-3 min-w-0">
            {/* Status label */}
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" style={{ color: ringColor }} />
              <span className="text-lg font-black" style={{ color: ringColor }}>
                {statusLabel(report.overall_status)}
              </span>
            </div>

            {/* Summary */}
            <p className="text-sm text-slate-400 leading-relaxed">{report.summary}</p>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2">
              <StatPill
                icon={<XCircle className="w-3.5 h-3.5" />}
                label="Critical"
                count={report.critical_count}
                textColor="text-neon-red"
                bgColor="bg-red-900/30 border border-red-500/30"
              />
              <StatPill
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                label="Warnings"
                count={report.warning_count}
                textColor="text-neon-amber"
                bgColor="bg-amber-900/30 border border-amber-500/30"
              />
              <StatPill
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                label="Passed"
                count={report.passed_checks.length}
                textColor="text-neon-green"
                bgColor="bg-green-900/30 border border-green-500/30"
              />
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3" />{report.image_filename}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />{formatTimestamp(report.timestamp)}
              </span>
            </div>
          </div>

          {/* Export */}
          <button
            onClick={downloadReport}
            className="btn-secondary flex-shrink-0 self-start text-xs px-3 py-2"
            aria-label="Export compliance report as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/[0.06] overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                activeTab === tab.key
                  ? "border-b-2 border-neon-cyan text-neon-cyan bg-brand-600/10"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "text-xs rounded-full px-2 py-0.5 font-bold",
                  activeTab === tab.key
                    ? "bg-brand-600/30 text-neon-cyan"
                    : "bg-surface-700 text-slate-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* Violations */}
          {activeTab === "violations" && (
            <div className="space-y-4">
              {report.violations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(["all", "critical", "warning", "info"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterSeverity(f)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border font-semibold transition-all duration-200",
                        filterSeverity === f
                          ? "bg-brand-600 text-white border-brand-500 shadow-glow-blue"
                          : "glass-light text-slate-400 border-white/10 hover:border-brand-500/50 hover:text-white"
                      )}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                      {f !== "all" && (
                        <span className="ml-1.5 opacity-60">
                          ({report.violations.filter(v => v.severity === f).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {filteredViolations.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="w-10 h-10 text-neon-green opacity-60" />}
                  message={
                    report.violations.length === 0
                      ? "No violations found — label appears compliant."
                      : `No ${filterSeverity} violations.`
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredViolations.map((v, i) => (
                    <ViolationCard key={v.rule_id} violation={v} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Passed checks */}
          {activeTab === "passed" && (
            <div>
              {report.passed_checks.length === 0 ? (
                <EmptyState
                  icon={<AlertTriangle className="w-10 h-10 text-neon-amber opacity-60" />}
                  message="No checks passed — all mandatory fields need attention."
                />
              ) : (
                <ul className="space-y-2">
                  {report.passed_checks.map((check, i) => (
                    <li key={i}
                      className="flex items-start gap-3 text-sm text-slate-300
                                 glass-light rounded-xl border border-green-500/20 px-4 py-3
                                 bg-green-900/10 animate-fade-in"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-300">{check}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Extraction */}
          {activeTab === "extraction" && (
            <ExtractionTable extraction={report.extraction} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, count, textColor, bgColor }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  textColor: string;
  bgColor: string;
}) {
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5", bgColor, textColor)}>
      {icon}
      {count} {label}
    </span>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      {icon}
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
