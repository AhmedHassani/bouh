"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";
import { StatsCard } from "@/components/ui/stats-card";
import { DataTable, Pagination } from "@/components/ui/data-table";

function formatDate(d: string | Date) {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export default function EarningsPage() {
  const [page, setPage] = useState(1);
  const { data }            = trpc.earning.myEarnings.useQuery({ page, limit: 15 });
  const { data: bonusData } = trpc.bonus.myBonuses.useQuery();

  type Row = NonNullable<typeof data>["data"][number];

  const columns = [
    { key: "client", header: "العميل", render: (r: Row) => r.appointment.client?.user.name ?? r.appointment.anonUser?.nickname ?? "مجهول" },
    { key: "date", header: "تاريخ الجلسة", render: (r: Row) => formatDate(r.appointment.scheduledAt) },
    { key: "gross", header: "السعر الكامل", render: (r: Row) => `${Number(r.grossAmount)} د.ع` },
    { key: "commission", header: "عمولة المنصة", render: (r: Row) => <span className="text-rose-600">-{Number(r.commissionAmount)} د.ع</span> },
    { key: "net", header: "صافي الربح", render: (r: Row) => <span className="text-emerald-600 font-semibold">{Number(r.netAmount)} د.ع</span> },
    { key: "paid", header: "الحالة", render: (r: Row) => r.isPaid ? <span className="text-emerald-600 text-xs font-medium">✅ محوّل</span> : <span className="text-amber-600 text-xs font-medium">⏳ معلّق</span> },
  ];

  const totalBonusesPaid    = bonusData?.totalPaid ?? 0;
  const totalBonusesPending = bonusData?.totalPending ?? 0;
  const totalEarnings       = (data?.totals.net ?? 0) + totalBonusesPaid;

  return (
    <div dir="rtl">
      <PageHeader title="الأرباح والعمولات" />

      {/* ── Main stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="إجمالي الجلسات"   value={data?.totals.sessions ?? 0} icon="📅" color="indigo" />
        <StatsCard title="إيرادات الجلسات"  value={`${(data?.totals.gross ?? 0).toLocaleString("ar")} د.ع`} icon="💰" color="amber" />
        <StatsCard title="عمولة المنصة"     value={`${(data?.totals.commission ?? 0).toLocaleString("ar")} د.ع`} icon="📤" color="rose" />
        <StatsCard title="إجمالي أرباحك"    value={`${totalEarnings.toLocaleString("ar")} د.ع`} icon="✅" color="emerald" />
      </div>

      {/* ── Bonuses Section ── */}
      {(bonusData?.bonuses.length ?? 0) > 0 && (
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-100 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {totalBonusesPending > 0 && (
                <span className="text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg font-semibold">
                  ⏳ معلّق: {totalBonusesPending.toLocaleString("ar")} د.ع
                </span>
              )}
              <span className="text-xs text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg font-semibold">
                ✓ مدفوع: {totalBonusesPaid.toLocaleString("ar")} د.ع
              </span>
            </div>
            <h3 className="text-base font-extrabold text-amber-900 flex items-center gap-2">
              <span>المكافآت من الإدارة</span>
              <span className="text-xl">🎁</span>
            </h3>
          </div>

          <div className="bg-white/60 rounded-xl divide-y divide-amber-100">
            {bonusData!.bonuses.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  b.status === "PAID"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {b.status === "PAID" ? "مدفوع" : "معلّق"}
                </span>
                <div className="flex-1 text-right">
                  <p className="font-bold text-gray-900 text-base">
                    {Number(b.amount).toLocaleString("ar")}
                    <span className="text-xs font-normal text-gray-400 mr-1">د.ع</span>
                  </p>
                  {b.reason && <p className="text-xs text-gray-600 mt-0.5">{b.reason}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {b.status === "PAID" && b.paidAt
                      ? `دُفعت في ${formatDate(b.paidAt)}`
                      : `صادرة في ${formatDate(b.createdAt)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Earnings table ── */}
      <h3 className="text-sm font-bold text-gray-700 mb-3 text-right">سجل أرباح الجلسات</h3>
      <DataTable
        data={(data?.data ?? []) as Record<string, unknown>[]}
        columns={columns as never}
        emptyMessage="لا توجد أرباح بعد"
      />
      <Pagination page={page} total={data?.total ?? 0} limit={15} onChange={setPage} />
    </div>
  );
}
