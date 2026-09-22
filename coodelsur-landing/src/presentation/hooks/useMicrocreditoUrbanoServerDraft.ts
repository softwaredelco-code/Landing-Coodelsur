"use client";

/**
 * Sincronización de borradores Microcrédito urbano con `POST /api/leads/draft`.
 */

import { deserializeUtm } from "@/presentation/tracking/utm";
import { getUtmFromCookie } from "@/presentation/tracking/TrackingProvider";
import { stripHeavyFieldsForDraft } from "@/domain/lead/form-progress";
import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";
import { useEffect, useRef } from "react";
import type { UseFormGetValues, UseFormWatch } from "react-hook-form";

const SERVER_DRAFT_KEY = "coodelsur_server_draft_id_urbano";
const SAVE_DEBOUNCE_MS = 3000;

let draftSyncQueue: Promise<void> = Promise.resolve();
/** Evita que syncs en cola creen un borrador nuevo después del envío final. */
let draftSyncAllowed = true;

function enqueueDraftSync(task: () => Promise<void>): Promise<void> {
  draftSyncQueue = draftSyncQueue.then(task).catch(() => undefined);
  return draftSyncQueue;
}

interface UseMicrocreditoUrbanoServerDraftOptions {
  watch: UseFormWatch<MicrocreditoUrbanoFormValues>;
  getValues: UseFormGetValues<MicrocreditoUrbanoFormValues>;
  step: number;
  enabled: boolean;
}

function readServerDraftId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SERVER_DRAFT_KEY);
}

function writeServerDraftId(id: string) {
  if (typeof window === "undefined") return;
  if (!draftSyncAllowed) return;
  sessionStorage.setItem(SERVER_DRAFT_KEY, id);
}

export function clearMicrocreditoUrbanoServerDraftId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SERVER_DRAFT_KEY);
}

export function restoreMicrocreditoUrbanoServerDraftId(id: string) {
  if (typeof window === "undefined" || !id) return;
  draftSyncAllowed = true;
  sessionStorage.setItem(SERVER_DRAFT_KEY, id);
}

/** Detiene syncs pendientes/en cola (llamar al iniciar el envío final). */
export function stopMicrocreditoUrbanoServerDraftSync() {
  draftSyncAllowed = false;
  clearMicrocreditoUrbanoServerDraftId();
}

/** Reactiva syncs (p. ej. al iniciar una nueva solicitud). */
export function resumeMicrocreditoUrbanoServerDraftSync() {
  draftSyncAllowed = true;
}

export async function syncMicrocreditoUrbanoDraftToServer(
  step: number,
  getValues: UseFormGetValues<MicrocreditoUrbanoFormValues>,
) {
  return enqueueDraftSync(async () => {
    if (!draftSyncAllowed) return;

    const draftId = readServerDraftId() ?? undefined;
    const utm = deserializeUtm(getUtmFromCookie() ?? undefined) ?? undefined;
    const values = stripHeavyFieldsForDraft(
      getValues() as unknown as Record<string, unknown>,
    );

    const response = await fetch("/api/leads/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        step,
        values,
        utm,
      }),
      keepalive: true,
    });

    if (!draftSyncAllowed || !response.ok) return;

    const data = (await response.json().catch(() => null)) as {
      saved?: boolean;
      draftId?: string;
    } | null;

    if (data?.saved && data.draftId) {
      writeServerDraftId(data.draftId);
    }
  });
}

export function useMicrocreditoUrbanoServerDraft({
  watch,
  getValues,
  step,
  enabled,
}: UseMicrocreditoUrbanoServerDraftOptions) {
  const hydratedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;

  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (enabled) {
      resumeMicrocreditoUrbanoServerDraftSync();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    void syncMicrocreditoUrbanoDraftToServer(step, getValuesRef.current);
  }, [enabled, step]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;

    const schedule = () => {
      if (!draftSyncAllowed) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void syncMicrocreditoUrbanoDraftToServer(step, getValuesRef.current);
      }, SAVE_DEBOUNCE_MS);
    };

    const subscription = watch(() => {
      schedule();
    });

    const flush = () => {
      if (!draftSyncAllowed) return;
      void syncMicrocreditoUrbanoDraftToServer(step, getValuesRef.current);
    };

    window.addEventListener("pagehide", flush);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, step, watch]);
}

export function getMicrocreditoUrbanoServerDraftId(): string | null {
  return readServerDraftId();
}
