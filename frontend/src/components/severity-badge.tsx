import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const severityVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
  {
    variants: {
      severity: {
        Critical: "bg-sev-critical text-sev-critical-foreground",
        High: "bg-sev-high text-sev-high-foreground",
        Medium: "bg-sev-medium text-sev-medium-foreground",
        Low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
      },
    },
    defaultVariants: { severity: "Medium" },
  }
);

export function SeverityBadge({
  severity,
  className,
}: {
  severity?: string;
  className?: string;
}) {
  const normalized = severity
    ? (severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()) as
        | "Critical"
        | "High"
        | "Medium"
        | "Low"
    : "Medium";

  const safeSeverity = ["Critical", "High", "Medium", "Low"].includes(normalized)
    ? normalized
    : "Medium";

  return (
    <span className={cn(severityVariants({ severity: safeSeverity }), className)}>
      {safeSeverity}
    </span>
  );
}

export type SeverityVariantProps = VariantProps<typeof severityVariants>;
