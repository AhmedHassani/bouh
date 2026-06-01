import { Sidebar, TopNav } from "@/components/ui/sidebar";

const navItems = [
  { href: "/admin", label: "لوحة التحكم", icon: "📊" },
  { href: "/admin/consultants", label: "المستشارون", icon: "👩‍⚕️" },
  { href: "/admin/specializations", label: "التخصصات", icon: "🧠" },
  { href: "/admin/coupons", label: "الكوبونات", icon: "🎟️" },
  { href: "/admin/assessments", label: "الاختبارات النفسية", icon: "📋" },
  { href: "/admin/settings", label: "إعدادات المنصة", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar
        items={navItems}
        title="مساحة بوح"
        subtitle="بوابة الإدارة"
        footer={
          <a href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 px-4 py-2">
            <span>🏠</span> العودة للموقع
          </a>
        }
      />
      <div className="flex-1 flex flex-col">
        <TopNav title="بوابة الإدارة" right={
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
            A
          </div>
        } />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
