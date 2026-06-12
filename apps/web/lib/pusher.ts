"use client";

import Pusher from "pusher-js";

let cached: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;

  const key     = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) {
    console.warn("[pusher] NEXT_PUBLIC_PUSHER_KEY/CLUSTER missing — realtime disabled");
    return null;
  }

  cached = new Pusher(key, { cluster, forceTLS: true });
  return cached;
}
