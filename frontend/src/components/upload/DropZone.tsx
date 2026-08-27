"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, ImageIcon, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import CameraScanner from "./CameraScanner";

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png":  [".png"],
  "image/webp": [".webp"],
  "image/bmp":  [".bmp"],
  "image/tiff": [".tif", ".tiff"],
};

export default function DropZone({ onFile, disabled }: DropZoneProps) {
  const [cameraOpen, setCameraOpen] = useState(false);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled,
  });

  return (
    <>
      {cameraOpen && (
        <CameraScanner
          onCapture={(file) => { setCameraOpen(false); onFile(file); }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="space-y-3">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            "relative flex flex-col items-center justify-center w-full min-h-56",
            "rounded-2xl border-2 border-dashed p-10 cursor-pointer",
            "transition-all duration-300 select-none overflow-hidden",
            isDragActive && !isDragReject
              ? "border-neon-cyan/70 bg-brand-600/10 scale-[1.01]"
              : isDragReject
              ? "border-neon-red/70 bg-red-900/10"
              : "border-white/10 bg-surface-800/60 hover:border-brand-400/50 hover:bg-surface-700/40",
            disabled && "opacity-40 cursor-not-allowed pointer-events-none"
          )}
        >
          <input {...getInputProps()} aria-label="Upload product label image" />

          {/* Background glow when dragging */}
          {isDragActive && !isDragReject && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(56,189,248,0.08), transparent 70%)" }} />
          )}

          {/* Corner brackets */}
          {!isDragActive && (
            <>
              <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-white/15 rounded-tl" />
              <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-white/15 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-white/15 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-white/15 rounded-br" />
            </>
          )}
          {isDragActive && !isDragReject && (
            <>
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-neon-cyan rounded-tl" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-neon-cyan rounded-tr" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-neon-cyan rounded-bl" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-neon-cyan rounded-br" />
            </>
          )}

          {/* Icon */}
          <div className={cn(
            "relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
            isDragActive && !isDragReject
              ? "bg-brand-600/30 shadow-glow-blue"
              : "bg-surface-700"
          )}>
            {isDragActive && !isDragReject ? (
              <UploadCloud className="w-8 h-8 text-neon-cyan animate-bounce" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-400" />
            )}
          </div>

          <p className="text-base font-semibold text-slate-200 mb-1">
            {isDragActive ? "Release to scan label" : "Drop a label image here"}
          </p>
          <p className="text-sm text-slate-500 mb-3">
            or{" "}
            <span className="text-neon-cyan font-medium cursor-pointer hover:underline">
              browse files
            </span>
          </p>
          <p className="text-xs text-slate-600">JPEG · PNG · WebP · BMP · TIFF — up to 10 MB</p>

          {isDragReject && (
            <p className="mt-3 text-sm text-neon-red font-medium">
              Unsupported file type or too large
            </p>
          )}
        </div>

        {/* Camera button */}
        <button
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-center gap-3 rounded-2xl py-4",
            "glass border border-white/10 hover:border-neon-cyan/40",
            "text-slate-300 hover:text-neon-cyan transition-all duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed group"
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 group-hover:bg-brand-600/30 flex items-center justify-center transition-colors">
            <Camera className="w-4 h-4 text-neon-cyan" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Use Camera Scanner</p>
            <p className="text-xs text-slate-500">Capture directly from your device camera</p>
          </div>
        </button>
      </div>
    </>
  );
}
