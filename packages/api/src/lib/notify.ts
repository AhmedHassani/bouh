/**
 * Notification helper.
 * Saves a notification in the DB and (optionally) dispatches it via Firebase Cloud Messaging.
 *
 * FCM setup:
 *   - Add env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   - The actual FCM dispatch is gated behind getFcmCreds() — if creds are missing
 *     the notification is stored in DB only, no error thrown.
 */

import { db } from "@repo/db";
import type { NotificationType } from "@repo/db";
import { broadcast } from "./pusher";

type NotifyOptions = {
  type:  NotificationType;
  title: string;
  body:  string;
  data?: Record<string, unknown>;
  link?: string;
} & ({ userId: string } | { anonUserId: string } | { userIds: string[] } | { anonUserIds: string[] });

function getFcmCreds() {
  const projectId  = process.env.FIREBASE_PROJECT_ID;
  const email      = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !email || !privateKey) return null;
  return { projectId, email, privateKey };
}

/**
 * Send a notification.
 * Stores in DB always. Sends FCM push if creds + tokens available.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  // Build recipient list
  const userIds:     string[] = "userId"      in opts ? [opts.userId]
                              : "userIds"     in opts ? opts.userIds : [];
  const anonUserIds: string[] = "anonUserId"  in opts ? [opts.anonUserId]
                              : "anonUserIds" in opts ? opts.anonUserIds : [];

  // 1. Persist DB rows
  const rows: Array<Record<string, unknown>> = [];
  for (const id of userIds)     rows.push({ userId: id,      type: opts.type, title: opts.title, body: opts.body, data: opts.data ?? null, link: opts.link });
  for (const id of anonUserIds) rows.push({ anonUserId: id,  type: opts.type, title: opts.title, body: opts.body, data: opts.data ?? null, link: opts.link });

  if (rows.length === 0) return;

  const created = await db.notification.createManyAndReturn({
    data: rows as never,
    select: {
      id: true, userId: true, anonUserId: true,
      type: true, title: true, body: true, link: true, data: true,
      isRead: true, createdAt: true,
    },
  });

  // 2. Realtime broadcast via Pusher (one event per recipient)
  await Promise.all(
    created.map((n) => {
      const channel = n.userId
        ? `user-${n.userId}`
        : n.anonUserId
          ? `anon-user-${n.anonUserId}`
          : null;
      if (!channel) return Promise.resolve();
      return broadcast(channel, "new-notification", n);
    }),
  );

  // 3. Try FCM dispatch
  const creds = getFcmCreds();
  if (!creds) return;

  try {
    const tokens = await db.fcmToken.findMany({
      where: {
        OR: [
          { userId:     { in: userIds.length     ? userIds     : [""] } },
          { anonUserId: { in: anonUserIds.length ? anonUserIds : [""] } },
        ],
      },
      select: { token: true, id: true },
    });
    if (tokens.length === 0) return;

    await sendFcm(creds, tokens.map((t) => t.token), {
      title: opts.title,
      body:  opts.body,
      data: {
        ...(opts.data ?? {}),
        link: opts.link ?? "",
        type: opts.type,
      },
    });

    // Mark notifications as sent
    await db.notification.updateMany({
      where: { id: { in: created.map((c) => c.id) } },
      data:  { sentViaFcm: true },
    });
  } catch (err) {
    console.error("[notify] FCM dispatch failed:", err);
  }
}

// ── FCM HTTP v1 dispatch ──
async function sendFcm(
  creds:   { projectId: string; email: string; privateKey: string },
  tokens:  string[],
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  // Get an OAuth2 access token via JWT
  const jwt = await import("jsonwebtoken");
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.default.sign(
    {
      iss:   creds.email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud:   "https://oauth2.googleapis.com/token",
      iat:   now,
      exp:   now + 3600,
    },
    creds.privateKey,
    { algorithm: "RS256" },
  );

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const tokenJson = await tokenRes.json() as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("FCM auth failed");
  }

  const url = `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`;
  for (const token of tokens) {
    await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${tokenJson.access_token}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data:         Object.fromEntries(
            Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v)]),
          ),
        },
      }),
    });
  }
}
