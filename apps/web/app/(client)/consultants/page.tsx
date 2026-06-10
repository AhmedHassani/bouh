"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useAnonymousIdentity } from "@/lib/hooks/useAnonymousIdentity";

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

type Tab = "home" | "appointments" | "packages";

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD SHELL
// ══════════════════════════════════════════════════════════════════════════════
export default function ClientDashboard() {
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
    <div className="min-h-screen bg-[#f4f5f7]" dir="rtl">

      {/* ── TOP BAR ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-5 h-15 flex items-center justify-between py-2">

          {/* Logo + brand */}
          <div className="flex items-center gap-2.5">
            <Image src="/app_logo.png" alt="مساحة بوح" width={36} height={36} className="rounded-full object-cover" />
            <span className="font-extrabold text-indigo-700 text-base tracking-tight hidden sm:block">مساحة بوح</span>
          </div>

          {/* Center nav */}
          <nav className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            {([
              ["home",         "🏠", "الرئيسية"],
              ["appointments", "📅", "حجوزاتي"],
              ["packages",     "📦", "الباقات"],
            ] as [Tab, string, string][]).map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className="text-xs">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-2">
            {identity?.nickname && (
              <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 rounded-xl px-3 py-1.5">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                  {identity.nickname[0]}
                </span>
                <span className="text-sm font-medium hidden sm:block">{identity.nickname}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
              title="خروج"
            >
              ⏻
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className="max-w-5xl mx-auto px-5 py-5">
        {paymentBanner === "success" && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-emerald-500 text-xl">✅</span>
            <p className="text-sm text-emerald-700 font-semibold">تم الدفع بنجاح! ستجد موعدك في تبويب "حجوزاتي"</p>
          </div>
        )}
        {paymentBanner === "error" && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <p className="text-sm text-red-700 font-semibold">فشل الدفع — يرجى المحاولة مرة أخرى</p>
          </div>
        )}
        {tab === "home"         && <HomeTab anonUserId={anonUserId} specFilter={specFilter} setSpecFilter={setSpecFilter} setTab={setTab} />}
        {tab === "appointments" && <AppointmentsTab anonUserId={anonUserId} identityLoading={identityLoading} />}
        {tab === "packages"     && <PackagesTab anonUserId={anonUserId} />}
      </main>
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
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 text-base">تصفح المستشارين</h2>
        <button
          onClick={() => onSelect({ id: null, name: "كل المستشارين" })}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
        >
          عرض الكل <span>←</span>
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {specs?.map((spec) => (
            <button
              key={spec.id}
              onClick={() => onSelect({ id: spec.id, name: spec.nameAr })}
              className="group bg-white border border-gray-100 rounded-2xl p-4 text-right hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="text-3xl mb-2.5">{spec.icon ?? getIcon(spec.nameAr)}</div>
              <p className="font-semibold text-gray-800 text-sm group-hover:text-indigo-700 transition-colors leading-snug">
                {spec.nameAr}
              </p>
              <p className="text-xs text-gray-400 mt-1">{spec._count.consultants} مستشار</p>
            </button>
          ))}
        </div>
      )}
    </div>
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
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xl font-bold text-indigo-600 flex-shrink-0">
                    {c.user.name?.[0] ?? "؟"}
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
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-lg font-bold text-indigo-600 flex-shrink-0">
                    {appt.consultant.user.name?.[0] ?? "؟"}
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
        alert("تم تسجيل طلبك! سيتواصل معك الممثل قريباً لإتمام الدفع.");
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
                    {isLoading && paymentMethod === "REPRESENTATIVE" ? "..." : <><span>🤝</span> دفع عبر الممثل</>}
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
