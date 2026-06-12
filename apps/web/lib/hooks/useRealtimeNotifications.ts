"use client";

import { useEffect } from "react";
import { getPusherClient } from "@/lib/pusher";
import { trpc } from "@/lib/trpc/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  data?: unknown;
};

type Options = {
  /** Logged-in user id (db id). Used to subscribe to `user-<id>`. */
  userId?: string | null;
  /** Anonymous user id. Used to subscribe to `anon-user-<id>`. */
  anonUserId?: string | null;
  /** Optional callback when a notification arrives — for toasts. */
  onNotification?: (n: Notification) => void;
};

/**
 * Subscribes the current user to their realtime notification channel
 * and invalidates the notification queries on each event.
 *
 * Also listens for CHAT_MESSAGE notifications and invalidates chat queries.
 */
export function useRealtimeNotifications({ userId, anonUserId, onNotification }: Options) {
  const utils = trpc.useUtils();

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = userId
      ? `user-${userId}`
      : anonUserId
        ? `anon-user-${anonUserId}`
        : null;
    if (!channelName) return;

    const channel = pusher.subscribe(channelName);

    const handler = (n: Notification) => {
      // Invalidate listing + unread badge
      if (userId) {
        utils.notification.list.invalidate();
        utils.notification.unreadCount.invalidate();
      } else if (anonUserId) {
        utils.notification.listAnon.invalidate();
        utils.notification.unreadCountAnon.invalidate();
      }

      // Chat-specific cache invalidation
      if (n.type === "CHAT_MESSAGE") {
        utils.chat.adminTotalUnread.invalidate();
        utils.chat.adminList.invalidate();
        utils.chat.myConversations.invalidate();
      }

      onNotification?.(n);
    };

    channel.bind("new-notification", handler);

    return () => {
      channel.unbind("new-notification", handler);
      pusher.unsubscribe(channelName);
    };
  }, [userId, anonUserId, onNotification, utils]);
}
