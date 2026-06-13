"use client";

import { Sidebar, TopNav } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuthStore } from "@/lib/stores/authStore";
import { trpc } from "@/lib/trpc/client";
import { useTokenRefresh } from "@/lib/hooks/useTokenRefresh";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/consultant/dashboard", label: "لوحة التحكم" },
  { href: "/consultant/appointments", label: "الجلسات" },
  { href: "/consultant/reports", label: "التقارير" },
  { href: "/consultant/availability", label: "أوقات العمل" },
  { href: "/consultant/earnings", label: "الأرباح والعمولات" },
  { href: "/consultant/profile", label: "ملفي الشخصي" },
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
      className="text-sm text-red-500 hover:text-red-700 px-4 py-2 transition-colors text-right"
    >
      تسجيل الخروج
    </button>
  );
}

export default function ConsultantLayout({ children }: { children: React.ReactNode }) {
  useTokenRefresh();
  const { user } = useAuthStore();

  return (
    <div className="flex min-h-screen" dir="rtl">
      <Sidebar
        items={navItems}
        title="مساحة بوح"
        subtitle="بوابة المستشار"
        footer={<LogoutButton />}
      />
      <div className="flex-1 flex flex-col">
        <TopNav
          title="بوابة المستشار"
          right={
            <div className="flex items-center gap-3">
              <NotificationBell userId={user?.id} />
              <span className="text-sm text-gray-500">{user?.name ?? user?.email}</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                {user?.name?.[0] ?? "م"}
              </div>
            </div>
          }
        />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
