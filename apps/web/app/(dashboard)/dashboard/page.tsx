"use client";

import { UserButton } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc/client";

export default function DashboardPage() {
  const { data: user, isLoading } = trpc.user.getMe.useQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">مساحة بوح</h1>
          <UserButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {isLoading ? (
            <p className="text-gray-500">جاري التحميل...</p>
          ) : user ? (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                مرحباً، {user.name ?? user.email}
              </h2>
              <p className="text-gray-500">هذه مساحتك الخاصة.</p>
            </div>
          ) : (
            <p className="text-gray-500">لم يتم العثور على بيانات المستخدم.</p>
          )}
        </div>
      </main>
    </div>
  );
}
