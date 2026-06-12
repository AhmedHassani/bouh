"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

function formatRelative(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  if (hours < 24)   return `قبل ${hours} ساعة`;
  if (days < 7)     return `قبل ${days} يوم`;
  if (days < 30)    return `قبل ${Math.floor(days / 7)} أسابيع`;
  return `قبل ${Math.floor(days / 30)} شهر`;
}

export default function ReportsPage() {
  const { data: clients, isLoading } = trpc.sessionReport.listClients.useQuery();
  const [search, setSearch] = useState("");

  const filtered = (clients ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir="rtl" className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">التقارير الخاصة</h1>
        <p className="text-sm text-gray-400">
          تقاريرك السرية لكل عميل — لا يستطيع أحد رؤيتها سواك
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
          🔒
        </div>
        <div className="text-right flex-1">
          <p className="text-sm font-bold text-indigo-900">خصوصية كاملة</p>
          <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
            هذه التقارير سرية — لا يطّلع عليها الإدارة ولا أي مستشار آخر.
            تستطيع كتابة التقرير بعد اكتمال الجلسة من صفحة الجلسات.
          </p>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ابحث باسم العميل..."
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 text-right placeholder:text-gray-300 mb-5"
      />

      {/* Clients list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <p className="text-5xl mb-3">📝</p>
          <p className="text-sm text-gray-400">لا توجد تقارير بعد</p>
          <p className="text-xs text-gray-300 mt-2">
            ستظهر هنا قائمة العملاء بعد كتابة أول تقرير
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.key}
              href={`/consultant/reports/${c.type}/${c.key.slice(2)}`}
              className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-base font-bold text-indigo-600 flex-shrink-0 overflow-hidden ring-2 ring-white">
                {c.avatar ? (
                  <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                ) : (c.name[0] ?? "؟")}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-right">
                <p className="font-bold text-gray-900 text-base truncate">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  آخر تقرير {formatRelative(c.lastReportAt)}
                </p>
              </div>

              {/* Report count */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-center bg-indigo-50 text-indigo-700 rounded-xl px-3 py-1.5">
                  <p className="text-lg font-extrabold leading-tight">{c.reportCount}</p>
                  <p className="text-[10px] leading-tight">تقرير</p>
                </div>
                <span className="text-gray-300">←</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
