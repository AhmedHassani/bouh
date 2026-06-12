"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui/page-header";

const TABS = [
  { key: "overview",    label: "نظرة عامة" },
  { key: "earnings",    label: "الأرباح" },
  { key: "consultant",  label: "تقرير مستشار" },
  { key: "transfers",   label: "الجلسات المحوّلة" },
  { key: "payments",    label: "طرق الدفع" },
  { key: "coupons",     label: "الكوبونات" },
  { key: "packages",    label: "الباقات" },
] as const;
type Tab = typeof TABS[number]["key"];

const fmt = (n: number) => Number(n).toLocaleString("ar-IQ");
const fmtMoney = (n: number) => `${fmt(n)} د.ع`;

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");

  return (
    <div dir="rtl">
      <PageHeader title="التقارير" subtitle="إحصاءات وتقارير المنصة" />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range — shown for most tabs */}
      {tab !== "packages" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">من</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">إلى</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400" />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-red-600">
              إعادة تعيين
            </button>
          )}
        </div>
      )}

      {tab === "overview"   && <OverviewTab from={from} to={to} />}
      {tab === "earnings"   && <EarningsTab from={from} to={to} />}
      {tab === "consultant" && <ConsultantReportTab from={from} to={to} />}
      {tab === "transfers"  && <TransfersTab from={from} to={to} />}
      {tab === "payments"   && <PaymentsTab from={from} to={to} />}
      {tab === "coupons"    && <CouponsTab from={from} to={to} />}
      {tab === "packages"   && <PackagesTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function OverviewTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = trpc.report.platformOverview.useQuery({ from: from || undefined, to: to || undefined });
  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="إجمالي الإيرادات" value={fmtMoney(data.revenue.gross)} accent="emerald" />
        <Stat label="عمولة المنصة"     value={fmtMoney(data.revenue.commission)} accent="indigo" />
        <Stat label="صافي للمستشارين"  value={fmtMoney(data.revenue.net)} accent="violet" />
        <Stat label="جلسات محتسبة"     value={fmt(data.revenue.sessions)} accent="amber" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="إجمالي الجلسات"   value={fmt(data.appointments.total)} />
        <Stat label="مكتملة"            value={fmt(data.appointments.completed)} accent="emerald" />
        <Stat label="مؤكّدة"            value={fmt(data.appointments.confirmed)} accent="indigo" />
        <Stat label="معلّقة"            value={fmt(data.appointments.pending)} accent="amber" />
        <Stat label="ملغاة"             value={fmt(data.appointments.cancelled)} accent="red" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="المستشارون"        value={fmt(data.users.consultants)} />
        <Stat label="عملاء مسجّلون"     value={fmt(data.users.clients)} />
        <Stat label="عملاء مجهولون"     value={fmt(data.users.anonymous)} />
        <Stat label="كوبونات مستخدمة"   value={fmt(data.couponsUsed)} />
        <Stat label="باقات مباعة"       value={fmt(data.packagesSold)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Stat label="نتائج التقييمات النفسية" value={fmt(data.assessmentResults)} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function EarningsTab({ from, to }: { from: string; to: string }) {
  const byConsultant = trpc.report.earningsByConsultant.useQuery({ from: from || undefined, to: to || undefined });
  const byMonth      = trpc.report.earningsByMonth.useQuery();

  return (
    <div className="space-y-5">
      <Card title="الأرباح حسب الشهر (آخر 12 شهر)">
        {byMonth.isLoading || !byMonth.data ? <Loading /> : (
          <Table headers={["الشهر", "جلسات", "إجمالي", "عمولة المنصة", "صافي المستشارين"]}>
            {byMonth.data.map((m) => (
              <tr key={m.month} className="border-t border-gray-50">
                <Td>{m.month}</Td>
                <Td>{fmt(m.count)}</Td>
                <Td>{fmtMoney(m.gross)}</Td>
                <Td>{fmtMoney(m.commission)}</Td>
                <Td>{fmtMoney(m.net)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="الأرباح حسب المستشار">
        {byConsultant.isLoading || !byConsultant.data ? <Loading /> : byConsultant.data.length === 0 ? <Empty /> : (
          <Table headers={["المستشار", "جلسات", "إجمالي", "عمولة المنصة", "صافي المستشار"]}>
            {byConsultant.data.map((c) => (
              <tr key={c.consultantId} className="border-t border-gray-50">
                <Td>{c.name}</Td>
                <Td>{fmt(c.sessions)}</Td>
                <Td>{fmtMoney(c.gross)}</Td>
                <Td>{fmtMoney(c.commission)}</Td>
                <Td>{fmtMoney(c.net)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function ConsultantReportTab({ from, to }: { from: string; to: string }) {
  const list = trpc.report.consultantList.useQuery();
  const [selected, setSelected] = useState<string>("");
  const selectedId = selected || list.data?.[0]?.id || "";

  const report = trpc.report.consultantReport.useQuery(
    { consultantId: selectedId, from: from || undefined, to: to || undefined },
    { enabled: !!selectedId },
  );

  return (
    <div className="space-y-4">
      <Card title="اختر المستشار">
        <select
          value={selectedId}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400"
        >
          {list.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.user.name} — {c.user.email}</option>
          ))}
        </select>
      </Card>

      {!selectedId ? <p className="text-sm text-gray-400 text-center py-10">اختر مستشاراً</p> :
        report.isLoading || !report.data ? <Loading /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="إجمالي الجلسات"  value={fmt(report.data.appointments.total)} />
              <Stat label="مكتملة"          value={fmt(report.data.appointments.byStatus.COMPLETED ?? 0)} accent="emerald" />
              <Stat label="ملغاة"           value={fmt(report.data.appointments.byStatus.CANCELLED ?? 0)} accent="red" />
              <Stat label="لم يحضر"         value={fmt(report.data.appointments.byStatus.NO_SHOW ?? 0)} accent="amber" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="جلسات محتسبة"   value={fmt(report.data.earnings.sessions)} />
              <Stat label="إجمالي"          value={fmtMoney(report.data.earnings.gross)} accent="emerald" />
              <Stat label="عمولة المنصة"   value={fmtMoney(report.data.earnings.commission)} accent="indigo" />
              <Stat label="صافي للمستشار"  value={fmtMoney(report.data.earnings.net)} accent="violet" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="متوسط التقييم" value={report.data.reviews.avg.toFixed(2)} />
              <Stat label="عدد التقييمات" value={fmt(report.data.reviews.count)} />
            </div>

            <Card title="أكثر العملاء جلسات مع هذا المستشار">
              {report.data.topClients.length === 0 ? <Empty /> : (
                <Table headers={["العميل", "عدد الجلسات"]}>
                  {report.data.topClients.map((c) => (
                    <tr key={c.anonUserId} className="border-t border-gray-50">
                      <Td>{c.nickname}</Td>
                      <Td>{fmt(c.sessions)}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </>
        )
      }
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function TransfersTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = trpc.report.transferredSessions.useQuery({ from: from || undefined, to: to || undefined });
  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="من تستقبل التحويلات الأكثر">
          {data.receivedTop.length === 0 ? <Empty /> : (
            <Table headers={["المستشار", "عدد الجلسات المستلمة"]}>
              {data.receivedTop.map((c) => (
                <tr key={c.consultantId} className="border-t border-gray-50">
                  <Td>{c.name}</Td>
                  <Td>{fmt(c.count)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="من يحوّل الأكثر">
          {data.sentTop.length === 0 ? <Empty /> : (
            <Table headers={["المستشار", "عدد التحويلات الصادرة"]}>
              {data.sentTop.map((c) => (
                <tr key={c.consultantId} className="border-t border-gray-50">
                  <Td>{c.name}</Td>
                  <Td>{fmt(c.count)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card title={`تفاصيل التحويلات (${data.total})`}>
        {data.items.length === 0 ? <Empty /> : (
          <Table headers={["التاريخ", "من", "إلى", "العميل", "السبب", "الحالة"]}>
            {data.items.map((a) => (
              <tr key={a.id} className="border-t border-gray-50">
                <Td>{a.transferredAt ? new Date(a.transferredAt).toLocaleDateString("ar-IQ") : "—"}</Td>
                <Td>{a.transferredFromConsultant?.user.name ?? "—"}</Td>
                <Td>{a.consultant.user.name ?? "—"}</Td>
                <Td>{a.client?.user.name ?? a.anonUser?.nickname ?? "—"}</Td>
                <Td>{a.transferReason ?? "—"}</Td>
                <Td>{a.status}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function PaymentsTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = trpc.report.paymentBreakdown.useQuery({ from: from || undefined, to: to || undefined });
  if (isLoading || !data) return <Loading />;

  const labels: Record<string, string> = {
    ELECTRONIC: "إلكتروني (زين كاش)", REPRESENTATIVE: "مندوب", PACKAGE: "باقة", PENDING: "غير محدد",
    PAID: "مدفوع", FAILED: "فشل", REFUNDED: "مسترجع",
  };

  return (
    <Card title="توزيع طرق الدفع">
      {data.length === 0 ? <Empty /> : (
        <Table headers={["طريقة الدفع", "حالة الدفع", "عدد الجلسات", "الإجمالي"]}>
          {data.map((r, i) => (
            <tr key={i} className="border-t border-gray-50">
              <Td>{labels[r.method] ?? r.method}</Td>
              <Td>{labels[r.status] ?? r.status}</Td>
              <Td>{fmt(r.count)}</Td>
              <Td>{fmtMoney(r.total)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
function CouponsTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = trpc.report.couponsReport.useQuery({ from: from || undefined, to: to || undefined });
  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="إجمالي مرات الاستخدام" value={fmt(data.totalUses)} />
        <Stat label="إجمالي الخصومات الممنوحة" value={fmtMoney(data.totalDiscount)} accent="amber" />
      </div>
      <Card title="أكثر الكوبونات استخداماً">
        {data.topCoupons.length === 0 ? <Empty /> : (
          <Table headers={["الكوبون", "مرات الاستخدام", "إجمالي الخصم"]}>
            {data.topCoupons.map((c) => (
              <tr key={c.couponId} className="border-t border-gray-50">
                <Td>{c.code}</Td>
                <Td>{fmt(c.usage)}</Td>
                <Td>{fmtMoney(c.discount)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function PackagesTab() {
  const { data, isLoading } = trpc.report.packagesReport.useQuery();
  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="إجمالي الباقات المباعة" value={fmt(data.totalSold)} />
        <Stat label="إجمالي الإيرادات"       value={fmtMoney(data.totalRevenue)} accent="emerald" />
      </div>
      <Card title="الباقات">
        {data.items.length === 0 ? <Empty /> : (
          <Table headers={["الباقة", "مباعة", "إيرادات", "الجلسات المستخدمة", "إجمالي الجلسات المتاحة"]}>
            {data.items.map((p) => (
              <tr key={p.packageId} className="border-t border-gray-50">
                <Td>{p.nameAr}</Td>
                <Td>{fmt(p.sold)}</Td>
                <Td>{fmtMoney(p.revenue)}</Td>
                <Td>{fmt(p.usedSessions)}</Td>
                <Td>{fmt(p.totalSessions)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ── shared ─────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "indigo" | "violet" | "amber" | "red" }) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-700",
    indigo:  "bg-indigo-50 text-indigo-700",
    violet:  "bg-violet-50 text-violet-700",
    amber:   "bg-amber-50 text-amber-700",
    red:     "bg-red-50 text-red-700",
  };
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className={`text-lg font-bold ${accent ? `rounded-lg px-2 py-1 inline-block ${bg[accent]}` : "text-gray-800"}`}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl">
      <div className="px-5 py-3 border-b border-gray-50">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/60">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-right text-xs text-gray-500 font-medium px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-gray-700">{children}</td>;
}
function Loading() {
  return <p className="text-sm text-gray-400 text-center py-10 animate-pulse">جارٍ التحميل...</p>;
}
function Empty() {
  return <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات</p>;
}
