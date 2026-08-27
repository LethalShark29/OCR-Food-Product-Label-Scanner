"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.4;

export default function ImagePreview({ src, violations, naturalWidth, naturalHeight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const boxViolations = violations.filter(v => v.bounding_box);

  // ── Clamp pan so image never drifts out of view ───────────────────────────
  const clampPan = useCallback((z: number, px: number, py: number) => {
    const el = containerRef.current;
    if (!el) return { x: px, y: py };
    const { width, height } = el.getBoundingClientRect();
    const maxX = (width  * (z - 1)) / 2;
    const maxY = (height * (z - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, px)),
      y: Math.min(maxY, Math.max(-maxY, py)),
    };
  }, []);

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  function zoomIn() {
    setZoom(z => {
      const next = Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2));
      setPan(p => clampPan(next, p.x, p.y));
      return next;
    });
  }

  function zoomOut() {
    setZoom(z => {
      const next = Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2));
      const clamped = clampPan(next, pan.x, pan.y);
      setPan(clamped);
      return next;
    });
  }

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // ── Mouse wheel zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom(z => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2)));
        setPan(p => clampPan(next, p.x, p.y));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampPan]);

  // ── Drag to pan ───────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan(clampPan(zoom, dragStart.current.panX + dx, dragStart.current.panY + dy));
  }

  function onMouseUp() { setIsDragging(false); }

  // Touch drag
  const touchStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  function onTouchStart(e: React.TouchEvent) {
    if (zoom <= 1 || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (zoom <= 1 || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    setPan(clampPan(zoom, touchStart.current.panX + dx, touchStart.current.panY + dy));
  }

  // ── Pinch-to-zoom on touch ────────────────────────────────────────────────
  const lastPinchDist = useRef<number | null>(null);
  function onTouchPinch(e: React.TouchEvent) {
    if (e.touches.length !== 2) { lastPinchDist.current = null; return; }
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (lastPinchDist.current !== null) {
      const delta = (dist - lastPinchDist.current) * 0.01;
      setZoom(z => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2)));
        setPan(p => clampPan(next, p.x, p.y));
        return next;
      });
    }
    lastPinchDist.current = dist;
  }

  // ── Fullscreen toggle ─────────────────────────────────────────────────────
  function toggleFullscreen() {
    setFullscreen(f => {
      if (f) resetZoom();
      return !f;
    });
  }

  // ── Zoom percentage label ─────────────────────────────────────────────────
  const zoomPct = Math.round(zoom * 100);

  return (
    <>
      {/* ── Fullscreen backdrop ── */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) toggleFullscreen(); }}
        >
          {/* Fullscreen toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
            <span className="text-xs text-slate-400 font-mono">{zoomPct}%</span>
            <ZoomControls
              zoom={zoom} zoomIn={zoomIn} zoomOut={zoomOut}
              resetZoom={resetZoom} toggleFullscreen={toggleFullscreen}
              fullscreen={fullscreen}
            />
          </div>

          {/* Fullscreen image */}
          <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
            <ImageCanvas
              src={src}
              violations={violations}
              naturalWidth={naturalWidth}
              naturalHeight={naturalHeight}
              zoom={zoom}
              pan={pan}
              isDragging={isDragging}
              hovered={hovered}
              setHovered={setHovered}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchPinch={onTouchPinch}
              containerRef={containerRef}
              boxViolations={boxViolations}
              fullscreen={fullscreen}
            />
          </div>
        </div>
      )}

      {/* ── Inline card ── */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black"
        style={{ boxShadow: "0 0 30px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(56,189,248,0.05)" }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-surface-800/60">
          <div className="flex items-center gap-1.5">
            {/* Zoom out */}
            <ToolBtn onClick={zoomOut} disabled={zoom <= MIN_ZOOM} label="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </ToolBtn>

            {/* Zoom slider */}
            <div className="flex items-center gap-2 px-1">
              <input
                type="range"
                min={MIN_ZOOM * 100}
                max={MAX_ZOOM * 100}
                step={ZOOM_STEP * 100}
                value={zoomPct}
                onChange={e => {
                  const next = +e.target.value / 100;
                  setZoom(next);
                  setPan(p => clampPan(next, p.x, p.y));
                }}
                className="w-20 h-1 accent-neon-cyan cursor-pointer"
                aria-label="Zoom level"
              />
              <span className="text-xs font-mono text-neon-cyan w-9 text-right">
                {zoomPct}%
              </span>
            </div>

            {/* Zoom in */}
            <ToolBtn onClick={zoomIn} disabled={zoom >= MAX_ZOOM} label="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </ToolBtn>

            {/* Reset */}
            {zoom !== 1 && (
              <ToolBtn onClick={resetZoom} label="Reset zoom">
                <RotateCcw className="w-3.5 h-3.5" />
              </ToolBtn>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Annotation badge */}
            {boxViolations.length > 0 && (
              <span className="text-xs font-bold glass rounded-full px-2 py-0.5
                               border border-white/20 text-slate-400">
                {boxViolations.length} annotated
              </span>
            )}
            {/* Fullscreen */}
            <ToolBtn onClick={toggleFullscreen} label="Fullscreen">
              <Maximize2 className="w-3.5 h-3.5" />
            </ToolBtn>
          </div>
        </div>

        {/* Image area */}
        <ImageCanvas
          src={src}
          violations={violations}
          naturalWidth={naturalWidth}
          naturalHeight={naturalHeight}
          zoom={zoom}
          pan={pan}
          isDragging={isDragging}
          hovered={hovered}
          setHovered={setHovered}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchPinch={onTouchPinch}
          containerRef={containerRef}
          boxViolations={boxViolations}
          fullscreen={false}
        />

        {/* Pan hint */}
        {zoom > 1 && (
          <div className="px-3 py-1.5 border-t border-white/10 bg-surface-900/40 text-center">
            <p className="text-xs text-slate-600">
              Drag to pan · scroll to zoom · pinch on mobile
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({
  onClick, disabled, label, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150",
        "text-slate-400 hover:text-white hover:bg-white/10",
        "disabled:opacity-30 disabled:cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

// ── Zoom controls row (reused in fullscreen toolbar) ──────────────────────────

function ZoomControls({
  zoom, zoomIn, zoomOut, resetZoom, toggleFullscreen, fullscreen,
}: {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleFullscreen: () => void;
  fullscreen: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <ToolBtn onClick={zoomOut} disabled={zoom <= MIN_ZOOM} label="Zoom out">
        <ZoomOut className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={zoomIn} disabled={zoom >= MAX_ZOOM} label="Zoom in">
        <ZoomIn className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={resetZoom} label="Reset zoom">
        <RotateCcw className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn onClick={toggleFullscreen} label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
        <Maximize2 className="w-4 h-4" />
      </ToolBtn>
    </div>
  );
}

// ── Shared image + SVG canvas ─────────────────────────────────────────────────

interface CanvasProps {
  src: string;
  violations: Violation[];
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchPinch: (e: React.TouchEvent) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  boxViolations: Violation[];
  fullscreen: boolean;
}

function ImageCanvas({
  src, naturalWidth, naturalHeight,
  zoom, pan, isDragging,
  hovered, setHovered,
  onMouseDown, onMouseMove, onMouseUp,
  onTouchStart, onTouchMove, onTouchPinch,
  containerRef, boxViolations, fullscreen,
}: CanvasProps) {

  const imgStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
    transition: isDragging ? "none" : "transform 0.15s ease",
    cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
    userSelect: "none",
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden select-none",
        fullscreen ? "w-full h-full max-h-[80vh]" : "w-full"
      )}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={(e) => { onTouchStart(e); onTouchPinch(e); }}
      onTouchMove={(e) => { onTouchMove(e); onTouchPinch(e); }}
    >
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Product label"
        draggable={false}
        className={cn("block", fullscreen ? "max-h-[80vh] mx-auto object-contain" : "w-full h-auto")}
        style={imgStyle}
      />

      {/* SVG annotation overlay */}
      {naturalWidth > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
          preserveAspectRatio="none"
          style={imgStyle}
        >
          <defs>
            {boxViolations.map(v => (
              <filter key={`glow-${v.rule_id}`} id={`glow-${v.rule_id}`}>
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {boxViolations.map(v => {
            const bb = v.bounding_box as BoundingBox;
            const style = BOX_STYLE[v.severity] ?? BOX_STYLE.info;
            const isHov = hovered === v.rule_id;

            return (
              <g key={v.rule_id}>
                {isHov && (
                  <rect
                    x={bb.x - 4} y={bb.y - 4}
                    width={bb.width + 8} height={bb.height + 8}
                    fill="none" stroke={style.glow}
                    strokeWidth={1} rx={6} opacity={0.4}
                    filter={`url(#glow-${v.rule_id})`}
                  />
                )}
                <rect
                  x={bb.x} y={bb.y}
                  width={bb.width} height={bb.height}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isHov ? 3 : 2}
                  rx={4}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHovered(v.rule_id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ filter: isHov ? `drop-shadow(0 0 6px ${style.glow})` : undefined }}
                />
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
            className="absolute z-20 max-w-xs glass rounded-xl border border-white/20
                       text-xs p-3 pointer-events-none shadow-glass"
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
    </div>
  );
}
