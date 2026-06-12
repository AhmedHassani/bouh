/**
 * Pusher server SDK — broadcasts realtime events.
 * If env vars are missing, becomes a no-op (no errors).
 */

import PusherSDK from "pusher";

let cached: PusherSDK | null = null;

function getPusher(): PusherSDK | null {
  if (cached) return cached;
  const appId   = process.env.PUSHER_APP_ID;
  const key     = process.env.PUSHER_KEY;
  const secret  = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) return null;

  cached = new PusherSDK({
    appId, key, secret, cluster,
    useTLS: true,
  });
  return cached;
}

/**
 * Broadcast an event to a channel.
 * Channel naming convention:
 *   - conversation-<id>           — chat messages for a specific conversation
 *   - admin-notifications         — broadcast to all admins
 *   - anon-user-<id>              — broadcast to a specific anonymous user
 *   - user-<id>                   — broadcast to a specific logged-in user
 */
export async function broadcast(
  channel: string,
  event:   string,
  data:    unknown,
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger(channel, event, data);
  } catch (err) {
    console.error("[pusher] broadcast failed:", err);
  }
}
