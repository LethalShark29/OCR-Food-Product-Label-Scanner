"use client";

import React, { useState, useCallback } from "react";
import { RefreshCw, ShieldCheck, Zap, Eye, Scan, AlertCircle, TrendingDown } from "lucide-react";
import DropZone from "@/components/upload/DropZone";
import ImagePreview from "@/components/upload/ImagePreview";
import ComplianceReportPanel from "@/components/report/ComplianceReport";
import ManualOverridePanel from "@/components/report/ManualOverridePanel";
import { analyzeLabel, recheckLabel } from "@/lib/api";
import type { ComplianceReport } from "@/types";
import { cn } from "@/lib/utils";

type AppState = "idle" | "loading" | "done" | "error";

const STEPS = [
  { label: "Pre-processing image", icon: "🔍" },
  { label: "Running OCR extraction", icon: "📄" },
  { label: "Checking compliance rules", icon: "⚖️" },
  { label: "Generating report", icon: "📊" },
];

export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
  const [loadStep, setLoadStep] = useState(0);
  const [isRechecking, setIsRechecking] = useState(false);
  const [overriddenFields, setOverriddenFields] = useState<string[]>([]);
  const [recheckError, setRecheckError] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setReport(null);
    setErrorMsg(null);
    setLoadStep(0);
    setState("loading");

    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;

    // Animate through loading steps
    const stepInterval = setInterval(() => {
      setLoadStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 1400);

    try {
      const res = await analyzeLabel(f);
      clearInterval(stepInterval);
      if (res.success && res.report) {
        setReport(res.report);
        setState("done");
      } else {
        setErrorMsg(res.error || "Analysis returned no report.");
        setState("error");
      }
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      setState("error");
    }
  }, []);

  const handleRecheck = useCallback(async (overrides: Record<string, string>) => {
    if (!report) return;
    setIsRechecking(true);
    setRecheckError(null);
    try {
      const res = await recheckLabel({
        overrides,
        original_extraction: report.extraction,
      });
      if (res.success && res.report) {
        setReport(res.report);
        setOverriddenFields(res.overridden_fields);
      } else {
        setRecheckError(res.error || "Recheck returned no report.");
      }
    } catch (err: unknown) {
      setRecheckError(err instanceof Error ? err.message : "Recheck failed");
    } finally {
      setIsRechecking(false);
    }
  }, [report]);

  function reset() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setReport(null);
    setErrorMsg(null);
    setImgDimensions({ w: 0, h: 0 });
    setLoadStep(0);
    setOverriddenFields([]);
    setRecheckError(null);
    setState("idle");
  }

  return (
    <div className="relative min-h-full">
      {/* Hero glow */}
      <div className="absolute top-0 left-0 right-0 h-96 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56,189,248,0.1), transparent)" }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Hero (idle only) ── */}
        {state === "idle" && (
          <div className="text-center mb-12 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6 border border-white/10">
              <Scan className="w-3.5 h-3.5 text-neon-cyan" />
              <span className="text-xs font-semibold text-neon-cyan tracking-widest uppercase">
                AI-Powered Label Inspection
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-4">
              <span className="text-white">Compliance</span>{" "}
              <span className="text-gradient">Copilot</span>
            </h1>
            <p className="text-slate-400 max-w-lg mx-auto text-base sm:text-lg leading-relaxed">
              Photograph any packaged product label. Our OCR engine extracts key fields and
              checks them against Indian{" "}
              <span className="text-slate-300">Legal Metrology</span> &amp;{" "}
              <span className="text-slate-300">FSSAI</span> regulations instantly.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {[
                { icon: <Eye className="w-3.5 h-3.5" />, text: "OCR Field Extraction", color: "text-neon-cyan" },
                { icon: <ShieldCheck className="w-3.5 h-3.5" />, text: "10+ Compliance Rules", color: "text-neon-green" },
                { icon: <Zap className="w-3.5 h-3.5" />, text: "Instant Report", color: "text-neon-amber" },
                { icon: <Scan className="w-3.5 h-3.5" />, text: "Camera Scanner", color: "text-brand-400" },
              ].map((f) => (
                <span key={f.text}
                  className="flex items-center gap-1.5 text-xs font-semibold glass rounded-full px-3.5 py-2 border border-white/10 text-slate-300">
                  <span className={f.color}>{f.icon}</span>
                  {f.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className={cn(
          "grid gap-6",
          state === "done"
            ? "grid-cols-1 lg:grid-cols-5"
            : "grid-cols-1 lg:grid-cols-3 max-w-5xl mx-auto w-full"
        )}>

          {/* Left column */}
          <div className={cn(state === "done" ? "lg:col-span-2" : "lg:col-span-2")}>

            {/* Drop zone */}
            {state === "idle" && <DropZone onFile={handleFile} />}

            {/* Loading */}
            {state === "loading" && (
              <div className="glass rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-6 neon-border-blue">
                {/* Spinner */}
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-brand-600/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-neon-cyan border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-2 rounded-full border border-dashed border-brand-400/20 animate-spin" style={{ animationDirection: "reverse", animationDuration: "3s" }} />
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">
                    {STEPS[loadStep].icon}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Analysing label…</p>
                  <p className="text-xs text-neon-cyan animate-pulse">{STEPS[loadStep].label}</p>
                </div>

                {/* Step indicators */}
                <div className="w-full space-y-2">
                  {STEPS.map((step, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300",
                      i === loadStep ? "bg-brand-600/20 border border-brand-500/30" :
                      i < loadStep  ? "opacity-60" : "opacity-25"
                    )}>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs",
                        i < loadStep  ? "bg-neon-green/20 text-neon-green" :
                        i === loadStep ? "bg-brand-600/40 text-neon-cyan" : "bg-surface-600 text-slate-500"
                      )}>
                        {i < loadStep ? "✓" : i + 1}
                      </div>
                      <span className="text-xs text-slate-300">{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Image preview */}
            {previewUrl && state !== "idle" && (
              <div className={cn("space-y-3", state === "loading" && "mt-4")}>
                {state !== "loading" && (
                  <ImagePreview
                    src={previewUrl}
                    violations={report?.violations ?? []}
                    naturalWidth={imgDimensions.w}
                    naturalHeight={imgDimensions.h}
                  />
                )}
                {file && state !== "loading" && (
                  <p className="text-xs text-slate-600 text-center truncate px-2">{file.name}</p>
                )}
              </div>
            )}

            {/* Reset */}
            {(state === "done" || state === "error") && (
              <button onClick={reset} className="btn-secondary w-full mt-4">
                <RefreshCw className="w-4 h-4" />
                Inspect another label
              </button>
            )}

            {/* Error */}
            {state === "error" && (
              <div className="mt-4 glass rounded-xl border border-red-500/30 px-4 py-4 neon-border-red">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-neon-red flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-300">Analysis failed</p>
                </div>
                <p className="text-xs text-slate-400">{errorMsg}</p>
                <p className="text-xs mt-2 text-slate-600">
                  Make sure the backend is running on{" "}
                  <code className="text-neon-cyan bg-surface-700 rounded px-1">localhost:8000</code>
                </p>
              </div>
            )}
          </div>

          {/* Right column — report */}
          {state === "done" && report && (
            <div className="lg:col-span-3 animate-slide-in-right space-y-5">
              <ComplianceReportPanel report={report} />

              {/* Manual override panel */}
              <ManualOverridePanel
                extraction={report.extraction}
                report={report}
                onRecheck={handleRecheck}
                overriddenFields={overriddenFields}
                isRechecking={isRechecking}
              />

              {/* Recheck error */}
              {recheckError && (
                <div className="glass rounded-xl border border-red-500/30 px-4 py-3 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-neon-red flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-300 mb-0.5">Re-check failed</p>
                    <p className="text-xs text-slate-500">{recheckError}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grading guide column — idle only */}
          {state === "idle" && <GradingGuide />}
        </div>

        {/* ── How it works (idle only) ── */}
        {state === "idle" && (
          <div className="mt-20 animate-fade-in">
            <p className="text-center text-xs font-bold text-slate-600 uppercase tracking-widest mb-8">
              How it works
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { step: "01", title: "Upload or Scan", body: "Drop a photo or use the live camera scanner to capture the product label.", icon: "📷" },
                { step: "02", title: "OCR Engine", body: "Computer vision extracts MRP, quantity, manufacturer, FSSAI number and more.", icon: "🔍" },
                { step: "03", title: "Rules Engine", body: "10+ rules run against Legal Metrology (PC) Rules 2011 and FSSAI 2020.", icon: "⚖️" },
                { step: "04", title: "Instant Report", body: "Get a compliance score, flagged violations with evidence, and export to JSON.", icon: "📊" },
              ].map((s, i) => (
                <div key={s.step}
                  className="glass rounded-2xl border border-white/[0.06] p-5 text-center
                             hover:border-brand-500/30 transition-all duration-300 hover:-translate-y-1 group"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="text-2xl mb-3 group-hover:animate-float">{s.icon}</div>
                  <span className="inline-block text-xs font-black text-neon-cyan mb-2
                                   bg-brand-600/15 rounded-full px-2.5 py-0.5">
                    {s.step}
                  </span>
                  <p className="font-semibold text-slate-200 mb-1.5 text-sm">{s.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grading Guide sidebar ─────────────────────────────────────────────────────

const GRADES = [
  {
    grade: "A",
    range: "90 – 100",
    label: "Excellent",
    color: "#4ade80",
    bg: "bg-green-900/20",
    border: "border-green-500/30",
    desc: "All mandatory fields present and correctly formatted. Label is fully compliant.",
  },
  {
    grade: "B",
    range: "75 – 89",
    label: "Good",
    color: "#86efac",
    bg: "bg-green-900/10",
    border: "border-green-500/20",
    desc: "Minor formatting issues detected but no critical fields missing.",
  },
  {
    grade: "C",
    range: "60 – 74",
    label: "Needs Review",
    color: "#fbbf24",
    bg: "bg-amber-900/20",
    border: "border-amber-500/30",
    desc: "Some warnings found. Review and correct before distribution.",
  },
  {
    grade: "D",
    range: "40 – 59",
    label: "Poor",
    color: "#fb923c",
    bg: "bg-orange-900/20",
    border: "border-orange-500/30",
    desc: "Multiple issues including at least one critical missing field.",
  },
  {
    grade: "F",
    range: "0 – 39",
    label: "Fail",
    color: "#f87171",
    bg: "bg-red-900/20",
    border: "border-red-500/30",
    desc: "Several critical mandatory fields absent. Label is non-compliant.",
  },
];

const DEDUCTIONS = [
  { label: "Critical violation", points: "−20 pts", color: "text-neon-red",   dot: "bg-neon-red" },
  { label: "Warning",            points: "−8 pts",  color: "text-neon-amber", dot: "bg-neon-amber" },
  { label: "Info observation",   points: "−2 pts",  color: "text-neon-blue",  dot: "bg-neon-blue" },
];

function GradingGuide() {
  return (
    <div className="lg:col-span-1 space-y-4 animate-fade-in">
      {/* Header card */}
      <div className="glass rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-4 h-4 text-neon-cyan" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Grading System</p>
            <p className="text-xs text-slate-500">How compliance scores work</p>
          </div>
        </div>

        {/* Score formula */}
        <div className="glass-light rounded-xl border border-white/[0.06] px-4 py-3 mb-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Starting score</p>
          <p className="text-2xl font-black text-white">100</p>
          <p className="text-xs text-slate-600 mt-1">deductions applied per violation</p>
        </div>

        {/* Deduction table */}
        <div className="space-y-2">
          {DEDUCTIONS.map((d) => (
            <div key={d.label}
              className="flex items-center justify-between rounded-lg bg-surface-800/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.dot}`} />
                <span className="text-xs text-slate-400">{d.label}</span>
              </div>
              <span className={`text-xs font-bold font-mono ${d.color}`}>{d.points}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-600 mt-3 text-center">
          Score is clamped to a minimum of 0
        </p>
      </div>

      {/* Grade bands */}
      <div className="glass rounded-2xl border border-white/[0.06] p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          Grade Bands
        </p>
        <div className="space-y-2.5">
          {GRADES.map((g) => (
            <div
              key={g.grade}
              className={`rounded-xl border ${g.bg} ${g.border} px-3 py-3
                          transition-all duration-200 hover:scale-[1.01] cursor-default`}
            >
              <div className="flex items-center gap-3">
                {/* Grade letter */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-lg"
                  style={{ color: g.color, background: `${g.color}18`, border: `1px solid ${g.color}40` }}
                >
                  {g.grade}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold" style={{ color: g.color }}>
                      {g.label}
                    </span>
                    <span className="text-xs font-mono text-slate-500">{g.range}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{g.desc}</p>
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-2.5 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: g.grade === "A" ? "100%" : g.grade === "B" ? "82%" : g.grade === "C" ? "67%" : g.grade === "D" ? "50%" : "20%",
                    background: `linear-gradient(90deg, ${g.color}80, ${g.color})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status labels */}
      <div className="glass rounded-2xl border border-white/[0.06] p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
          Overall Status
        </p>
        <div className="space-y-2">
          {[
            { label: "Compliant",      cond: "Score ≥ 75, no criticals", color: "#4ade80", dot: "bg-neon-green" },
            { label: "Needs Review",   cond: "Score 50 – 74",            color: "#fbbf24", dot: "bg-neon-amber" },
            { label: "Non-Compliant",  cond: "Score < 50 or any critical",color: "#f87171", dot: "bg-neon-red" },
          ].map((s) => (
            <div key={s.label} className="flex items-start gap-2.5">
              <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${s.dot} animate-pulse-slow`} />
              <div>
                <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-xs text-slate-600"> — {s.cond}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
