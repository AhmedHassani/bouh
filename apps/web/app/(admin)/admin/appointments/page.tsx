"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

// ── helpers ──
// Pure numeric format: 24/06/2026 — 10:00
function formatDate(d: string | Date) {
  const date = new Date(d);
  const day   = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year  = date.getFullYear();
  return `${day}/${month}/${year}`;
}
function formatTime(d: string | Date) {
  const date = new Date(d);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function formatFullDateTime(d: string | Date) {
  return `${formatDate(d)} — ${formatTime(d)}`;
}
function formatRelative(d: string | Date): string | null {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "غداً";
  if (diffDays === -1) return "أمس";
  if (diffDays > 0 && diffDays < 14)  return `بعد ${diffDays} أيام`;
  if (diffDays < 0 && diffDays > -14) return `قبل ${Math.abs(diffDays)} أيام`;
  return null;
}

// ── Card state — drives top bar color + status pill ──
type StateInfo = { label: string; pill: string; bar: string; dot?: string; urgent?: boolean };
function getState(appt: AdminAppointment): StateInfo {
  if (appt.paymentMethod === "REPRESENTATIVE" && !appt.adminApproved && appt.status === "PENDING")
    return { label: "بانتظار الموافقة", pill: "bg-amber-50  text-amber-700",  bar: "bg-amber-400",  dot: "bg-amber-500", urgent: true };
  if (appt.paymentMethod === "ELECTRONIC" && appt.paymentStatus === "PENDING" && appt.status === "PENDING")
    return { label: "بانتظار الدفع",    pill: "bg-orange-50 text-orange-700", bar: "bg-orange-400", dot: "bg-orange-500", urgent: true };
  if (appt.status === "CANCELLED") return { label: "ملغية",  pill: "bg-red-50    text-red-700",     bar: "bg-red-400"    };
  if (appt.status === "NO_SHOW")   return { label: "لم يحضر", pill: "bg-orange-50 text-orange-700",  bar: "bg-orange-300" };
  if (appt.status === "COMPLETED") return { label: "مكتملة", pill: "bg-gray-100  text-gray-600",    bar: "bg-gray-300"   };
  if (appt.status === "CONFIRMED") return { label: "مؤكدة",  pill: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" };
  return { label: "معلّقة", pill: "bg-amber-50 text-amber-700", bar: "bg-amber-300" };
}

// ── SVG icon paths ──
const ICON_PATHS = {
  wallet: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8M3 10V8a2 2 0 012-2h14a2 2 0 012 2v2M16 14h2" />,
  card:   <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />,
  box:    <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12" />,
  clock:  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  check:  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  x:      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
};

// ── Payment display (method+status combined) ──
type PaymentInfo = { label: string; chip: string; iconPath: React.ReactElement };
function getPayment(appt: AdminAppointment): PaymentInfo {
  if (appt.paymentMethod === "PACKAGE")
    return { label: "مشمولة بالباقة", chip: "bg-purple-50 text-purple-700", iconPath: ICON_PATHS.box };
  if (appt.paymentMethod === "ELECTRONIC") {
    if (appt.paymentStatus === "PAID")   return { label: "دفع إلكتروني · مدفوع",   chip: "bg-emerald-50 text-emerald-700", iconPath: ICON_PATHS.card };
    if (appt.paymentStatus === "FAILED") return { label: "دفع إلكتروني · فشل",      chip: "bg-red-50 text-red-700",         iconPath: ICON_PATHS.card };
    return                                 { label: "دفع إلكتروني · بانتظار الدفع", chip: "bg-orange-50 text-orange-700",  iconPath: ICON_PATHS.card };
  }
  if (appt.paymentMethod === "REPRESENTATIVE") {
    if (appt.paymentStatus === "PAID")   return { label: "دفع عند الاستلام · حُصِّل", chip: "bg-emerald-50 text-emerald-700", iconPath: ICON_PATHS.wallet };
    return                                 { label: "دفع عند الاستلام",              chip: "bg-amber-50 text-amber-700",    iconPath: ICON_PATHS.wallet };
  }
  return { label: "—", chip: "bg-gray-50 text-gray-500", iconPath: ICON_PATHS.clock };
}

// ── Payment status (small chip — left of price) ──
type PsInfo = { label: string; chip: string; iconPath: React.ReactElement };
function getPS(appt: AdminAppointment): PsInfo {
  if (appt.paymentStatus === "PAID")   return { label: "مدفوع", chip: "bg-emerald-50 text-emerald-700", iconPath: ICON_PATHS.check };
  if (appt.paymentStatus === "FAILED") return { label: "فشل",   chip: "bg-red-50 text-red-700",         iconPath: ICON_PATHS.x };
  return { label: "معلّق", chip: "bg-amber-50 text-amber-700", iconPath: ICON_PATHS.clock };
}

type Tab = "all" | "pendingApproval" | "pendingPayment" | "confirmed" | "today" | "completed" | "cancelled" | "transferred";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "pendingApproval", label: "بانتظار الموافقة" },
  { key: "confirmed",       label: "مؤكدة" },
  { key: "today",           label: "اليوم" },
  { key: "completed",       label: "مكتملة" },
  { key: "cancelled",       label: "ملغية" },
];
function tabToFilter(tab: Tab) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  switch (tab) {
    case "pendingApproval": return { awaitingRepApproval: true };
    case "pendingPayment":  return { paymentMethod: "ELECTRONIC" as const, status: "PENDING" as const };
    case "confirmed":       return { status: "CONFIRMED" as const };
    case "today":           return { status: "CONFIRMED" as const, from: todayStart.toISOString(), to: todayEnd.toISOString() };
    case "completed":       return { status: "COMPLETED" as const };
    case "cancelled":       return { status: "CANCELLED" as const };
    case "transferred":     return { transferredOnly: true };
    default:                return {};
  }
}

type AdminAppointment = NonNullable<ReturnType<typeof trpc.appointment.adminList.useQuery>["data"]>["data"][number];

// ══════════════════════════════════════════════════════════════════════════════
export default function AdminAppointmentsPage() {
  const [tab, setTab]       = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  const filter = tabToFilter(tab);
  const { data, refetch } = trpc.appointment.adminList.useQuery({
    page, limit: 12,
    search: search.trim() || undefined,
    ...filter,
  });
  const { data: counts }      = trpc.appointment.adminCounts.useQuery();
  const { data: consultants } = trpc.consultant.list.useQuery({ page: 1, limit: 100, isActive: true });

  const approve         = trpc.appointment.adminApproveRepresentative.useMutation({ onSuccess: () => { refetch(); closeModal(); } });
  const reject          = trpc.appointment.adminRejectRepresentative.useMutation({ onSuccess: () => { refetch(); closeModal(); } });
  const transfer        = trpc.appointment.adminTransfer.useMutation({
    onSuccess: () => { refetch(); closeModal(); },
    onError:   (e) => alert(e.message),
  });
  const confirmPayment  = trpc.appointment.adminConfirmRepresentativePayment.useMutation({ onSuccess: () => { refetch(); closeModal(); } });
  const cancelAppt      = trpc.appointment.adminCancelAppointment.useMutation({ onSuccess: () => { refetch(); closeModal(); } });

  // Modal state
  const [modalAppt, setModalAppt]   = useState<AdminAppointment | null>(null);
  const [modalView, setModalView]   = useState<"menu" | "transfer" | "cancel" | "reject">("menu");
  const [form, setForm]             = useState({ target: "", reason: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function openModal(appt: AdminAppointment) {
    setModalAppt(appt);
    setModalView("menu");
    setForm({ target: "", reason: "" });
  }
  function closeModal() {
    setModalAppt(null);
    setModalView("menu");
    setForm({ target: "", reason: "" });
  }

  const countMap: Record<Tab, number> = {
    all:             counts?.all             ?? 0,
    pendingApproval: counts?.pendingApproval ?? 0,
    pendingPayment:  counts?.pendingPayment  ?? 0,
    confirmed:       counts?.confirmed       ?? 0,
    today:           counts?.today           ?? 0,
    completed:       counts?.completed       ?? 0,
    cancelled:       counts?.cancelled       ?? 0,
    transferred:     counts?.transferred     ?? 0,
  };

  return (
    <div dir="rtl" className="max-w-6xl">

      {/* ── Title ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">إدارة الجلسات</h1>
        <p className="text-sm text-gray-400">جميع الحجوزات والمواعيد في مكان واحد</p>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-2 mb-4 flex items-center gap-1 flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count  = countMap[t.key];
          const urgent = t.key === "pendingApproval" && count > 0;
          return (
            <button key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span>{t.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${
                  active ? "bg-white/20 text-white" :
                  urgent ? "bg-red-500 text-white" :
                  "bg-gray-100 text-gray-500"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ابحث باسم العميل، المستشار، رقم الهاتف، العنوان..."
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-100 text-right placeholder:text-gray-300"
        />
      </div>

      {data && (
        <p className="text-xs text-gray-400 mb-3 px-1">
          <span className="font-bold text-gray-700">{data.total}</span> نتيجة
          {search && <> · بحث: <span className="text-gray-700 font-medium">"{search}"</span></>}
        </p>
      )}

      {/* ── Cards ── */}
      {!data?.data.length ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center text-sm text-gray-400">
          لا توجد نتائج
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {data.data.map((appt) => (
            <Card
              key={appt.id}
              appt={appt}
              isExpanded={expandedId === appt.id}
              onToggleExpand={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
              onOpenModal={() => openModal(appt)}
            />
          ))}
        </div>
      )}

      {/* ── Actions Modal ── */}
      {modalAppt && (
        <ActionsModal
          appt={modalAppt}
          view={modalView}
          setView={setModalView}
          form={form}
          setForm={setForm}
          onClose={closeModal}
          consultants={consultants?.data ?? []}
          approve={approve}
          reject={reject}
          transfer={transfer}
          confirmPayment={confirmPayment}
          cancelAppt={cancelAppt}
        />
      )}

      {/* ── Pagination ── */}
      {(data?.total ?? 0) > 12 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:border-gray-300">
            ← السابق
          </button>
          <span className="px-4 py-2 text-sm font-bold text-gray-700">صفحة {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={(data?.data.length ?? 0) < 12}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:border-gray-300">
            التالي →
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Card ──
function Card({
  appt, isExpanded, onToggleExpand, onOpenModal,
}: {
  appt: AdminAppointment;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenModal: () => void;
}) {
  const state    = getState(appt);
  const payment  = getPayment(appt);
  const ps       = getPS(appt);
  const isTransferred  = !!appt.transferredFromConsultantId;
  const hasActions     = appt.status !== "CANCELLED" && appt.status !== "COMPLETED";
  const clientName  = appt.client?.user.name ?? appt.anonUser?.nickname ?? "—";
  const clientLabel = clientName;
  const relative       = formatRelative(appt.scheduledAt);
  const isRep          = appt.paymentMethod === "REPRESENTATIVE";

  return (
    <div className="relative bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-50">
      {/* ── Top colored bar ── */}
      <div className={`h-1.5 ${state.bar}`} />

      <div className="p-6">

        {/* ── Header: names+avatar (RIGHT) — status+menu (LEFT) ── */}
        <div className="flex items-start justify-between gap-3 mb-5">
          {/* RIGHT side (first in DOM for RTL): avatar + names */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Double avatar — consultant (front) + client (back) */}
            <div className="relative w-16 h-12 flex-shrink-0">
              <div className="absolute left-0 top-0 w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400 ring-2 ring-white">
                {clientName[0]?.toLowerCase() ?? "؟"}
              </div>
              <div className="absolute right-0 top-0 w-11 h-11 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-600 overflow-hidden ring-2 ring-white">
                {appt.consultant.user.avatar ? (
                  <img src={appt.consultant.user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (appt.consultant.user.name?.[0] ?? "؟")}
              </div>
            </div>
            <div className="text-right min-w-0">
              <p className="font-extrabold text-gray-900 text-lg leading-tight truncate">{appt.consultant.user.name}</p>
              <p className="text-xs text-gray-400 leading-tight mt-1">
                العميل: <span className="text-gray-600 font-medium">{clientLabel}</span>
              </p>
            </div>
          </div>

          {/* LEFT side (last in DOM for RTL): state pill + menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold px-3.5 py-1.5 rounded-full ${state.pill} inline-flex items-center gap-1.5 whitespace-nowrap`}>
              {state.urgent && <span className={`w-1.5 h-1.5 rounded-full ${state.dot} animate-pulse`} />}
              {state.label}
            </span>
            {hasActions && (
              <button
                onClick={onOpenModal}
                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-lg leading-none"
                title="الإجراءات"
              >⋮</button>
            )}
          </div>
        </div>

        {/* ── Meta row — aligned to the right (RTL start) ── */}
        <div className="flex items-center justify-start gap-x-6 gap-y-2 mb-5 text-sm flex-wrap">
          {/* date */}
          <span className="text-gray-900 font-semibold inline-flex items-center gap-1.5">
            <span>{formatDate(appt.scheduledAt)}</span>
            <span className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </span>
          {/* time */}
          <span className="text-gray-700 inline-flex items-center gap-1.5">
            <span>{formatTime(appt.scheduledAt)}</span>
            <span className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </span>
          {/* duration */}
          <span className="text-gray-700 inline-flex items-center gap-1.5">
            <span>{appt.duration} دقيقة</span>
            <span className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
          </span>
          {/* relative pill — visually leftmost */}
          {relative && (
            <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 font-semibold">
              {relative}
            </span>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-gray-100 -mx-6 mb-5" />

        {/* ── Payment row (RTL: [payment pill] price → ps chip on LEFT) ── */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          {/* RIGHT cluster: payment-method pill + price */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${payment.chip} inline-flex items-center gap-2 whitespace-nowrap`}>
              <span>{payment.label}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {payment.iconPath}
              </svg>
            </span>
            <p className="text-base font-bold text-gray-900">
              {Number(appt.finalPrice).toLocaleString("ar")}
              <span className="text-sm font-normal text-gray-500 mr-1">د.ع</span>
            </p>
          </div>
          {/* LEFT: payment-status chip */}
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${ps.chip} inline-flex items-center gap-2 whitespace-nowrap`}>
            <span>{ps.label}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {ps.iconPath}
            </svg>
          </span>
        </div>

        {/* ── Recommendation indicator (collapsed) ── */}
        {!isExpanded && <RecommendationIndicator appointmentId={appt.id} />}

        {/* ── Expand toggle ── */}
        <button
          onClick={onToggleExpand}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-700 py-1 flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>{isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل الكاملة"}</span>
          <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
        </button>

        {/* ── Expanded details ── */}
        {isExpanded && (
          <div className="bg-gray-50/70 rounded-2xl px-5 py-4 mt-3 divide-y divide-dashed divide-gray-200">

            {/* Booking info */}
            <DetailRow icon="#"  label="رقم الحجز"          value={`APT-${appt.id.slice(-8).toUpperCase()}`} mono />
            <DetailRow icon="📅" label="تاريخ الحجز"        value={formatFullDateTime(appt.createdAt)} />
            {appt.adminApprovedAt && (
              <DetailRow icon="👤" label="وقت الموافقة"     value={formatFullDateTime(appt.adminApprovedAt)} />
            )}

            {/* Delivery info — for REPRESENTATIVE only */}
            {isRep && appt.clientPhone && (
              <DetailRow icon="📞" label="رقم الهاتف"       value={appt.clientPhone} phone />
            )}
            {isRep && appt.clientAddress && (
              <DetailRow icon="📍" label="عنوان التوصيل"   value={appt.clientAddress} multiline />
            )}

            {/* Transfer info */}
            {isTransferred && appt.transferredFromConsultant && (
              <DetailRow icon="↪" label="محوّلة من"         value={appt.transferredFromConsultant.user.name} highlight />
            )}
            {appt.transferredAt && (
              <DetailRow icon="🕒" label="وقت النقل"         value={formatFullDateTime(appt.transferredAt)} />
            )}
            {appt.transferReason && (
              <DetailRow icon="✎" label="سبب النقل"          value={appt.transferReason} multiline />
            )}

            {/* Pricing */}
            <DetailRow icon="💰" label="السعر الأصلي"       value={`${Number(appt.originalPrice).toLocaleString("ar")} د.ع`} />
            {Number(appt.discountAmount) > 0 && (
              <DetailRow icon="🏷" label="قيمة الخصم"       value={`${Number(appt.discountAmount).toLocaleString("ar")} د.ع`} highlight />
            )}
            {appt.userPackageId && (
              <DetailRow icon="📦" label="باقة مدفوعة"     value="جلسة مخصومة من الباقة" highlight />
            )}

            {/* Session */}
            {appt.meetingLink && (
              <DetailRow icon="🔗" label="رابط الجلسة"      value={appt.meetingLink} link />
            )}
            {appt.assessmentResultId && (
              <DetailRow icon="🧠" label="التقييم النفسي"   value="نتيجة مرفقة بالحجز" highlight />
            )}

            {/* Notes */}
            {appt.notes && (
              <DetailRow icon="📝" label="ملاحظات"          value={appt.notes} multiline />
            )}
            {appt.cancelReason && (
              <DetailRow icon="✗" label="سبب الإلغاء"      value={appt.cancelReason} multiline />
            )}
          </div>
        )}

        {/* Consultant recommendation (private from consultant to admin) */}
        {isExpanded && (
          <RecommendationBlock appointmentId={appt.id} />
        )}
      </div>
    </div>
  );
}

// ── Recommendation indicator (when collapsed) ──
function RecommendationIndicator({ appointmentId }: { appointmentId: string }) {
  const { data: rec } = trpc.sessionRecommendation.getForAppointment.useQuery({ appointmentId });
  if (!rec) return null;
  return (
    <div className="flex items-center gap-2 mb-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
      <span className="text-purple-500 text-sm">📨</span>
      <p className="text-xs text-purple-800 font-semibold flex-1 text-right">
        توصية من المستشار
      </p>
      {!rec.isRead && (
        <span className="text-[10px] text-white bg-red-500 px-2 py-0.5 rounded-full font-bold">جديد</span>
      )}
    </div>
  );
}

// ── Recommendation block (admin view) ──
function RecommendationBlock({ appointmentId }: { appointmentId: string }) {
  const { data: rec } = trpc.sessionRecommendation.getForAppointment.useQuery({ appointmentId });
  const markRead = trpc.sessionRecommendation.markAsRead.useMutation();

  // Auto-mark as read on first view
  if (rec && !rec.isRead && !markRead.isPending && !markRead.isSuccess) {
    markRead.mutate({ id: rec.id });
  }

  if (!rec) return null;

  return (
    <div className="mt-3 bg-purple-50 border border-purple-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 bg-purple-100/50 border-b border-purple-200 flex items-center justify-between">
        <span className="text-[10px] text-purple-600 font-medium">
          {new Date(rec.createdAt).toLocaleDateString("ar-IQ-u-nu-latn")}
        </span>
        <p className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
          <span>توصية من المستشار</span>
          <span>📨</span>
        </p>
      </div>
      <div
        className="px-4 py-3 prose prose-sm max-w-none text-right leading-relaxed text-gray-800"
        dir="rtl"
        dangerouslySetInnerHTML={{ __html: rec.content }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Actions Modal ──
function ActionsModal({
  appt, view, setView, form, setForm, onClose, consultants,
  approve, reject, transfer, confirmPayment, cancelAppt,
}: {
  appt: AdminAppointment;
  view: "menu" | "transfer" | "cancel" | "reject";
  setView: (v: "menu" | "transfer" | "cancel" | "reject") => void;
  form: { target: string; reason: string };
  setForm: (f: { target: string; reason: string }) => void;
  onClose: () => void;
  consultants: NonNullable<ReturnType<typeof trpc.consultant.list.useQuery>["data"]>["data"];
  approve:        ReturnType<typeof trpc.appointment.adminApproveRepresentative.useMutation>;
  reject:         ReturnType<typeof trpc.appointment.adminRejectRepresentative.useMutation>;
  transfer:       ReturnType<typeof trpc.appointment.adminTransfer.useMutation>;
  confirmPayment: ReturnType<typeof trpc.appointment.adminConfirmRepresentativePayment.useMutation>;
  cancelAppt:     ReturnType<typeof trpc.appointment.adminCancelAppointment.useMutation>;
}) {
  const state = getState(appt);
  const isRep = appt.paymentMethod === "REPRESENTATIVE";
  const awaitsApproval = state.label === "بانتظار الموافقة";
  const canTransfer    = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const canCancel      = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const canConfirmPay  = isRep && appt.paymentStatus !== "PAID" && appt.status !== "CANCELLED";
  const clientName     = appt.client?.user.name ?? appt.anonUser?.nickname ?? "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-lg">
            ✕
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-400">{view === "menu" ? "إجراءات الجلسة" : "إكمال الإجراء"}</p>
            <p className="font-bold text-gray-900 text-sm">{appt.consultant.user.name} — {clientName}</p>
          </div>
        </div>

        {/* Menu view */}
        {view === "menu" && (
          <div className="p-4 space-y-2">
            {/* Awaiting approval — approve + reject */}
            {awaitsApproval && (
              <>
                <ActionButton
                  color="emerald"
                  icon="✓"
                  label="موافقة على الحجز"
                  description="قبول الحجز وتأكيده تلقائياً"
                  onClick={() => approve.mutate({ id: appt.id })}
                  loading={approve.isPending}
                />
                <ActionButton
                  color="red"
                  icon="✗"
                  label="رفض الحجز"
                  description="إلغاء الحجز قبل التأكيد"
                  onClick={() => setView("reject")}
                />
                <Divider />
              </>
            )}

            {/* Confirm payment (REPRESENTATIVE only) */}
            {canConfirmPay && (
              <ActionButton
                color="blue"
                icon="💰"
                label="تأكيد استلام الدفع"
                description="تحديد أن المندوب حصّل المبلغ من العميل"
                onClick={() => confirmPayment.mutate({ id: appt.id })}
                loading={confirmPayment.isPending}
              />
            )}

            {/* Transfer */}
            {canTransfer && !awaitsApproval && (
              <ActionButton
                color="gray"
                icon="↪"
                label="تحويل لمستشار آخر"
                description="نقل الجلسة لمستشار بديل"
                onClick={() => setView("transfer")}
              />
            )}

            {/* Cancel */}
            {canCancel && !awaitsApproval && (
              <ActionButton
                color="red"
                icon="✕"
                label="إلغاء الجلسة"
                description="إيقاف الجلسة وإلغاؤها نهائياً"
                onClick={() => setView("cancel")}
              />
            )}
          </div>
        )}

        {/* Reject view */}
        {view === "reject" && (
          <FormView
            title="سبب الرفض"
            description="يرجى توضيح سبب رفض الحجز (اختياري)"
            placeholder="مثال: الحجز خارج نطاق الخدمة"
            value={form.reason}
            onChange={(v) => setForm({ ...form, reason: v })}
            primaryLabel="تأكيد الرفض"
            primaryColor="bg-red-500 hover:bg-red-600"
            onPrimary={() => reject.mutate({ id: appt.id, reason: form.reason || undefined })}
            primaryLoading={reject.isPending}
            onBack={() => setView("menu")}
          />
        )}

        {/* Cancel view */}
        {view === "cancel" && (
          <FormView
            title="إلغاء الجلسة"
            description="يرجى توضيح سبب إلغاء الجلسة (اختياري)"
            placeholder="مثال: العميل طلب الإلغاء"
            value={form.reason}
            onChange={(v) => setForm({ ...form, reason: v })}
            primaryLabel="تأكيد الإلغاء"
            primaryColor="bg-red-500 hover:bg-red-600"
            onPrimary={() => cancelAppt.mutate({ id: appt.id, reason: form.reason || undefined })}
            primaryLoading={cancelAppt.isPending}
            onBack={() => setView("menu")}
          />
        )}

        {/* Transfer view */}
        {view === "transfer" && (
          <div className="p-5 space-y-3">
            <p className="text-sm font-bold text-gray-900 mb-3">↪ تحويل لمستشار آخر</p>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">المستشار الجديد</label>
              <select
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 bg-white text-right"
              >
                <option value="">— اختر مستشاراً —</option>
                {consultants.filter((c) => c.id !== appt.consultantId).map((c) => (
                  <option key={c.id} value={c.id}>{c.user.name}{c.city ? ` — ${c.city}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">سبب التحويل</label>
              <input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="اختياري"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 text-right"
              />
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100 mt-4">
              <button
                onClick={() => transfer.mutate({ appointmentId: appt.id, newConsultantId: form.target, reason: form.reason || undefined })}
                disabled={!form.target || transfer.isPending}
                className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-40"
              >
                {transfer.isPending ? "جارٍ النقل..." : "تأكيد النقل"}
              </button>
              <button
                onClick={() => setView("menu")}
                className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl"
              >رجوع</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Action button (large card-style button for modal) ──
function ActionButton({
  color, icon, label, description, onClick, loading,
}: {
  color: "emerald" | "red" | "blue" | "gray";
  icon: string; label: string; description: string;
  onClick: () => void; loading?: boolean;
}) {
  const styles = {
    emerald: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700",
    red:     "bg-red-50 hover:bg-red-100 text-red-700",
    blue:    "bg-blue-50 hover:bg-blue-100 text-blue-700",
    gray:    "bg-gray-50 hover:bg-gray-100 text-gray-700",
  };
  const iconBg = {
    emerald: "bg-emerald-500",
    red:     "bg-red-500",
    blue:    "bg-blue-500",
    gray:    "bg-gray-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl ${styles[color]} transition-colors disabled:opacity-50 text-right`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{loading ? "..." : label}</p>
        <p className="text-xs opacity-70 mt-0.5">{description}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl ${iconBg[color]} text-white flex items-center justify-center text-base font-bold flex-shrink-0`}>
        {icon}
      </div>
    </button>
  );
}

function Divider() { return <div className="my-3 border-t border-gray-100" />; }

function FormView({
  title, description, placeholder, value, onChange,
  primaryLabel, primaryColor, onPrimary, primaryLoading, onBack,
}: {
  title: string; description: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  primaryLabel: string; primaryColor: string;
  onPrimary: () => void; primaryLoading: boolean;
  onBack: () => void;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-bold text-gray-900 mb-1">{title}</p>
      <p className="text-xs text-gray-400 mb-4">{description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 text-right resize-none"
      />
      <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4">
        <button
          onClick={onPrimary}
          disabled={primaryLoading}
          className={`flex-1 py-2.5 text-white text-sm font-bold rounded-xl ${primaryColor} disabled:opacity-50`}
        >
          {primaryLoading ? "..." : primaryLabel}
        </button>
        <button onClick={onBack} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">رجوع</button>
      </div>
    </div>
  );
}

// ── Detail row (RTL: icon+label RIGHT, value LEFT) ──
function DetailRow({
  icon, label, value, mono, link, phone, multiline, highlight,
}: {
  icon: string; label: string; value: string;
  mono?: boolean; link?: boolean; phone?: boolean; multiline?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-1">
      {/* RIGHT (first in DOM → RTL visual right): icon + label */}
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className="text-gray-300 text-sm w-4 text-center">{icon}</span>
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>
      {/* LEFT (last in DOM → RTL visual left): value */}
      <div className="text-left flex-1 min-w-0">
        {link ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-semibold truncate block" dir="ltr">
            {value}
          </a>
        ) : phone ? (
          <a href={`tel:${value}`} className="text-sm text-blue-600 hover:underline font-bold inline-block" dir="ltr">
            {value}
          </a>
        ) : (
          <p className={`text-sm font-bold ${highlight ? "text-indigo-600" : "text-gray-900"} ${mono ? "font-mono" : ""} ${multiline ? "leading-relaxed" : "truncate"}`} dir={mono ? "ltr" : "auto"}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
