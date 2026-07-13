import { CheckIcon, LoaderIcon, TriangleAlertIcon, UploadIcon, ScanEyeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OcrStatus } from "@/lib/types";

const STATUS_CONFIG: Record<OcrStatus, { label: string; icon: React.ElementType; className: string }> = {
  uploading: {
    label: "Uploading",
    icon: UploadIcon,
    className: "bg-muted text-muted-foreground",
  },
  ocr: {
    label: "Reading scoreboard",
    icon: ScanEyeIcon,
    className: "bg-[color-mix(in_oklch,var(--brand-yellow),transparent_80%)] text-[color-mix(in_oklch,var(--brand-yellow),var(--foreground)_35%)]",
  },
  calculating: {
    label: "Calculating",
    icon: LoaderIcon,
    className: "bg-[color-mix(in_oklch,var(--chart-4),transparent_80%)] text-[color-mix(in_oklch,var(--chart-4),var(--foreground)_20%)]",
  },
  completed: {
    label: "Confirmed",
    icon: CheckIcon,
    className: "bg-primary/15 text-primary",
  },
  failed: {
    label: "Needs attention",
    icon: TriangleAlertIcon,
    className: "bg-destructive/15 text-destructive",
  },
};

const ANIMATED = new Set<OcrStatus>(["uploading", "ocr", "calculating"]);

export function OcrStatusBadge({ status }: { status: OcrStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className
      )}
    >
      <Icon className={cn("size-3.5", ANIMATED.has(status) && "animate-pulse")} />
      {config.label}
    </span>
  );
}
