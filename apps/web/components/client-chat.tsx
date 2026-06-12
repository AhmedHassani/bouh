"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

function formatTime(d: string | Date) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}

/**
 * Per-session chat button — appears inside each appointment card.
 * Click → opens chat scoped to that session only.
 */
export function SessionChatButton({
  anonUserId,
  appointmentId,
  consultantName,
  unread = 0,
}: {
  anonUserId: string;
  appointmentId: string;
  consultantName: string;
  unread?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg px-3 py-1.5 font-semibold transition-colors"
      >
        <span>💬</span>
        <span>تحدث معي</span>
        {unread > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <SessionChatModal
          anonUserId={anonUserId}
          appointmentId={appointmentId}
          consultantName={consultantName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SessionChatModal({
  anonUserId, appointmentId, consultantName, onClose,
}: {
  anonUserId: string;
  appointmentId: string;
  consultantName: string;
  onClose: () => void;
}) {
  const { data, refetch } = trpc.chat.myMessages.useQuery(
    { anonUserId, appointmentId },
    { refetchInterval: 4000 },
  );
  const [text, setText] = useState("");
  const send = trpc.chat.sendAsClient.useMutation({
    onSuccess: () => { setText(""); refetch(); },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data?.messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    send.mutate({ anonUserId, appointmentId, content: text.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-start sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white w-full sm:max-w-md h-[80vh] sm:h-[600px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 bg-gradient-to-l from-indigo-600 to-purple-600 text-white flex items-center justify-between">
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-lg">✕</button>
          <div className="text-right">
            <p className="text-[10px] text-indigo-100">جلسة مع</p>
            <p className="text-sm font-bold">{consultantName}</p>
          </div>
        </div>

        {/* Context bar */}
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-1.5">
          <span className="text-indigo-500">💬</span>
          <p className="text-xs text-indigo-700 font-medium">محادثتك مع الإدارة بخصوص هذه الجلسة</p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/40">
          {!data?.messages.length ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 text-center px-6">
              مرحباً! يمكنك التواصل مع الإدارة بخصوص هذه الجلسة — سيتم الرد عليك في أقرب وقت.
            </div>
          ) : data.messages.map((m) => {
            const isClient = m.sender === "CLIENT";
            return (
              <div key={m.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isClient
                    ? "bg-indigo-600 text-white rounded-bl-sm"
                    : "bg-white border border-gray-100 text-gray-800 rounded-br-sm"
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${isClient ? "text-indigo-100" : "text-gray-400"}`}>
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <form onSubmit={submit} className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
          <button type="submit"
            disabled={!text.trim() || send.isPending}
            className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-40">
            {send.isPending ? "..." : "إرسال"}
          </button>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب رسالتك..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 text-right"
          />
        </form>
      </div>
    </div>
  );
}
