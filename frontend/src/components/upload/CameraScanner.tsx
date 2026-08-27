"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Camera, X, ZoomIn, RotateCcw, Scan, ImagePlus, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/** Camera API requires HTTPS (or localhost). Detect plain HTTP over network. */
function isInsecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "http:" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  );
}

export default function CameraScanner({ onCapture, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready,      setReady]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [scanning,   setScanning]   = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const insecure = isInsecureContext();

  // ── Native file-input (works on HTTP) ─────────────────────────────────────
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  }

  // ── Live camera (HTTPS / localhost only) ──────────────────────────────────
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setReady(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError("Could not access camera.");
      }
    }
  }, []);

  useEffect(() => {
    if (!insecure) startCamera(facingMode);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [facingMode, startCamera, insecure]);

  function flipCamera() {
    setFacingMode(f => f === "environment" ? "user" : "environment");
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current || !ready) return;
    setScanning(true);
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setTimeout(() => {
      canvas.toBlob(blob => {
        if (blob) {
          onCapture(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
          setScanning(false);
        }
      }, "image/jpeg", 0.92);
    }, 600);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="glass rounded-2xl overflow-hidden w-full max-w-lg neon-border-blue border animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Scan className="w-4 h-4 text-neon-cyan" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Label Scanner</p>
              <p className="text-xs text-slate-400">
                {insecure ? "Select or capture a label photo" : "Point camera at the product label"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg glass-light flex items-center justify-center hover:border-white/20 transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* ── HTTP fallback UI ── */}
        {insecure ? (
          <div className="p-6 space-y-5">
            {/* Warning */}
            <div className="glass-light rounded-xl border border-amber-500/30 bg-amber-900/10 px-4 py-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-neon-amber flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-300 mb-1">
                    HTTPS required for live camera
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Browsers block live camera access on plain HTTP for security.
                    Use the options below to capture or upload a label photo.
                  </p>
                </div>
              </div>
            </div>

            {/* Option 1 — native camera capture */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Option 1 — Take a photo now
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInput}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 rounded-xl py-5
                           border-2 border-dashed border-neon-cyan/40 bg-brand-600/10
                           hover:bg-brand-600/20 hover:border-neon-cyan/70
                           transition-all duration-200"
              >
                <Camera className="w-6 h-6 text-neon-cyan" />
                <div className="text-left">
                  <p className="text-sm font-bold text-neon-cyan">Open Phone Camera</p>
                  <p className="text-xs text-slate-400 font-normal">
                    Takes a photo and sends it directly for analysis
                  </p>
                </div>
              </button>
            </div>

            {/* Option 2 — gallery */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Option 2 — Upload from gallery
              </p>
              <input
                type="file"
                accept="image/*"
                id="gallery-input-scanner"
                className="hidden"
                onChange={handleFileInput}
              />
              <label
                htmlFor="gallery-input-scanner"
                className="w-full flex items-center justify-center gap-3 rounded-xl py-4
                           glass-light border border-white/10 hover:border-white/20
                           text-slate-300 hover:text-white cursor-pointer
                           transition-all duration-200"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-sm font-semibold">Choose from Gallery</span>
              </label>
            </div>

            <p className="text-xs text-slate-600 text-center leading-relaxed">
              For live camera scanning, open{" "}
              <span className="text-neon-cyan font-mono">localhost:3000</span> on
              this device, or deploy to a server with HTTPS.
            </p>
          </div>

        ) : (
          /* ── Live camera UI (HTTPS / localhost) ── */
          <>
            <div className="relative bg-black" style={{ aspectRatio: "16/10" }}>
              {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <Camera className="w-12 h-12 text-slate-600" />
                  <p className="text-sm text-slate-400">{error}</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn-primary text-xs px-4 py-2 gap-2"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    Use Phone Camera Instead
                  </button>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="btn-secondary text-xs px-4 py-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry Live Camera
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {scanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="scanner-line absolute inset-x-0" style={{ top: "50%" }} />
                      <div className="absolute inset-0 bg-brand-500/5" />
                    </div>
                  )}

                  {ready && !scanning && (
                    <div className="absolute inset-6 pointer-events-none">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-neon-cyan rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-neon-cyan rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-neon-cyan rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-neon-cyan rounded-br-lg" />
                      <div className="absolute inset-0 border border-neon-cyan/20 rounded-lg animate-pulse-slow" />
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                        <span className="text-xs text-neon-cyan/80 bg-black/40 rounded-full px-3 py-1 backdrop-blur-sm">
                          Align label within frame
                        </span>
                      </div>
                    </div>
                  )}

                  {!ready && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-400">Starting camera…</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
              <button
                onClick={flipCamera}
                disabled={!ready}
                className="w-10 h-10 rounded-xl glass-light flex items-center justify-center hover:border-white/20 disabled:opacity-40 transition-colors"
                aria-label="Flip camera"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={capture}
                disabled={!ready || scanning}
                aria-label="Capture label"
                className={cn(
                  "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  ready && !scanning && "hover:scale-105 active:scale-95"
                )}
                style={{
                  background: "linear-gradient(135deg, #2563eb, #38bdf8)",
                  boxShadow: ready ? "0 0 24px rgba(56,189,248,0.5)" : "none",
                }}
              >
                {scanning
                  ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera className="w-7 h-7 text-white" />
                }
                {ready && !scanning && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping opacity-20"
                    style={{ background: "rgba(56,189,248,0.4)" }}
                  />
                )}
              </button>

              <div className="w-10 h-10 rounded-xl glass-light flex items-center justify-center opacity-50">
                <ZoomIn className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
