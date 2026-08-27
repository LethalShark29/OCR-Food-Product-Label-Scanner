"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Camera, X, ZoomIn, RotateCcw, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setReady(false);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access in your browser settings."
          : "Could not access camera. Make sure no other app is using it."
      );
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, startCamera]);

  function flipCamera() {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current || !ready) return;
    setScanning(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    setTimeout(() => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            setScanning(false);
            onCapture(file);
          }
        },
        "image/jpeg",
        0.92
      );
    }, 600); // slight delay so the scan animation plays
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
              <p className="text-xs text-slate-400">Point camera at the product label</p>
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

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ aspectRatio: "16/10" }}>
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Camera className="w-12 h-12 text-slate-600" />
              <p className="text-sm text-slate-400">{error}</p>
              <button onClick={() => startCamera(facingMode)} className="btn-secondary text-xs px-4 py-2">
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
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

              {/* Scanner overlay — only when capturing */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="scanner-line absolute inset-x-0" style={{ top: "50%" }} />
                  <div className="absolute inset-0 bg-brand-500/5" />
                </div>
              )}

              {/* Scanning frame guide */}
              {ready && !scanning && (
                <div className="absolute inset-6 pointer-events-none">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-neon-cyan rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-neon-cyan rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-neon-cyan rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-neon-cyan rounded-br-lg" />

                  {/* Subtle pulse ring */}
                  <div className="absolute inset-0 border border-neon-cyan/20 rounded-lg animate-pulse-slow" />

                  {/* Label hint */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <span className="text-xs text-neon-cyan/80 bg-black/40 rounded-full px-3 py-1 backdrop-blur-sm">
                      Align label within frame
                    </span>
                  </div>
                </div>
              )}

              {/* Not ready overlay */}
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
          {/* Flip camera */}
          <button
            onClick={flipCamera}
            disabled={!ready}
            className="w-10 h-10 rounded-xl glass-light flex items-center justify-center
                       hover:border-white/20 disabled:opacity-40 transition-colors"
            aria-label="Flip camera"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
          </button>

          {/* Capture button */}
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
            {scanning ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white" />
            )}
            {/* Outer ring pulse */}
            {ready && !scanning && (
              <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: "rgba(56,189,248,0.4)" }} />
            )}
          </button>

          {/* Zoom hint */}
          <div className="w-10 h-10 rounded-xl glass-light flex items-center justify-center opacity-50">
            <ZoomIn className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
