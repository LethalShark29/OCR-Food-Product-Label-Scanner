"use client";

import React, { useEffect, useRef, useState } from "react";
import type { BoundingBox, Violation } from "@/types";

interface Props {
  src: string;
  violations: Violation[];
  naturalWidth: number;
  naturalHeight: number;
}

const BOX_STYLE: Record<string, { stroke: string; fill: string; glow: string }> = {
  critical: { stroke: "#f87171", fill: "rgba(248,113,113,0.08)", glow: "rgba(248,113,113,0.6)" },
  warning:  { stroke: "#fbbf24", fill: "rgba(251,191,36,0.08)",  glow: "rgba(251,191,36,0.6)" },
  info:     { stroke: "#38bdf8", fill: "rgba(56,189,248,0.08)",  glow: "rgba(56,189,248,0.6)" },
};

export default function ImagePreview({ src, violations, naturalWidth, naturalHeight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const boxViolations = violations.filter(v => v.bounding_box);

  return (
    <div ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black"
      style={{ boxShadow: "0 0 30px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(56,189,248,0.05)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Product label" className="w-full h-auto block" />

      {/* SVG annotation overlay */}
      {naturalWidth > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
          preserveAspectRatio="none"
        >
          <defs>
            {boxViolations.map(v => {
              const style = BOX_STYLE[v.severity] ?? BOX_STYLE.info;
              return (
                <filter key={`glow-${v.rule_id}`} id={`glow-${v.rule_id}`}>
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              );
            })}
          </defs>

          {boxViolations.map(v => {
            const bb = v.bounding_box as BoundingBox;
            const style = BOX_STYLE[v.severity] ?? BOX_STYLE.info;
            const isHovered = hovered === v.rule_id;

            return (
              <g key={v.rule_id}>
                {/* Outer glow rect */}
                {isHovered && (
                  <rect
                    x={bb.x - 4} y={bb.y - 4}
                    width={bb.width + 8} height={bb.height + 8}
                    fill="none" stroke={style.glow}
                    strokeWidth={1} rx={6} opacity={0.4}
                    filter={`url(#glow-${v.rule_id})`}
                  />
                )}
                {/* Main rect */}
                <rect
                  x={bb.x} y={bb.y}
                  width={bb.width} height={bb.height}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isHovered ? 3 : 2}
                  rx={4}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHovered(v.rule_id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ filter: isHovered ? `drop-shadow(0 0 6px ${style.glow})` : undefined }}
                />
                {/* Rule ID label */}
                <rect
                  x={bb.x} y={bb.y - 20}
                  width={v.rule_id.length * 7 + 12} height={18}
                  fill={style.stroke} rx={3} opacity={0.9}
                />
                <text
                  x={bb.x + 6} y={bb.y - 6}
                  fill="#000" fontSize={11} fontWeight="bold" fontFamily="monospace"
                >
                  {v.rule_id}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Hover tooltip */}
      {hovered && (() => {
        const v = boxViolations.find(x => x.rule_id === hovered);
        if (!v?.bounding_box) return null;
        return (
          <div
            className="absolute z-20 max-w-xs glass rounded-xl border border-white/20 text-xs p-3 pointer-events-none shadow-glass"
            style={{
              left: `${(v.bounding_box.x / naturalWidth) * 100}%`,
              top:  `${((v.bounding_box.y + v.bounding_box.height) / naturalHeight) * 100 + 1}%`,
            }}
          >
            <p className="font-semibold text-slate-200">{v.title}</p>
            <p className="text-slate-500 mt-0.5">{v.regulation_ref}</p>
          </div>
        );
      })()}

      {/* Violation count badge */}
      {boxViolations.length > 0 && (
        <div className="absolute top-3 right-3 text-xs font-bold glass rounded-full px-2.5 py-1
                        border border-white/20 text-slate-300">
          {boxViolations.length} annotated
        </div>
      )}
    </div>
  );
}
