"use client";

/**
 * Sincronización de borradores con el servidor (`POST /api/leads/draft`).
 *
 * - Debounce de 2 s mientras el usuario escribe
 * - Guardado inmediato al cambiar de paso o cerrar/ocultar la pestaña
 * - Cola serializada para evitar race conditions y duplicados en BD
 *
 * El id del borrador se guarda en `sessionStorage` (`coodelsur_server_draft_id`).
 */

import { deserializeUtm } from "@/presentation/tracking/utm";
import { getUtmFromCookie } from "@/presentation/tracking/TrackingProvider";
import { stripHeavyFieldsForDraft } from "@/domain/lead/form-progress";
import type { NanocreditoFormValues } from "@/shared/validation/nanocredito";
import { useEffect, useRef } from "react";
import type { UseFormGetValues, UseFormWatch } from "react-hook-form";

const SERVER_DRAFT_KEY = "coodelsur_server_draft_id";
const SAVE_DEBOUNCE_MS = 3000;

let draftSyncQueue: Promise<void> = Promise.resolve();

function enqueueDraftSync(task: () => Promise<void>): Promise<void> {
  draftSyncQueue = draftSyncQueue.then(task).catch(() => undefined);
  return draftSyncQueue;
}

interface UseNanocreditoServerDraftOptions {
  watch: UseFormWatch<NanocreditoFormValues>;
  getValues: UseFormGetValues<NanocreditoFormValues>;
  step: number;
  enabled: boolean;
}

function readServerDraftId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SERVER_DRAFT_KEY);
}

function writeServerDraftId(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SERVER_DRAFT_KEY, id);
}

export function clearNanocreditoServerDraftId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SERVER_DRAFT_KEY);
}

/** Guarda el borrador en el servidor (usado al avanzar paso y al cerrar la pestaña). */
export async function syncNanocreditoDraftToServer(
  step: number,
  getValues: UseFormGetValues<NanocreditoFormValues>,
) {
  return enqueueDraftSync(async () => {
    const utm = deserializeUtm(getUtmFromCookie() ?? undefined) ?? undefined;
    const values = stripHeavyFieldsForDraft(
      getValues() as unknown as Record<string, unknown>,
    );

    const response = await fetch("/api/leads/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId: readServerDraftId() ?? undefined,
        step,
        values,
        utm,
      }),
      keepalive: true,
    });

    if (!response.ok) return;

    const data = (await response.json().catch(() => null)) as {
      saved?: boolean;
      draftId?: string;
    } | null;

    if (data?.saved && data.draftId) {
      writeServerDraftId(data.draftId);
    }
  });
}

export function useNanocreditoServerDraft({
  watch,
  getValues,
  step,
  enabled,
}: UseNanocreditoServerDraftOptions) {
  const hydratedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;

  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  // Al cambiar de paso (incl. borrador restaurado desde localStorage), guardar de inmediato.
  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;
    void syncNanocreditoDraftToServer(step, getValuesRef.current);
  }, [enabled, step]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void syncNanocreditoDraftToServer(step, getValuesRef.current);
      }, SAVE_DEBOUNCE_MS);
    };

    const subscription = watch(() => {
      schedule();
    });

    const flush = () => {
      void syncNanocreditoDraftToServer(step, getValuesRef.current);
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.removeEventListener("pagehide", flush);
    };
  }, [enabled, step, watch]);
}

export function getNanocreditoServerDraftId(): string | null {
  return readServerDraftId();
}
