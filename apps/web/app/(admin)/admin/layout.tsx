"use client";

import { Sidebar, TopNav } from "@/components/ui/sidebar";
import { useAuthStore } from "@/lib/stores/authStore";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "لوحة التحكم", icon: "📊" },
  { href: "/admin/consultants", label: "المستشارون", icon: "👩‍⚕️" },
  { href: "/admin/specializations", label: "التخصصات", icon: "🧠" },
  { href: "/admin/coupons", label: "الكوبونات", icon: "🎟️" },
  { href: "/admin/assessments", label: "الاختبارات النفسية", icon: "📋" },
  { href: "/admin/settings", label: "إعدادات المنصة", icon: "⚙️" },
];

function LogoutButton() {
  const router = useRouter();
  const { clearAuth, refreshToken } = useAuthStore();
  const logout = trpc.auth.logout.useMutation({
    onSettled: () => {
      clearAuth();
      document.cookie = "misahuh_access_token=; path=/; max-age=0";
      router.push("/login");
    },
  });

  return (
    <button
      onClick={() => logout.mutate({ refreshToken: refreshToken ?? undefined })}
      className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 px-4 py-2 transition-colors"
    >
      <span>🚪</span> تسجيل الخروج
    </button>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar
        items={navItems}
        title="مساحة بوح"
        subtitle="بوابة الإدارة"
        footer={<LogoutButton />}
      />
      <div className="flex-1 flex flex-col">
        <TopNav
          title="بوابة الإدارة"
          right={
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{user?.name ?? user?.email}</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                {user?.name?.[0] ?? "A"}
              </div>
            </div>
          }
        />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
