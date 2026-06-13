"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAuthStore } from "@/lib/stores/authStore";

const REFRESH_INTERVAL_MS = 13 * 60 * 1000;   // 13 min (token expires at 15)
const COOKIE_MAX_AGE_S    = 20 * 24 * 60 * 60; // 20 days — match refresh-token lifetime

/**
 * Silently refreshes the access token in the background so the user stays
 * logged in for as long as the refresh token is valid (7 days).
 *
 * - Refreshes on mount (covers the case where the user returns after the
 *   cookie expired but the refresh token is still good).
 * - Re-refreshes every 13 minutes.
 * - Updates: authStore.accessToken, localStorage "misahuh_auth", and the
 *   "misahuh_access_token" cookie that the middleware reads.
 */
export function useTokenRefresh() {
  const { refreshToken, setAuth, user, clearAuth } = useAuthStore();
  const refreshMutation = trpc.auth.refresh.useMutation();
  const inflight = useRef(false);

  useEffect(() => {
    if (!refreshToken || !user) return;

    async function doRefresh() {
      if (inflight.current) return;
      inflight.current = true;
      try {
        const data = await refreshMutation.mutateAsync({ refreshToken: refreshToken! });
        // Update store (rotated refresh token + new access)
        setAuth(user!, data.accessToken, data.refreshToken);

        // Update localStorage state so the tRPC link picks it up
        const stored = localStorage.getItem("misahuh_auth");
        const parsed = stored ? JSON.parse(stored) : { state: {} };
        parsed.state = { ...parsed.state, accessToken: data.accessToken, refreshToken: data.refreshToken };
        localStorage.setItem("misahuh_auth", JSON.stringify(parsed));

        // Renew the cookie that middleware checks
        document.cookie = `misahuh_access_token=${data.accessToken}; path=/; max-age=${COOKIE_MAX_AGE_S}; SameSite=Strict`;
      } catch {
        // Refresh failed (token revoked/expired) — drop session
        clearAuth();
        document.cookie = "misahuh_access_token=; path=/; max-age=0";
      } finally {
        inflight.current = false;
      }
    }

    doRefresh();
    const id = setInterval(doRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, user?.id]);
}
