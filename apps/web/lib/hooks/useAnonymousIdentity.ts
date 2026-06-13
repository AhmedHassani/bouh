"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";

const STORAGE_KEY = "misahuh_anon";

interface AnonIdentity {
  deviceId: string;
  nickname: string;
  anonUserId: string | null;
  assessmentCompleted: boolean;
  assessmentResultId: string | null;
}

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("misahuh_device_id");
  if (!id) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      id = crypto.randomUUID();
    } else {
      // Fallback pseudo-random UUID generator for non-secure HTTP contexts
      id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    localStorage.setItem("misahuh_device_id", id);
  }
  return id;
}

function loadIdentity(): AnonIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnonIdentity;
  } catch {
    return null;
  }
}

function saveIdentity(identity: AnonIdentity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function useAnonymousIdentity() {
  const [identity, setIdentity] = useState<AnonIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = loadIdentity();
    if (stored) setIdentity(stored);
    setIsLoading(false);
  }, []);

  const getOrCreate = trpc.anonymous.getOrCreate.useMutation();

  const initIdentity = useCallback(
    async (nickname: string): Promise<AnonIdentity> => {
      const deviceId = getOrCreateDeviceId();

      // Check existing with same deviceId + nickname
      const existing = loadIdentity();
      if (existing && existing.deviceId === deviceId && existing.nickname === nickname && existing.anonUserId) {
        return existing;
      }

      const user = await getOrCreate.mutateAsync({ deviceId, nickname });
      const newIdentity: AnonIdentity = {
        deviceId,
        nickname,
        anonUserId: user.id,
        assessmentCompleted: false,
        assessmentResultId: null,
      };
      saveIdentity(newIdentity);
      setIdentity(newIdentity);
      return newIdentity;
    },
    [getOrCreate]
  );

  const markAssessmentCompleted = useCallback(
    (assessmentResultId: string) => {
      if (!identity) return;
      const updated = { ...identity, assessmentCompleted: true, assessmentResultId };
      saveIdentity(updated);
      setIdentity(updated);
    },
    [identity]
  );

  const clearIdentity = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIdentity(null);
  }, []);

  const clientLogin    = trpc.anonymous.clientLogin.useMutation();
  const clientRegister = trpc.anonymous.clientRegister.useMutation();

  const loginWithPhone = useCallback(
    async (name: string, phone: string, password: string): Promise<AnonIdentity> => {
      const deviceId = getOrCreateDeviceId();
      const user = await clientLogin.mutateAsync({ name, phone, password, deviceId });
      const newIdentity: AnonIdentity = {
        deviceId, nickname: user.nickname, anonUserId: user.id,
        assessmentCompleted: false, assessmentResultId: null,
      };
      saveIdentity(newIdentity);
      setIdentity(newIdentity);
      return newIdentity;
    },
    [clientLogin],
  );

  const registerWithPhone = useCallback(
    async (name: string, phone: string, password: string): Promise<AnonIdentity> => {
      const deviceId = getOrCreateDeviceId();
      const user = await clientRegister.mutateAsync({ name, phone, password, deviceId });
      const newIdentity: AnonIdentity = {
        deviceId, nickname: user.nickname, anonUserId: user.id,
        assessmentCompleted: false, assessmentResultId: null,
      };
      saveIdentity(newIdentity);
      setIdentity(newIdentity);
      return newIdentity;
    },
    [clientRegister],
  );

  return {
    identity,
    isLoading,
    initIdentity,
    markAssessmentCompleted,
    clearIdentity,
    loginWithPhone,
    registerWithPhone,
    deviceId: typeof window !== "undefined" ? getOrCreateDeviceId() : "",
  };
}
