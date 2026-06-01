interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
}

const variants = {
  default: "bg-indigo-100 text-indigo-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function appointmentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    PENDING:     { label: "معلّق",      variant: "warning" },
    CONFIRMED:   { label: "مؤكد",       variant: "success" },
    COMPLETED:   { label: "مكتمل",      variant: "info" },
    CANCELLED:   { label: "ملغي",       variant: "danger" },
    NO_SHOW:     { label: "لم يحضر",    variant: "neutral" },
    RESCHEDULED: { label: "مُعاد جدولته", variant: "default" },
  };
  const cfg = map[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
