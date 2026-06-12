"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useRealtimeNotifications } from "@/lib/hooks/useRealtimeNotifications";

type Props = {
  userId?: string | null;
  anonUserId?: string | null;
};

export function NotificationBell({ userId, anonUserId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const isAuthed = !!userId;

  const authedList = trpc.notification.list.useQuery(
    { page: 1, limit: 10 },
    { enabled: isAuthed },
  );
  const anonList = trpc.notification.listAnon.useQuery(
    { anonUserId: anonUserId ?? "", take: 10 },
    { enabled: !isAuthed && !!anonUserId },
  );

  const authedUnread = trpc.notification.unreadCount.useQuery(undefined, { enabled: isAuthed });
  const anonUnread   = trpc.notification.unreadCountAnon.useQuery(
    { anonUserId: anonUserId ?? "" },
    { enabled: !isAuthed && !!anonUserId },
  );

  const unread = isAuthed ? (authedUnread.data ?? 0) : (anonUnread.data ?? 0);
  const items  = isAuthed ? (authedList.data?.data ?? []) : (anonList.data ?? []);

  const utils = trpc.useUtils();
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      if (isAuthed) {
        utils.notification.list.invalidate();
        utils.notification.unreadCount.invalidate();
      } else {
        utils.notification.listAnon.invalidate();
        utils.notification.unreadCountAnon.invalidate();
      }
    },
  });
  const markAllAuthed = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const markAllAnon = trpc.notification.markAllReadAnon.useMutation({
    onSuccess: () => {
      utils.notification.listAnon.invalidate();
      utils.notification.unreadCountAnon.invalidate();
    },
  });

  useRealtimeNotifications({ userId, anonUserId });

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleClick(n: { id: string; link?: string | null; isRead?: boolean }) {
    if (!n.isRead) markRead.mutate({ id: n.id });
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  function handleMarkAll() {
    if (isAuthed) markAllAuthed.mutate();
    else if (anonUserId) markAllAnon.mutate({ anonUserId });
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        aria-label="الإشعارات"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50" dir="rtl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">الإشعارات</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">لا توجد إشعارات</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-right px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !n.isRead ? "bg-indigo-50/40" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.body}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
