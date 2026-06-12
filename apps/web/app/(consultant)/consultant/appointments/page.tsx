"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { RichEditor } from "@/components/ui/rich-editor";

// ── helpers ──
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
function formatFullDateTime(d: string | Date) { return `${formatDate(d)} — ${formatTime(d)}`; }
function formatRelative(d: string | Date): string | null {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "غداً";
  if (diffDays === -1) return "أمس";
  if (diffDays > 0 && diffDays < 14) return `بعد ${diffDays} أيام`;
  if (diffDays < 0 && diffDays > -14) return `قبل ${Math.abs(diffDays)} أيام`;
  return null;
}

type StateInfo = { label: string; pill: string; bar: string; dot?: string; urgent?: boolean };
function getState(appt: MyAppointment): StateInfo {
  if (appt.status === "CANCELLED") return { label: "ملغية",  pill: "bg-red-50 text-red-700",     bar: "bg-red-400"    };
  if (appt.status === "NO_SHOW")   return { label: "لم يحضر", pill: "bg-orange-50 text-orange-700", bar: "bg-orange-300" };
  if (appt.status === "COMPLETED") return { label: "مكتملة", pill: "bg-gray-100 text-gray-600",   bar: "bg-gray-300"   };
  if (appt.status === "CONFIRMED") return { label: "مؤكدة",  pill: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" };
  return { label: "معلّقة", pill: "bg-amber-50 text-amber-700", bar: "bg-amber-300" };
}

// ── Meeting-link access window ──
// Consultant can join: from 30 min BEFORE start until END of session
type MeetingAccess =
  | { state: "available"; }
  | { state: "tooEarly"; minutesUntil: number; }
  | { state: "ended"; }
  | { state: "noLink"; };

function getMeetingAccess(appt: MyAppointment): MeetingAccess {
  if (!appt.meetingLink) return { state: "noLink" };
  const now      = Date.now();
  const start    = new Date(appt.scheduledAt).getTime();
  const end      = start + appt.duration * 60 * 1000;
  const openFrom = start - 30 * 60 * 1000;
  if (now < openFrom) {
    const minutesUntil = Math.ceil((openFrom - now) / (60 * 1000));
    return { state: "tooEarly", minutesUntil };
  }
  if (now > end) return { state: "ended" };
  return { state: "available" };
}

function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h} ساعة و ${m} دقيقة` : `${h} ساعة`;
  const days = Math.floor(h / 24);
  return `${days} يوم`;
}

type Tab = "all" | "pending" | "confirmed" | "today" | "completed" | "cancelled" | "noShow";
const TABS: { key: Tab; label: string }[] = [
  { key: "all",       label: "الكل" },
  { key: "pending",   label: "معلّقة" },
  { key: "confirmed", label: "مؤكدة" },
  { key: "today",     label: "اليوم" },
  { key: "completed", label: "مكتملة" },
  { key: "cancelled", label: "ملغية" },
  { key: "noShow",    label: "لم يحضر" },
];
function tabToStatus(tab: Tab): undefined | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" {
  switch (tab) {
    case "pending":   return "PENDING";
    case "confirmed":
    case "today":     return "CONFIRMED";
    case "completed": return "COMPLETED";
    case "cancelled": return "CANCELLED";
    case "noShow":    return "NO_SHOW";
    default:          return undefined;
  }
}

type MyAppointment = NonNullable<ReturnType<typeof trpc.appointment.myAppointments.useQuery>["data"]>["data"][number];

// ══════════════════════════════════════════════════════════════════════════════
export default function ConsultantSessionsPage() {
  const [tab, setTab]   = useState<Tab>("all");
  const [page, setPage] = useState(1);

  const status = tabToStatus(tab);
  const { data, refetch } = trpc.appointment.myAppointments.useQuery({
    page, limit: 12,
    status: status as never,
  });

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: () => { refetch(); closeModal(); },
    onError:   (e) => alert(e.message),
  });

  const [modalAppt, setModalAppt]   = useState<MyAppointment | null>(null);
  const [modalView, setModalView]   = useState<"menu" | "cancel" | "report" | "recommendation" | "assessment">("menu");
  const [cancelReason, setCancelReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function openModal(appt: MyAppointment) {
    setModalAppt(appt);
    setModalView("menu");
    setCancelReason("");
  }
  function closeModal() {
    setModalAppt(null);
    setModalView("menu");
    setCancelReason("");
  }

  // For "اليوم" tab — filter client-side
  const filtered = tab === "today"
    ? (data?.data ?? []).filter((a) => {
        const d = new Date(a.scheduledAt);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      })
    : (data?.data ?? []);

  return (
    <div dir="rtl" className="max-w-6xl">
      {/* ── Title ── */}
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-gray-400">{data?.total ?? 0} جلسة</span>
        <h1 className="text-2xl font-extrabold text-gray-900">الجلسات</h1>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-2 mb-4 flex items-center gap-1 flex-wrap">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Cards ── */}
      {!filtered.length ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center text-sm text-gray-400">
          لا توجد جلسات
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((appt) => (
            <Card key={appt.id}
              appt={appt}
              isExpanded={expandedId === appt.id}
              onToggleExpand={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
              onOpenModal={() => openModal(appt)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modalAppt && (
        <ActionsModal
          appt={modalAppt}
          view={modalView}
          setView={setModalView}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          onClose={closeModal}
          updateStatus={updateStatus}
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

// ── Card ──
function Card({ appt, isExpanded, onToggleExpand, onOpenModal }: {
  appt: MyAppointment;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenModal: () => void;
}) {
  const state    = getState(appt);
  const access   = getMeetingAccess(appt);
  const isTransferred  = !!appt.transferredFromConsultantId;
  const hasActions     = appt.status !== "CANCELLED"; // Completed sessions can have reports
  const clientName     = appt.client?.user.name ?? appt.anonUser?.nickname ?? "—";
  const relative       = formatRelative(appt.scheduledAt);
  const isRep          = appt.paymentMethod === "REPRESENTATIVE";

  return (
    <div className="relative bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-50">
      {/* Top status bar */}
      <div className={`h-1.5 ${state.bar}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          {/* RIGHT: avatar + names */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-600 ring-2 ring-white overflow-hidden flex-shrink-0">
              {clientName[0] ?? "؟"}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-gray-900 text-lg leading-tight truncate">{clientName}</p>
              <p className="text-xs text-gray-400 leading-tight mt-1">
                العميل
                {isTransferred && (
                  <span className="text-purple-600"> · محوّلة إليك</span>
                )}
              </p>
            </div>
          </div>

          {/* LEFT: state + menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold px-3.5 py-1.5 rounded-full ${state.pill} whitespace-nowrap`}>
              {state.label}
            </span>
            {hasActions && (
              <button onClick={onOpenModal}
                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-lg leading-none"
                title="الإجراءات"
              >⋮</button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-start gap-x-6 gap-y-2 mb-5 text-sm flex-wrap">
          <span className="text-gray-900 font-semibold inline-flex items-center gap-1.5">
            <span>{formatDate(appt.scheduledAt)}</span>
            <span className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </span>
          <span className="text-gray-700 inline-flex items-center gap-1.5">
            <span>{formatTime(appt.scheduledAt)}</span>
            <span className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </span>
          <span className="text-gray-700 inline-flex items-center gap-1.5">
            <span>{appt.duration} دقيقة</span>
            <span className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
          </span>
          {relative && (
            <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 font-semibold">{relative}</span>
          )}
        </div>

        {/* Meeting access — only for CONFIRMED with link */}
        {appt.status === "CONFIRMED" && access.state !== "noLink" && (
          <div className="-mx-6 px-6 pt-5 border-t border-gray-100">
            {access.state === "available" && (
              <a
                href={appt.meetingLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 mb-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>ابدأ الجلسة الآن</span>
              </a>
            )}

            {access.state === "tooEarly" && (
              <div className="flex items-center gap-3 w-full py-3 px-4 mb-2 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-right flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-800">رابط الجلسة مغلق</p>
                  <p className="text-xs text-amber-600 mt-0.5">يفتح قبل 30 دقيقة من الموعد · بعد {formatWait(access.minutesUntil)}</p>
                </div>
              </div>
            )}

            {access.state === "ended" && (
              <div className="flex items-center gap-3 w-full py-3 px-4 mb-2 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="text-right flex-1">
                  <p className="text-sm font-bold text-gray-700">انتهى وقت الجلسة</p>
                  <p className="text-xs text-gray-500 mt-0.5">لم يعد بإمكانك الانضمام</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-700 py-1 flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>{isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل الكاملة"}</span>
          <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
        </button>

        {/* Expanded */}
        {isExpanded && (
          <div className="bg-gray-50/70 rounded-2xl px-5 py-4 mt-3 divide-y divide-dashed divide-gray-200">
            <DetailRow icon="#"  label="رقم الجلسة"        value={`APT-${appt.id.slice(-8).toUpperCase()}`} mono />
            <DetailRow icon="📅" label="تاريخ الحجز"        value={formatFullDateTime(appt.createdAt)} />

            {/* Delivery info — for REPRESENTATIVE only */}
            {isRep && appt.clientPhone && (
              <DetailRow icon="📞" label="رقم الهاتف"      value={appt.clientPhone} phone />
            )}
            {isRep && appt.clientAddress && (
              <DetailRow icon="📍" label="عنوان العميل"   value={appt.clientAddress} multiline />
            )}

            {/* Transfer info */}
            {isTransferred && appt.transferredFromConsultant && (
              <DetailRow icon="↪" label="محوّلة من"        value={appt.transferredFromConsultant.user.name} highlight />
            )}
            {appt.transferReason && (
              <DetailRow icon="✎" label="سبب التحويل"      value={appt.transferReason} multiline />
            )}

            {/* Notes */}
            {appt.notes && (
              <DetailRow icon="📝" label="ملاحظات العميل"  value={appt.notes} multiline />
            )}
            {appt.cancelReason && (
              <DetailRow icon="✗" label="سبب الإلغاء"     value={appt.cancelReason} multiline />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Actions Modal ──
function ActionsModal({
  appt, view, setView, cancelReason, setCancelReason, onClose, updateStatus,
}: {
  appt: MyAppointment;
  view: "menu" | "cancel" | "report" | "recommendation" | "assessment";
  setView: (v: "menu" | "cancel" | "report" | "recommendation" | "assessment") => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  onClose: () => void;
  updateStatus: ReturnType<typeof trpc.appointment.updateStatus.useMutation>;
}) {
  const clientName = appt.client?.user.name ?? appt.anonUser?.nickname ?? "—";

  const canConfirm  = appt.status === "PENDING";
  const canComplete = appt.status === "CONFIRMED";
  const canNoShow   = appt.status === "CONFIRMED";
  const canCancel   = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const canReport   = appt.status === "COMPLETED";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose} dir="rtl">
      <div className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden ${
        view === "report" || view === "recommendation" || view === "assessment" ? "max-w-3xl" : "max-w-md"
      }`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-lg">✕</button>
          <div className="text-right">
            <p className="text-xs text-gray-400">{view === "menu" ? "إجراءات الجلسة" : "إلغاء الجلسة"}</p>
            <p className="font-bold text-gray-900 text-sm">{clientName}</p>
          </div>
        </div>

        {/* Menu view */}
        {view === "menu" && (() => {
          const access = getMeetingAccess(appt);
          return (
          <div className="p-4 space-y-2">
            {appt.meetingLink && appt.status === "CONFIRMED" && access.state === "available" && (
              <ActionButton
                color="blue" icon="🎥"
                label="ابدأ الجلسة الآن"
                description="فتح رابط الاجتماع"
                onClick={() => { window.open(appt.meetingLink!, "_blank"); onClose(); }}
              />
            )}
            {appt.meetingLink && appt.status === "CONFIRMED" && access.state === "tooEarly" && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs text-amber-700 text-right">
                ⏰ رابط الجلسة يفتح قبل 30 دقيقة من الموعد · بعد <strong>{formatWait(access.minutesUntil)}</strong>
              </div>
            )}

            {/* Always-available — assessment answers */}
            <ActionButton
              color="purple" icon="📋"
              label="إجابات التقييم النفسي"
              description="عرض ما أجاب عليه العميل قبل الجلسة"
              onClick={() => setView("assessment")}
            />

            {canConfirm && (
              <ActionButton
                color="emerald" icon="✓"
                label="تأكيد الحجز"
                description="قبول الحجز وتأكيده"
                onClick={() => updateStatus.mutate({ id: appt.id, status: "CONFIRMED" })}
                loading={updateStatus.isPending}
              />
            )}

            {canComplete && (
              <ActionButton
                color="emerald" icon="✓"
                label="إنهاء الجلسة"
                description="كتابة التقرير وإنهاء الجلسة"
                onClick={() => setView("report")}
              />
            )}

            {canNoShow && (
              <ActionButton
                color="gray" icon="⊘"
                label="العميل لم يحضر"
                description="تسجيل عدم حضور العميل"
                onClick={() => updateStatus.mutate({ id: appt.id, status: "NO_SHOW" })}
                loading={updateStatus.isPending}
              />
            )}

            {canCancel && (
              <ActionButton
                color="red" icon="✕"
                label="إلغاء الجلسة"
                description="إيقاف الجلسة وإلغاؤها"
                onClick={() => setView("cancel")}
              />
            )}

            {canReport && (
              <ActionButton
                color="blue" icon="📝"
                label="كتابة تقرير الجلسة"
                description="تقرير سري لا يطّلع عليه أحد"
                onClick={() => setView("report")}
              />
            )}

            {/* Recommendation — available for CONFIRMED, COMPLETED (not PENDING) */}
            {appt.status !== "PENDING" && appt.status !== "CANCELLED" && (
              <ActionButton
                color="purple" icon="📨"
                label="توصية للإدارة"
                description="رسالة للإدارة حول العميل (لا يراها العميل)"
                onClick={() => setView("recommendation")}
              />
            )}
          </div>
          );
        })()}

        {/* Report view */}
        {view === "report" && (
          <ReportView appt={appt} onBack={() => setView("menu")} onClose={onClose} />
        )}

        {/* Recommendation view */}
        {view === "recommendation" && (
          <RecommendationView appt={appt} onBack={() => setView("menu")} onClose={onClose} />
        )}

        {/* Assessment answers view */}
        {view === "assessment" && (
          <AssessmentView appt={appt} onBack={() => setView("menu")} />
        )}

        {/* Cancel view */}
        {view === "cancel" && (
          <div className="p-5">
            <p className="text-sm font-bold text-gray-900 mb-1">سبب الإلغاء</p>
            <p className="text-xs text-gray-400 mb-4">يرجى توضيح سبب إلغاء الجلسة (اختياري)</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="مثال: حالة طارئة"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 text-right resize-none"
            />
            <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4">
              <button
                onClick={() => updateStatus.mutate({ id: appt.id, status: "CANCELLED", cancelReason: cancelReason || undefined })}
                disabled={updateStatus.isPending}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
              >
                {updateStatus.isPending ? "..." : "تأكيد الإلغاء"}
              </button>
              <button onClick={() => setView("menu")} className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">رجوع</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ color, icon, label, description, onClick, loading }: {
  color: "emerald" | "red" | "blue" | "gray" | "purple";
  icon: string; label: string; description: string;
  onClick: () => void; loading?: boolean;
}) {
  const styles = {
    emerald: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700",
    red:     "bg-red-50 hover:bg-red-100 text-red-700",
    blue:    "bg-blue-50 hover:bg-blue-100 text-blue-700",
    gray:    "bg-gray-50 hover:bg-gray-100 text-gray-700",
    purple:  "bg-purple-50 hover:bg-purple-100 text-purple-700",
  };
  const iconBg = {
    emerald: "bg-emerald-500", red: "bg-red-500", blue: "bg-blue-500", gray: "bg-gray-700", purple: "bg-purple-500",
  };
  return (
    <button onClick={onClick} disabled={loading}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl ${styles[color]} transition-colors disabled:opacity-50 text-right`}>
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

// ── Assessment Answers View (Modal — shows client's pre-session questionnaire) ──
function AssessmentView({ appt, onBack }: { appt: MyAppointment; onBack: () => void }) {
  const { data: result, isLoading } = trpc.anonymous.getAssessmentForAppointment.useQuery(
    { appointmentId: appt.id },
  );

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800">→ رجوع</button>
        <p className="text-sm font-bold text-gray-900">إجابات التقييم النفسي</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-10 animate-pulse">جارٍ التحميل...</p>
      ) : !result ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p className="text-sm">لم يُجرِ هذا العميل تقييماً نفسياً</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {result.recommendation && (
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-xs text-amber-600 font-semibold mb-1">التوصية</p>
              <p className="text-sm text-gray-700 leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          {result.answers?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-2">تفاصيل الإجابات</p>
              <div className="space-y-2">
                {[...result.answers]
                  .sort((a, b) => a.question.order - b.question.order)
                  .map((ans, idx) => (
                    <div key={ans.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                      <p className="text-xs text-gray-500 mb-1">س{idx + 1}. {ans.question.textAr}</p>
                      <p className="text-sm font-semibold text-indigo-700">{ans.option.textAr}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Report Editor (Modal view — full screen on small, large on desktop) ──
function ReportView({
  appt, onBack, onClose,
}: {
  appt: MyAppointment;
  onBack: () => void;
  onClose: () => void;
}) {
  const { data: existing, isLoading } = trpc.sessionReport.getByAppointment.useQuery({
    appointmentId: appt.id,
  });
  const [content, setContent] = useState("");
  const [loaded, setLoaded]   = useState(false);

  // Will-complete mode: session is CONFIRMED → submit + complete in one go
  const willComplete = appt.status === "CONFIRMED";

  // Initialize when fetched
  if (!loaded && !isLoading && existing !== undefined) {
    setContent(existing?.content ?? "");
    setLoaded(true);
  }

  const upsert = trpc.sessionReport.upsert.useMutation({
    onSuccess: () => onClose(),
    onError:   (e) => alert(e.message),
  });
  const submitComplete = trpc.sessionReport.submitAndComplete.useMutation({
    onSuccess: () => onClose(),
    onError:   (e) => alert(e.message),
  });

  // Strip HTML tags to check if content is actually empty
  const plainText = content.replace(/<[^>]*>/g, "").trim();
  const isEmpty   = plainText.length === 0;

  function save() {
    if (isEmpty) return;
    if (willComplete) {
      submitComplete.mutate({ appointmentId: appt.id, content });
    } else {
      upsert.mutate({ appointmentId: appt.id, content });
    }
  }

  const saving = upsert.isPending || submitComplete.isPending;

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <button onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          <span>→</span> رجوع
        </button>
        <div className="text-right">
          <p className="text-xs text-gray-400">
            {willComplete ? "إنهاء الجلسة وكتابة التقرير" : existing ? "تعديل التقرير" : "كتابة تقرير الجلسة"}
          </p>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mt-0.5 justify-end">
            <span>تقرير سري</span>
            <span>🔒</span>
          </p>
        </div>
      </div>

      {/* Important notice for completing */}
      {willComplete && (
        <div className="mx-5 mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2 flex-shrink-0">
          <span className="text-amber-500 mt-0.5">ℹ️</span>
          <p className="text-xs text-amber-800 leading-relaxed">
            لإنهاء الجلسة، يجب كتابة التقرير أولاً. التقرير سري ولا يطّلع عليه أحد سواك.
          </p>
        </div>
      )}

      {/* Editor */}
      <div className="p-5 overflow-y-auto flex-1">
        {isLoading && !loaded ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <RichEditor
            value={content}
            onChange={setContent}
            autoFocus
            minHeight={300}
            placeholder="اكتب تقرير الجلسة هنا...

يمكنك تضمين:
• ملاحظات حول حالة العميل
• المواضيع التي نوقشت
• التحديات التي ظهرت
• خطة الجلسات القادمة"
          />
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2 flex-shrink-0 bg-white">
        <button
          onClick={save}
          disabled={isEmpty || saving}
          className={`flex-1 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors ${
            willComplete
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {saving
            ? "جارٍ الحفظ..."
            : willComplete
              ? "✓ حفظ التقرير وإنهاء الجلسة"
              : existing ? "حفظ التعديلات" : "حفظ التقرير"
          }
        </button>
        <button onClick={onBack}
          className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">إلغاء</button>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, mono, link, phone, multiline, highlight }: {
  icon: string; label: string; value: string;
  mono?: boolean; link?: boolean; phone?: boolean; multiline?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-1">
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className="text-gray-300 text-sm w-4 text-center">{icon}</span>
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-left flex-1 min-w-0">
        {link ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-semibold truncate block" dir="ltr">{value}</a>
        ) : phone ? (
          <a href={`tel:${value}`} className="text-sm text-blue-600 hover:underline font-bold inline-block" dir="ltr">{value}</a>
        ) : (
          <p className={`text-sm font-bold ${highlight ? "text-indigo-600" : "text-gray-900"} ${mono ? "font-mono" : ""} ${multiline ? "leading-relaxed" : "truncate"}`} dir={mono ? "ltr" : "auto"}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Recommendation Editor (for admin) ──
function RecommendationView({
  appt, onBack, onClose,
}: {
  appt: MyAppointment;
  onBack: () => void;
  onClose: () => void;
}) {
  const { data: existing, isLoading } = trpc.sessionRecommendation.getMine.useQuery({
    appointmentId: appt.id,
  });
  const [content, setContent] = useState("");
  const [loaded, setLoaded]   = useState(false);

  if (!loaded && !isLoading && existing !== undefined) {
    setContent(existing?.content ?? "");
    setLoaded(true);
  }

  const upsert = trpc.sessionRecommendation.upsert.useMutation({
    onSuccess: () => onClose(),
    onError:   (e) => alert(e.message),
  });
  const remove = trpc.sessionRecommendation.delete.useMutation({
    onSuccess: () => onClose(),
  });

  const plainText = content.replace(/<[^>]*>/g, "").trim();
  const isEmpty   = plainText.length === 0;

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <button onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          <span>→</span> رجوع
        </button>
        <div className="text-right">
          <p className="text-xs text-gray-400">{existing ? "تعديل التوصية" : "كتابة توصية للإدارة"}</p>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mt-0.5 justify-end">
            <span>يقرأها الإدارة فقط</span>
            <span>📨</span>
          </p>
        </div>
      </div>

      {/* Notice */}
      <div className="mx-5 mt-3 bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-start gap-2 flex-shrink-0">
        <span className="text-purple-500 mt-0.5">ℹ️</span>
        <p className="text-xs text-purple-800 leading-relaxed">
          هذه التوصية تصل للإدارة مباشرةً ولا يطّلع عليها العميل.
          يمكنك مشاركة ملاحظات أو اقتراحات تخص متابعة العميل.
        </p>
      </div>

      {/* Editor */}
      <div className="p-5 overflow-y-auto flex-1">
        {isLoading && !loaded ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <RichEditor
            value={content}
            onChange={setContent}
            autoFocus
            minHeight={260}
            placeholder="اكتب توصيتك للإدارة هنا...

مثلاً:
• ملاحظات تخص حالة العميل تتطلب اهتمام الإدارة
• توصية بتحويل العميل لمستشار أخصائي
• اقتراحات لتطوير الخدمة المقدمة
• أي معلومات تساعد الإدارة في متابعة العميل"
          />
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2 flex-shrink-0 bg-white">
        <button
          onClick={() => upsert.mutate({ appointmentId: appt.id, content })}
          disabled={isEmpty || upsert.isPending}
          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors"
        >
          {upsert.isPending ? "جارٍ الإرسال..." : (existing ? "📨 تحديث التوصية" : "📨 إرسال للإدارة")}
        </button>
        {existing && (
          <button
            onClick={() => { if (confirm("حذف التوصية؟")) remove.mutate({ id: existing.id }); }}
            disabled={remove.isPending}
            className="px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl"
          >🗑</button>
        )}
        <button onClick={onBack}
          className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">إلغاء</button>
      </div>
    </div>
  );
}
