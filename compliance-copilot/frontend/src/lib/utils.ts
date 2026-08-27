import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComplianceStatus, Severity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: Severity): string {
  return {
    critical: "text-red-600",
    warning:  "text-amber-500",
    info:     "text-blue-500",
  }[severity] ?? "text-gray-500";
}

export function severityBg(severity: Severity): string {
  return {
    critical: "bg-red-50 border-red-200",
    warning:  "bg-amber-50 border-amber-200",
    info:     "bg-blue-50 border-blue-200",
  }[severity] ?? "bg-gray-50 border-gray-200";
}

export function severityBadge(severity: Severity): string {
  return {
    critical: "bg-red-100 text-red-700 border border-red-300",
    warning:  "bg-amber-100 text-amber-700 border border-amber-300",
    info:     "bg-blue-100 text-blue-700 border border-blue-300",
  }[severity] ?? "bg-gray-100 text-gray-600";
}

export function statusColor(status: ComplianceStatus): string {
  return {
    compliant:      "text-emerald-600",
    non_compliant:  "text-red-600",
    needs_review:   "text-amber-500",
  }[status] ?? "text-gray-600";
}

export function statusBg(status: ComplianceStatus): string {
  return {
    compliant:      "bg-emerald-50 border-emerald-300",
    non_compliant:  "bg-red-50 border-red-300",
    needs_review:   "bg-amber-50 border-amber-300",
  }[status] ?? "bg-gray-50";
}

export function statusLabel(status: ComplianceStatus): string {
  return {
    compliant:      "Compliant",
    non_compliant:  "Non-Compliant",
    needs_review:   "Needs Review",
  }[status] ?? status;
}

export function fieldLabel(fieldName: string): string {
  const MAP: Record<string, string> = {
    mrp:                  "MRP",
    net_quantity:         "Net Quantity",
    manufacturer_name:    "Manufacturer Name",
    manufacturer_address: "Manufacturer Address",
    country_of_origin:    "Country of Origin",
    best_before:          "Best Before / Expiry",
    batch_lot_number:     "Batch / Lot Number",
    customer_care:        "Consumer Care Contact",
    fssai_license:        "FSSAI Licence No.",
    ingredients:          "Ingredients",
    nutritional_info:     "Nutritional Information",
    allergen_info:        "Allergen Declaration",
    veg_nonveg_symbol:    "Veg / Non-Veg Symbol",
    language_declaration: "Language Compliance",
  };
  return MAP[fieldName] ?? fieldName.replace(/_/g, " ");
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function scoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function scoreRingColor(score: number): string {
  if (score >= 75) return "#10b981"; // emerald
  if (score >= 50) return "#f59e0b"; // amber
  return "#ef4444";                  // red
}
