"use client";

import React from "react";
import { scoreGrade, scoreRingColor, statusLabel } from "@/lib/utils";
import type { ComplianceStatus } from "@/types";

interface Props {
  score: number;
  status: ComplianceStatus;
}

const SIZE = 150;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function ScoreGauge({ score, status }: Props) {
  const dashOffset = CIRC * (1 - score / 100);
  const color = scoreRingColor(score);
  const grade = scoreGrade(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full opacity-20"
          style={{ boxShadow: `0 0 30px ${color}` }} />

        <svg width={SIZE} height={SIZE} className="-rotate-90" style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}>
          {/* Track */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} />
          {/* Background arc tick marks */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
            const x1 = SIZE/2 + (R - 8) * Math.cos(angle);
            const y1 = SIZE/2 + (R - 8) * Math.sin(angle);
            const x2 = SIZE/2 + (R + 2) * Math.cos(angle);
            const y2 = SIZE/2 + (R + 2) * Math.sin(angle);
            return <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />;
          })}
          {/* Progress arc */}
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={color} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score.toFixed(0)}</span>
          <span className="text-xs text-slate-500 -mt-0.5">/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xl font-black" style={{ color }}>Grade {grade}</p>
        <p className="text-xs text-slate-500 mt-0.5">{statusLabel(status)}</p>
      </div>
    </div>
  );
}
