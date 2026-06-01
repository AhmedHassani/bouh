import { Sidebar, TopNav } from "@/components/ui/sidebar";

const navItems = [
  { href: "/consultant/dashboard", label: "لوحة التحكم", icon: "📊" },
  { href: "/consultant/appointments", label: "المواعيد", icon: "📅" },
  { href: "/consultant/availability", label: "أوقات العمل", icon: "🕐" },
  { href: "/consultant/earnings", label: "الأرباح والعمولات", icon: "💰" },
  { href: "/consultant/profile", label: "ملفي الشخصي", icon: "👤" },
];

export default function ConsultantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar
        items={navItems}
        title="مساحة بوح"
        subtitle="بوابة المستشار"
        footer={
          <a href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 px-4 py-2">
            <span>🏠</span> العودة للموقع
          </a>
        }
      />
      <div className="flex-1 flex flex-col">
        <TopNav title="بوابة المستشار" />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
