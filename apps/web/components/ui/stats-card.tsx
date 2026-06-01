interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  color?: "indigo" | "emerald" | "amber" | "rose" | "purple";
}

const colorMap = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  purple: "bg-purple-50 text-purple-600",
};

export function StatsCard({ title, value, subtitle, icon, trend, color = "indigo" }: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && (
          <span className={`p-2 rounded-xl ${colorMap[color]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      {trend && (
        <p className={`text-xs mt-2 font-medium ${trend.value >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
