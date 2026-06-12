"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon?: string;
  badgeKey?: string;
}

interface SidebarProps {
  items: NavItem[];
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  badges?: Record<string, number>; // map of badgeKey → count
}

export function Sidebar({ items, title, subtitle, footer, badges }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-l border-gray-100 flex flex-col h-screen sticky top-0 shadow-sm">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
        <h2 className="font-bold text-gray-900 text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Nav — scrollable */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = item.badgeKey ? badges?.[item.badgeKey] ?? 0 : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
            >
              {item.icon && <span className="text-lg leading-none">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — always pinned to bottom */}
      {footer && <div className="flex-shrink-0 px-3 py-4 border-t border-gray-100">{footer}</div>}
    </aside>
  );
}

// ─── Top Nav Bar ──────────────────────────────────────────────────────────────

interface TopNavProps {
  title: string;
  right?: React.ReactNode;
}

export function TopNav({ title, right }: TopNavProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}
