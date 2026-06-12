"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

function formatRelative(d: string | Date) {
  const ms  = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)    return "الآن";
  if (min < 60)   return `قبل ${min} د`;
  const h = Math.floor(min / 60);
  if (h   < 24)   return `قبل ${h} س`;
  const days = Math.floor(h / 24);
  if (days < 7)   return `قبل ${days} يوم`;
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}`;
}
function formatTime(d: string | Date) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}
function formatSessionDate(d: string | Date) {
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()} - ${formatTime(d)}`;
}

export default function AdminChatPage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("conversation");
  const { data: conversations, refetch } = trpc.chat.adminList.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedId && conversations && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  return (
    <div dir="rtl" className="flex h-[calc(100vh-8rem)] gap-4">

      {/* ── Conversations sidebar ── */}
      <div className="w-96 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 text-sm">المحادثات</h2>
          <span className="text-xs text-gray-400">{conversations?.length ?? 0}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!conversations?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد محادثات</p>
          ) : conversations.map((c) => {
            const last = c.messages[0];
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-right px-4 py-3 border-b border-gray-50 transition-colors ${
                  isSelected ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400">{formatRelative(c.lastMessageAt)}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {c.unreadByAdmin > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {c.unreadByAdmin}
                      </span>
                    )}
                    <span className="font-bold text-gray-900 text-sm truncate">{c.anonUser.nickname}</span>
                  </div>
                </div>
                {/* Session context */}
                <p className="text-[10px] text-purple-600 mb-1 truncate">
                  جلسة مع <strong>{c.appointment.consultant.user.name}</strong> · {formatSessionDate(c.appointment.scheduledAt)}
                </p>
                {last && (
                  <p className={`text-xs truncate text-right ${c.unreadByAdmin > 0 ? "text-gray-800 font-semibold" : "text-gray-500"}`}>
                    {last.sender === "ADMIN" && <span className="text-indigo-400">أنت: </span>}
                    {last.content}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat view ── */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
        {selectedId ? (
          <ChatView conversationId={selectedId} onUpdate={() => refetch()} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            اختر محادثة من القائمة
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({ conversationId, onUpdate }: { conversationId: string; onUpdate: () => void }) {
  const { data: convo, refetch } = trpc.chat.adminGetConversation.useQuery(
    { conversationId },
    { refetchInterval: 4000 },
  );
  const [text, setText] = useState("");
  const send = trpc.chat.sendAsAdmin.useMutation({
    onSuccess: () => { setText(""); refetch(); onUpdate(); },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convo?.messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    send.mutate({ conversationId, content: text.trim() });
  }

  if (!convo) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">جاري التحميل...</div>;

  return (
    <>
      {/* Header — client + session context */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">{convo.messages.length} رسالة</span>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-bold text-gray-900 text-sm">{convo.anonUser.nickname}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">
              جلسة مع <strong>{convo.appointment.consultant.user.name}</strong>
            </p>
            <p className="text-[10px] text-gray-400">{formatSessionDate(convo.appointment.scheduledAt)}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-600">
            {convo.anonUser.nickname[0]}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/40">
        {convo.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            ابدأ المحادثة بكتابة رسالة
          </div>
        ) : convo.messages.map((m) => {
          const isAdmin = m.sender === "ADMIN";
          return (
            <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                isAdmin
                  ? "bg-indigo-600 text-white rounded-bl-sm"
                  : "bg-white border border-gray-100 text-gray-800 rounded-br-sm"
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`text-[10px] mt-1 ${isAdmin ? "text-indigo-100" : "text-gray-400"}`}>
                  {formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-40"
        >
          {send.isPending ? "..." : "إرسال"}
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 text-right"
        />
      </form>
    </>
  );
}
