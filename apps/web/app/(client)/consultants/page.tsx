"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";
import { SessionChatButton } from "@/components/client-chat";

// ── helpers ───────────────────────────────────────────────────────────────────
const SPEC_ICONS: Record<string, string> = {
  قلق: "😰", اكتئاب: "💙", علاقات: "💞", أسرة: "👨‍👩‍👧", اسرة: "👨‍👩‍👧",
  إرشاد: "🧭", ارشاد: "🧭", أداء: "🎯", نوم: "😴", أطفال: "🧒",
  صدمة: "🛡️", عمل: "💼", إدمان: "🌱", ادمان: "🌱", زواج: "💍",
};
function getIcon(name: string) {
  const key = Object.keys(SPEC_ICONS).find((k) => name.includes(k));
  return key ? SPEC_ICONS[key] : "🧠";
}
function formatDate(d: string | Date) {
  return new Intl.DateTimeFormat("ar-IQ", {
    weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}
const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  PENDING:   { label: "قيد الانتظار", color: "text-amber-600 bg-amber-50",  dot: "bg-amber-400" },
  CONFIRMED: { label: "مؤكد",         color: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-400" },
  COMPLETED: { label: "مكتمل",        color: "text-gray-500 bg-gray-50",    dot: "bg-gray-400" },
  CANCELLED: { label: "ملغى",         color: "text-red-500 bg-red-50",      dot: "bg-red-400" },
};

type Tab = "home" | "appointments" | "packages" | "settings";

// Icon paths (single SVG path each) for the nav — keeps look unified, no emoji
const NAV_ICONS: Record<Tab, JSX.Element> = {
  home: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z"/></svg>
  ),
  appointments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
  ),
  packages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"/><path d="m9 11 2 2 4-4"/></svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>
  ),
};

const NAV_LABELS: Record<Tab, string> = {
  home: "الرئيسية",
  appointments: "حجوزاتي",
  packages: "الباقات",
  settings: "الإعدادات",
};

const NAV_ORDER: Tab[] = ["home", "appointments", "packages", "settings"];

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD SHELL
// ══════════════════════════════════════════════════════════════════════════════
export default function ClientDashboardPage() {
  return (
    <Suspense fallback={null}>
      <ClientDashboard />
    </Suspense>
  );
}

function ClientDashboard() {
  const [tab, setTab]           = useState<Tab>("home");
  const [specFilter, setSpecFilter] = useState<{ id: string | null; name: string } | null>(null);
  const { identity, clearIdentity, isLoading: identityLoading } = useAnonymousIdentity();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment");
  const paymentError  = searchParams.get("paymentError");
  const [paymentBanner, setPaymentBanner] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    if (paymentStatus === "success") {
      setPaymentBanner("success");
      setTab("appointments");
      const t = setTimeout(() => setPaymentBanner(null), 6000);
      return () => clearTimeout(t);
    }
    if (paymentError) {
      setPaymentBanner("error");
      const t = setTimeout(() => setPaymentBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, [paymentStatus, paymentError]);

  const anonUserId = identity?.anonUserId ?? "";

  function handleLogout() { clearIdentity(); router.push("/"); }
  function switchTab(t: Tab) { setTab(t); setSpecFilter(null); }

  return (
    <div className="min-h-screen lg:flex" dir="rtl">

      {/* ── DESKTOP SIDEBAR (right) ── */}
      <aside className="hidden lg:flex flex-col w-56 bg-white/[0.03] border-l border-white/5 px-4 py-6 gap-2 sticky top-0 h-screen">
        {NAV_ORDER.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all ${
                active
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-sm font-medium">{NAV_LABELS[key]}</span>
              <span className={active ? "text-white" : "text-gray-400"}>{NAV_ICONS[key]}</span>
            </button>
          );
        })}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── TOP BAR ── */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-black/10 border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Avatar (left) */}
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
              <Image src="/app_logo.png" alt="مساحة بوح" width={40} height={40} className="rounded-full object-cover" />
            </div>

            {/* Welcome (center) */}
            <p className="text-base font-semibold text-white">
              مرحباً <span className="text-indigo-300">{identity?.nickname ?? ""}</span>
            </p>

            {/* Spacer to balance the avatar */}
            <div className="w-10 h-10" />
          </div>
        </header>

        {/* ── CONTENT ── */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-8">
          {paymentBanner === "success" && (
            <div className="mb-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-3 text-sm text-emerald-300 font-semibold">
              ✓ تم الدفع بنجاح! ستجد موعدك في "حجوزاتي"
            </div>
          )}
          {paymentBanner === "error" && (
            <div className="mb-4 bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3 text-sm text-red-300 font-semibold">
              ✗ فشل الدفع — يرجى المحاولة مرة أخرى
            </div>
          )}

          {tab === "home"         && <HomeTab anonUserId={anonUserId} specFilter={specFilter} setSpecFilter={setSpecFilter} setTab={setTab} />}
          {tab === "appointments" && <AppointmentsTab anonUserId={anonUserId} identityLoading={identityLoading} />}
          {tab === "packages"     && <PackagesTab anonUserId={anonUserId} />}
          {tab === "settings"     && <SettingsTab nickname={identity?.nickname ?? ""} onLogout={handleLogout} />}
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-md bg-black/30 border-t border-white/5">
          <div className="max-w-5xl mx-auto flex items-center justify-around px-2 py-2">
            {NAV_ORDER.map((key) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => switchTab(key)}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${
                    active ? "text-white" : "text-gray-500"
                  }`}
                >
                  {NAV_ICONS[key]}
                  <span className="text-[11px] font-medium">{NAV_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ nickname, onLogout }: { nickname: string; onLogout: () => void }) {
  const WHATSAPP_NUMBER = "9647700000000"; // TODO: configure from admin settings
  const PRIVACY_URL     = "/privacy";

  function confirmDelete() {
    if (typeof window !== "undefined" && window.confirm("هل أنت متأكد؟ سيتم حذف بياناتك من الجهاز نهائياً.")) {
      try {
        localStorage.removeItem("misahuh_anon");
        localStorage.removeItem("misahuh_device_id");
      } catch {}
      window.location.href = "/";
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white text-center mb-2">الإعدادات</h1>

      {/* Profile card */}
      <div className="bg-white/[0.04] border border-white/5 rounded-2xl py-6 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-indigo-500/25 flex items-center justify-center text-white text-3xl font-bold">
          {nickname[0]?.toUpperCase() ?? "؟"}
        </div>
        <p className="text-white text-lg font-semibold">{nickname}</p>
      </div>

      {/* Menu */}
      <div className="bg-white/[0.04] border border-white/5 rounded-2xl divide-y divide-white/5">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-5 py-4 text-white hover:bg-white/5 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-400"><path d="M7 7l10 10M17 7v10H7"/></svg>
          <span className="flex items-center gap-3">
            <span>مراسلة الدعم (واتساب)</span>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-emerald-400"><path d="M20.5 3.5A11.5 11.5 0 0 0 3.7 18.3L2 22l3.8-1.6A11.5 11.5 0 1 0 20.5 3.5ZM12 21a9 9 0 0 1-4.6-1.3l-.3-.2-2.3 1 1-2.2-.2-.4A9 9 0 1 1 12 21Zm5-6.7c-.3-.2-1.7-.8-2-.9-.3-.1-.4-.1-.6.1l-.9 1c-.1.2-.3.2-.6.1a7.4 7.4 0 0 1-3.6-3.2c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.5l-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.3-.6-.4Z"/></svg>
          </span>
        </a>

        <a href={PRIVACY_URL} className="flex items-center justify-between px-5 py-4 text-white hover:bg-white/5 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-400"><path d="m15 18-6-6 6-6"/></svg>
          <span className="flex items-center gap-3">
            <span>سياسة الخصوصية</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-gray-300"><path d="M12 2 4 5v7c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V5l-8-3Z"/></svg>
          </span>
        </a>

        <button onClick={onLogout} className="w-full flex items-center justify-between px-5 py-4 text-white hover:bg-white/5 transition-colors">
          <span />
          <span className="flex items-center gap-3">
            <span>تسجيل الخروج</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-gray-300"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </span>
        </button>

        <button onClick={confirmDelete} className="w-full flex items-center justify-between px-5 py-4 text-red-400 hover:bg-red-500/10 transition-colors">
          <span />
          <span className="flex items-center gap-3">
            <span>حذف الحساب</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-red-400"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </span>
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME TAB
// ══════════════════════════════════════════════════════════════════════════════
function HomeTab({
  anonUserId, specFilter, setSpecFilter, setTab,
}: {
  anonUserId: string;
  specFilter: { id: string | null; name: string } | null;
  setSpecFilter: (v: { id: string | null; name: string } | null) => void;
  setTab: (t: Tab) => void;
}) {
  return (
    <div className="space-y-4">
      {anonUserId && <NextAppointmentBanner anonUserId={anonUserId} setTab={setTab} />}
      {!specFilter
        ? <SpecGrid onSelect={setSpecFilter} />
        : <ConsultantGrid specFilter={specFilter} onBack={() => setSpecFilter(null)} />
      }
    </div>
  );
}

// ── Upcoming appointment banner ───────────────────────────────────────────────
function NextAppointmentBanner({ anonUserId, setTab }: { anonUserId: string; setTab: (t: Tab) => void }) {
  const { data: appts } = trpc.anonymous.myAppointments.useQuery({ anonUserId }, { enabled: !!anonUserId });
  const upcoming = appts?.filter(
    (a) => (a.status === "CONFIRMED" || a.status === "PENDING") && new Date(a.scheduledAt) > new Date()
  ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const next = upcoming?.[0];
  if (!next) return null;
  const s = STATUS_MAP[next.status];
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3.5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl flex-shrink-0">📅</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">موعدك القادم</p>
        <p className="font-semibold text-gray-900 text-sm">{next.consultant.user.name}</p>
        <p className="text-xs text-gray-400">{formatDate(next.scheduledAt)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${s.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
        <button onClick={() => setTab("appointments")} className="text-xs text-indigo-600 font-medium hover:underline">
          كل الحجوزات
        </button>
      </div>
    </div>
  );
}

// ── Specialization grid ───────────────────────────────────────────────────────
function SpecGrid({ onSelect }: { onSelect: (v: { id: string | null; name: string }) => void }) {
  const { data: specs, isLoading } = trpc.specialization.list.useQuery({ isActive: true });

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="font-bold text-white text-lg mb-1">اختر التخصص الأنسب لك:</h2>
        <p className="text-sm text-gray-400">يمكنك تغيير التخصص لاحقاً، هذه مجرد نقطة بداية.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Long banner: view all consultants */}
          <SpecCard
            label="عرض كل المستشارين"
            onClick={() => onSelect({ id: null, name: "كل المستشارين" })}
            highlight
            icon={
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4Zm8 0c-.3 0-.7 0-1.1.1A5.4 5.4 0 0 1 18 17v3h6v-3c0-2.7-5.3-4-8-4Z"/></svg>
            }
          />

          {/* Spec cards */}
          <div className="mt-3 space-y-3 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
            {specs?.map((spec) => (
              <SpecCard
                key={spec.id}
                label={spec.nameAr}
                subLabel={`${spec._count.consultants} مستشار متاحون`}
                onClick={() => onSelect({ id: spec.id, name: spec.nameAr })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Generic spec/banner card used by SpecGrid
function SpecCard({
  label, subLabel, onClick, icon, highlight,
}: {
  label: string;
  subLabel?: string;
  onClick: () => void;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-2xl border px-4 py-4 flex items-center gap-3 transition-colors text-right ${
        highlight
          ? "bg-indigo-500/10 border-indigo-400/30 hover:bg-indigo-500/15"
          : "bg-white/[0.04] border-white/5 hover:bg-white/[0.07]"
      }`}
    >
      <span className="text-gray-400 group-hover:-translate-x-0.5 transition-transform">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="m15 18-6-6 6-6"/></svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight">{label}</p>
        {subLabel && <p className="text-xs text-gray-400 mt-1">{subLabel}</p>}
      </div>
      <span className="w-11 h-11 rounded-full bg-indigo-400/20 text-indigo-200 flex items-center justify-center flex-shrink-0">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        )}
      </span>
    </button>
  );
}

// ── Consultant list after picking spec ────────────────────────────────────────
function ConsultantGrid({ specFilter, onBack }: { specFilter: { id: string | null; name: string }; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.consultant.list.useQuery({
    page, limit: 9, specializationId: specFilter.id ?? undefined, isActive: true,
  });

  return (
    <div>
      {/* Back header */}
      <div className="flex items-center gap-3 mb-3">
        <button onClick={onBack} className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all">
          →
        </button>
        <h2 className="font-bold text-gray-900 text-base">{specFilter.name}</h2>
        {data && <span className="text-xs text-gray-400 mr-auto bg-gray-100 rounded-lg px-2 py-0.5">{data.total} مستشار</span>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.data.map((c) => (
              <Link key={c.id} href={`/consultants/${c.id}`}
                className="group bg-white border border-gray-100 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition-all block"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl font-bold text-indigo-600 flex-shrink-0 overflow-hidden">
                    {c.user.avatar ? (
                      <img src={c.user.avatar} alt={c.user.name ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      c.user.name?.[0] ?? "؟"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate group-hover:text-indigo-700 transition-colors">{c.user.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.city}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-amber-400 text-xs">★</span>
                      <span className="text-xs font-semibold text-gray-700">{Number(c.rating).toFixed(1)}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{c.yearsOfExperience} سنة خبرة</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {c.specializations.slice(0, 2).map((s) => (
                    <span key={s.specializationId} className="text-xs bg-indigo-50 text-indigo-600 rounded-lg px-2 py-0.5 font-medium">
                      {s.specialization.nameAr}
                    </span>
                  ))}
                  {c.specializations.length > 2 && (
                    <span className="text-xs bg-gray-100 text-gray-400 rounded-lg px-2 py-0.5">+{c.specializations.length - 2}</span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div>
                    <p className="text-xs text-gray-400">سعر الجلسة</p>
                    <p className="font-bold text-indigo-600 text-sm">{Number(c.sessionPrice).toLocaleString("ar")} د.ع</p>
                  </div>
                  <span className="text-xs bg-indigo-600 text-white rounded-xl px-3 py-1.5 font-medium group-hover:bg-indigo-700 transition-colors">
                    احجز الآن
                  </span>
                </div>
              </Link>
            ))}
            {data?.data.length === 0 && (
              <div className="col-span-3 bg-white rounded-2xl border border-gray-100 py-14 text-center text-gray-400">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-sm">لا يوجد مستشارون في هذا التخصص</p>
              </div>
            )}
          </div>

          {(data?.total ?? 0) > 9 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:border-indigo-300 transition-colors">
                ← السابق
              </button>
              <span className="px-4 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl">{page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={(data?.data.length ?? 0) < 9}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:border-indigo-300 transition-colors">
                التالي →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APPOINTMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function AppointmentsTab({ anonUserId, identityLoading }: { anonUserId: string; identityLoading: boolean }) {
  const retryPayment = trpc.anonymous.startZainCashPayment.useMutation({
    onSuccess: (data) => { window.location.href = data.paymentUrl; },
    onError:   (err)  => alert(err.message),
  });

  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const { data: appts, isLoading } = trpc.anonymous.myAppointments.useQuery(
    { anonUserId }, { enabled: !!anonUserId }
  );

  const now = new Date();
  const upcoming = (appts?.filter(
    (a) => (a.status === "CONFIRMED" || a.status === "PENDING") && new Date(a.scheduledAt) > now
  ) ?? []).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()); // soonest first
  const past = (appts?.filter(
    (a) => a.status === "COMPLETED" || a.status === "CANCELLED" || new Date(a.scheduledAt) <= now
  ) ?? []).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()); // most recent first
  const list = view === "upcoming" ? upcoming : past;

  if (identityLoading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-12 flex justify-center">
        <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!anonUserId) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center text-gray-400">
        <p className="text-4xl mb-3">👤</p>
        <p className="text-sm mb-4">يجب أن تبدأ جلستك أولاً لعرض حجوزاتك</p>
        <a href="/" className="text-sm text-indigo-600 font-semibold hover:underline">ابدأ من هنا ←</a>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4">
        {([["upcoming", "القادمة", upcoming.length], ["past", "السابقة", past.length]] as [typeof view, string, number][]).map(([key, label, count]) => (
          <button key={key} onClick={() => setView(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              view === key ? "bg-indigo-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300"
            }`}
          >
            {label}
            <span className={`text-xs rounded-lg px-1.5 py-0.5 font-bold ${view === key ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <p className="text-4xl mb-3">{view === "upcoming" ? "📅" : "📋"}</p>
            <p className="text-sm">
              {view === "upcoming" ? "لا توجد حجوزات قادمة" : "لا توجد حجوزات سابقة"}
            </p>
            {view === "upcoming" && (
              <button onClick={() => {}} className="mt-3 text-sm text-indigo-600 font-medium hover:underline">
                احجز موعداً ←
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((appt) => {
              const s = STATUS_MAP[appt.status] ?? STATUS_MAP.PENDING;
              return (
                <div key={appt.id} className="p-4 flex items-center gap-4 hover:bg-gray-50/60 transition-colors">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-lg font-bold text-indigo-600 flex-shrink-0 overflow-hidden">
                    {appt.consultant.user.avatar ? (
                      <img src={appt.consultant.user.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      appt.consultant.user.name?.[0] ?? "؟"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{appt.consultant.user.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(appt.scheduledAt)}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {appt.consultant.specializations.slice(0, 2).map((s) => (
                        <span key={s.specializationId} className="text-xs bg-gray-100 text-gray-500 rounded-md px-1.5 py-0.5">
                          {s.specialization.nameAr}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${s.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>

                    {/* Payment status */}
                    {/* REPRESENTATIVE — admin approval indicator */}
                    {appt.paymentMethod === "REPRESENTATIVE" && (
                      <>
                        {!appt.adminApproved && appt.status === "PENDING" && (
                          <span className="text-xs text-amber-600 bg-amber-50 font-medium px-2 py-1 rounded-lg">
                            ⏳ ينتظر تأكيد الإدارة
                          </span>
                        )}
                        {appt.adminApproved && (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span>✓</span> تم تأكيد الحجز
                          </span>
                        )}
                      </>
                    )}

                    {appt.paymentMethod === "ELECTRONIC" && (
                      <>
                        {appt.paymentStatus === "PAID" && (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span className="text-xs">✓</span> مدفوع
                          </span>
                        )}
                        {appt.paymentStatus === "PENDING" && appt.status !== "CANCELLED" && (
                          <button
                            onClick={() => retryPayment.mutate({ appointmentId: appt.id, anonUserId })}
                            disabled={retryPayment.isPending}
                            className="text-xs bg-amber-500 text-white hover:bg-amber-600 rounded-lg px-3 py-1 font-medium transition-colors disabled:opacity-50"
                          >
                            {retryPayment.isPending ? "..." : "💳 إكمال الدفع"}
                          </button>
                        )}
                        {appt.paymentStatus === "FAILED" && (
                          <button
                            onClick={() => retryPayment.mutate({ appointmentId: appt.id, anonUserId })}
                            disabled={retryPayment.isPending || appt.status === "CANCELLED"}
                            className="text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg px-3 py-1 font-medium transition-colors disabled:opacity-50"
                          >
                            {appt.status === "CANCELLED" ? "فشل الدفع" : "🔄 حاول مجدداً"}
                          </button>
                        )}
                      </>
                    )}

                    {appt.meetingLink && appt.status === "CONFIRMED" && appt.paymentStatus === "PAID" && (
                      <a href={appt.meetingLink} target="_blank" rel="noreferrer"
                        className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg px-3 py-1 font-medium transition-colors">
                        انضم للجلسة
                      </a>
                    )}

                    {/* Chat button — available on all non-cancelled appointments */}
                    {appt.status !== "CANCELLED" && anonUserId && (
                      <SessionChatButton
                        anonUserId={anonUserId}
                        appointmentId={appt.id}
                        consultantName={appt.consultant.user.name ?? "المستشار"}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PACKAGES TAB
// ══════════════════════════════════════════════════════════════════════════════
function PackagesTab({ anonUserId }: { anonUserId: string }) {
  const { data: packages, isLoading } = trpc.package.list.useQuery();
  const { data: myPackages, refetch } = trpc.package.myPackages.useQuery(
    { anonUserId }, { enabled: !!anonUserId },
  );

  const [paymentMethod, setPaymentMethod] = useState<"REPRESENTATIVE" | "ELECTRONIC" | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);

  const purchase = trpc.package.purchase.useMutation({
    onSuccess: (userPkg) => {
      if (paymentMethod === "ELECTRONIC" && anonUserId) {
        startZainCash.mutate({ userPackageId: userPkg.id, anonUserId });
      } else {
        refetch();
        setSelectedPkgId(null);
        setPaymentMethod(null);
        alert("تم تسجيل طلبك! سيتواصل معك المندوب قريباً لإتمام الدفع.");
      }
    },
    onError: (e) => alert(e.message),
  });
  const startZainCash = trpc.package.startZainCashPayment.useMutation({
    onSuccess: (data) => { window.location.href = data.paymentUrl; },
    onError:   (e) => alert(e.message),
  });

  function handleBuy(pkgId: string, method: "REPRESENTATIVE" | "ELECTRONIC") {
    if (!anonUserId) {
      alert("يجب تسجيل الدخول أولاً");
      return;
    }
    setSelectedPkgId(pkgId);
    setPaymentMethod(method);
    purchase.mutate({ anonUserId, packageId: pkgId, paymentMethod: method });
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">

      {/* My active packages */}
      {anonUserId && (myPackages?.length ?? 0) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-emerald-700 mb-3 text-right">💎 باقاتي النشطة</p>
          <div className="space-y-2">
            {myPackages!.map((up) => {
              const remaining = up.totalSessions - up.usedSessions;
              return (
                <div key={up.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-2xl font-extrabold text-emerald-700">{remaining}</p>
                    <p className="text-xs text-emerald-500">جلسة متبقية</p>
                  </div>
                  <div className="text-right flex-1 mr-3">
                    <div className="flex items-center justify-end gap-2">
                      <p className="font-bold text-gray-900 text-sm">{up.package.nameAr}</p>
                      <span className="text-lg">{up.package.icon ?? "📦"}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      استخدمت {up.usedSessions} من {up.totalSessions}
                    </p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${(up.usedSessions / up.totalSessions) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available packages */}
      {!packages?.length ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-14 text-center text-gray-300">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm">لا توجد باقات متاحة حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const isLoading = (purchase.isPending || startZainCash.isPending) && selectedPkgId === pkg.id;
            return (
              <div key={pkg.id}
                className={`relative bg-white rounded-2xl p-5 border-2 transition-all ${
                  pkg.isFeatured ? "border-indigo-400 shadow-lg shadow-indigo-100" : "border-gray-100"
                }`}>
                {pkg.isFeatured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    ⭐ الأكثر طلباً
                  </span>
                )}
                <div className="text-4xl mb-3">{pkg.icon ?? "📦"}</div>
                <h3 className="font-bold text-gray-900 text-base mb-1">{pkg.nameAr}</h3>
                {pkg.descriptionAr && <p className="text-xs text-gray-400 mb-3 leading-relaxed">{pkg.descriptionAr}</p>}

                <div className="py-3 border-t border-gray-50 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-indigo-600 font-bold">{pkg.sessions} جلسات</span>
                    <span className="text-xs text-gray-400">سعر الجلسة</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-extrabold text-gray-900">{Number(pkg.price).toLocaleString("ar")} د.ع</span>
                    <span className="text-xs text-emerald-600 font-semibold">
                      {Math.round(Number(pkg.price) / pkg.sessions).toLocaleString("ar")} د.ع/جلسة
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <button
                    onClick={() => handleBuy(pkg.id, "ELECTRONIC")}
                    disabled={isLoading || !anonUserId}
                    className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isLoading && paymentMethod === "ELECTRONIC" ? "..." : <><span>💳</span> دفع إلكتروني</>}
                  </button>
                  <button
                    onClick={() => handleBuy(pkg.id, "REPRESENTATIVE")}
                    disabled={isLoading || !anonUserId}
                    className="w-full py-2 rounded-xl bg-gray-50 text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isLoading && paymentMethod === "REPRESENTATIVE" ? "..." : <><span>🤝</span> دفع عبر المندوب</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!anonUserId && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center text-sm text-amber-700">
          ابدأ جلستك أولاً من الصفحة الرئيسية للشراء
        </div>
      )}
    </div>
  );
}
