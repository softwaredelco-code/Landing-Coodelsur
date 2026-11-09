"use client";

import {
  analyzeVector,
  CruceItemResult,
  CruceKPIs,
  CruceLogEvent,
  CruceStreamMessage,
  formatMoney,
} from "@/domain/datacredito/types";
import { Button } from "@/presentation/components/ui/Button";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getTimestampedFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `cruce-datacredito-coodelsur-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.xlsx`;
}

export interface LeadSummaryItem {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  capitalSolicitado?: number | null;
  tipoCredito?: string;
  estado?: string;
}

interface DataCreditoCruceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds?: string[];
  selectedAllInScope?: boolean;
  appliedFilters?: {
    q?: string;
    estado?: string;
    origen?: string;
    mes?: string;
  };
  availableLeads?: LeadSummaryItem[];
}

type TabFiltro = "todos" | "coincidencias" | "sin_reporte" | "no_en_formulario";

export function DataCreditoCruceModal({
  isOpen,
  onClose,
  selectedLeadIds = [],
  selectedAllInScope = false,
  appliedFilters,
  availableLeads = [],
}: DataCreditoCruceModalProps) {
  // Modo de origen de solicitudes: 'coodelsur' (solicitudes del sistema) o 'excel' (archivo externo)
  const [sourceMode, setSourceMode] = useState<"coodelsur" | "excel">("coodelsur");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [remoteSearchResults, setRemoteSearchResults] = useState<LeadSummaryItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  // Estado de archivos
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);

  // Configuración opcional
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  // Estados del proceso
  const [step, setStep] = useState<"upload" | "processing" | "results">("upload");
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentFileMsg, setCurrentFileMsg] = useState("");
  const [logs, setLogs] = useState<CruceLogEvent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resultados
  const [kpis, setKpis] = useState<CruceKPIs | null>(null);
  const [records, setRecords] = useState<CruceItemResult[]>([]);
  const [excelBase64, setExcelBase64] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState("");

  // Filtros en la vista de resultados
  const [activeTab, setActiveTab] = useState<TabFiltro>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<CruceItemResult | null>(null);

  // Referencias para auto-scroll de la consola
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Cache de datos de personas seleccionadas (persiste siempre y nunca borra personas)
  const [selectedPersonsCache, setSelectedPersonsCache] = useState<Record<string, LeadSummaryItem>>({});
  const wasOpenRef = useRef(false);

  // Búsqueda en vivo en TODAS las solicitudes del sistema (nombre, cédula, teléfono o email)
  useEffect(() => {
    const query = personSearchQuery.trim();
    if (!query || query.length < 2) {
      setRemoteSearchResults([]);
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/leads?q=${encodeURIComponent(query)}&take=15`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { leads?: LeadSummaryItem[] };
        const fetched = Array.isArray(data.leads) ? data.leads : [];
        setRemoteSearchResults(fetched);
      } catch (err) {
        console.warn("[DataCreditoCruceModal] Error buscando solicitudes remotas:", err);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [personSearchQuery]);

  // Sincronizar selección de personas al abrir el modal fusionando sin sobreescribir personas agregadas
  useEffect(() => {
    if (isOpen) {
      const initialIds = selectedLeadIds ?? [];
      setSelectedPersonIds((prev) => Array.from(new Set([...prev, ...initialIds])));
      setSelectedPersonsCache((prev) => {
        const next = { ...prev };
        for (const lead of availableLeads ?? []) {
          if (lead?.id) next[lead.id] = lead;
        }
        return next;
      });
      if (!wasOpenRef.current) {
        setSourceMode("coodelsur");
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, selectedLeadIds, availableLeads]);

  // Asegurar que cualquier persona seleccionada tenga sus datos cargados en cache
  useEffect(() => {
    const missingIds = selectedPersonIds.filter((id) => !selectedPersonsCache[id]);
    if (missingIds.length === 0) return;

    // Buscar primero en availableLeads
    const foundNow: Record<string, LeadSummaryItem> = {};
    const stillMissing: string[] = [];
    for (const id of missingIds) {
      const found = availableLeads?.find((l) => l.id === id);
      if (found) foundNow[id] = found;
      else stillMissing.push(id);
    }
    if (Object.keys(foundNow).length > 0) {
      setSelectedPersonsCache((prev) => ({ ...prev, ...foundNow }));
    }

    if (stillMissing.length > 0) {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/leads?ids=${encodeURIComponent(stillMissing.join(","))}`);
          if (res.ok) {
            const data = (await res.json()) as { leads?: LeadSummaryItem[] };
            if (Array.isArray(data.leads)) {
              const map: Record<string, LeadSummaryItem> = {};
              for (const l of data.leads) map[l.id] = l;
              setSelectedPersonsCache((prev) => ({ ...prev, ...map }));
            }
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [selectedPersonIds, availableLeads, selectedPersonsCache]);

  const addPerson = (lead: LeadSummaryItem) => {
    setSelectedPersonIds((prev) => (prev.includes(lead.id) ? prev : [...prev, lead.id]));
    setSelectedPersonsCache((prev) => ({ ...prev, [lead.id]: lead }));
    setPersonSearchQuery("");
    setRemoteSearchResults([]);
  };

  // Lista de personas seleccionadas para visualización (nunca se borran)
  const selectedPersonsList = useMemo(() => {
    return selectedPersonIds.map((id) => {
      return (
        selectedPersonsCache[id] ??
        availableLeads?.find((l) => l.id === id) ?? {
          id,
          nombre: `Solicitud #${id.slice(-6)}`,
          cedula: "Registrada",
          telefono: "",
        }
      );
    });
  }, [availableLeads, selectedPersonIds, selectedPersonsCache]);

  // Búsqueda interactiva de personas que busca en TODAS las solicitudes del sistema
  const searchResults = useMemo(() => {
    const query = personSearchQuery.toLowerCase().trim();
    if (!query) return [];

    const map = new Map<string, LeadSummaryItem>();

    // 1. Coincidencias en availableLeads y cache local (instantáneas)
    for (const lead of availableLeads ?? []) {
      if (
        !selectedPersonIds.includes(lead.id) &&
        (lead.nombre.toLowerCase().includes(query) ||
          lead.cedula.includes(query) ||
          (lead.telefono && lead.telefono.includes(query)))
      ) {
        map.set(lead.id, lead);
      }
    }
    for (const lead of Object.values(selectedPersonsCache)) {
      if (
        lead &&
        !selectedPersonIds.includes(lead.id) &&
        (lead.nombre.toLowerCase().includes(query) ||
          lead.cedula.includes(query) ||
          (lead.telefono && lead.telefono.includes(query)))
      ) {
        map.set(lead.id, lead);
      }
    }

    // 2. Coincidencias remotas globales de la base de datos (todas las solicitudes)
    for (const lead of remoteSearchResults) {
      if (lead && !selectedPersonIds.includes(lead.id)) {
        map.set(lead.id, lead);
      }
    }

    return Array.from(map.values()).slice(0, 8);
  }, [personSearchQuery, availableLeads, selectedPersonsCache, remoteSearchResults, selectedPersonIds]);

  // Cargar clave guardada en localStorage si existe
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("coodel_openai_key") || "";
      if (savedKey) setOpenaiApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setOpenaiApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("coodel_openai_key", key.trim());
    }
  };

  // Auto-scroll del log terminal
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Limpiar estados al cerrar o resetear
  const handleReset = useCallback(() => {
    setStep("upload");
    setExcelFile(null);
    setPdfFiles([]);
    setSelectedPersonIds(selectedLeadIds ?? []);
    setPersonSearchQuery("");
    setProgressPercent(0);
    setCurrentFileMsg("");
    setLogs([]);
    setErrorMsg(null);
    setKpis(null);
    setRecords([]);
    setExcelBase64(null);
    setActiveTab("todos");
    setSearchQuery("");
    setSelectedRecordForDetail(null);
  }, [selectedLeadIds]);

  // Manejo de drag & drop para Excel
  const handleExcelDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setExcelFile(file);
      }
    }
  };

  // Manejo de drag & drop para PDFs
  const handlePdfDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".pdf"),
      );
      if (newFiles.length > 0) {
        setPdfFiles((prev) => [...prev, ...newFiles]);
      }
    }
  };

  // Descargar el archivo Excel generado
  const handleDownloadExcel = () => {
    if (!excelBase64) return;
    try {
      const binaryStr = atob(excelBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Asegurar que el nombre de archivo siempre lleve fecha y hora
      const filename = downloadFilename && downloadFilename.includes("_")
        ? downloadFilename
        : getTimestampedFilename();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error("Error al descargar Excel:", err);
    }
  };

  // Ejecución del cruce con Server-Sent Events (SSE)
  const handleStartCruce = async () => {
    if (sourceMode === "excel" && !excelFile) {
      setErrorMsg("Debe seleccionar un archivo Excel de solicitudes (.xlsx o .xls).");
      return;
    }
    if (pdfFiles.length === 0) {
      setErrorMsg("Debe seleccionar al menos un archivo PDF de DataCrédito.");
      return;
    }

    setStep("processing");
    setProgressPercent(5);
    setLogs([]);
    setErrorMsg(null);

    const formData = new FormData();
    if (sourceMode === "excel" && excelFile) {
      formData.append("excel", excelFile);
    } else {
      if (selectedPersonIds.length > 0) {
        formData.append("leadIds", selectedPersonIds.join(","));
      } else {
        formData.append("allLeads", "true");
      }
    }

    for (const pdf of pdfFiles) {
      formData.append("pdfs", pdf);
    }
    if (openaiApiKey.trim()) {
      formData.append("apiKey", openaiApiKey.trim());
    }
    if (pdfPassword.trim()) {
      formData.append("pdfPassword", pdfPassword.trim());
    }
    formData.append("stream", "true");

    const addLog = (message: string, type: CruceLogEvent["type"] = "info") => {
      const now = new Date().toLocaleTimeString("es-CO");
      setLogs((prev) => [...prev, { time: now, message, type }]);
    };

    if (sourceMode === "coodelsur") {
      const targetCount =
        selectedPersonIds.length > 0
          ? `${selectedPersonIds.length} persona(s) seleccionada(s)`
          : "todas las solicitudes registradas";
      addLog(
        `Iniciando cruce de ${pdfFiles.length} reporte(s) contra solicitudes de Coodelsur (${targetCount})...`,
        "info",
      );
    } else {
      addLog(`Iniciando envío de ${excelFile?.name} y ${pdfFiles.length} reporte(s)...`, "info");
    }

    try {
      const res = await fetch("/api/admin/datacredito/cruce", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error del servidor HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error("El servidor no retornó un canal de datos en vivo");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr) as CruceStreamMessage;

            if (data.type === "start") {
              setCurrentFileMsg(data.message || "Iniciando...");
              addLog(data.message || "Procesamiento iniciado", "info");
            } else if (data.type === "progress") {
              const current = data.current || 1;
              const total = data.total || 1;
              const pct = Math.round((current / (total + 1)) * 90);
              setProgressPercent(pct);
              setCurrentFileMsg(data.message || `Procesando archivo ${current} de ${total}`);
            } else if (data.type === "log") {
              const msg = data.message || "";
              const type = msg.startsWith("[OK]") ? "success" : msg.startsWith("[AVISO]") ? "warn" : "info";
              addLog(msg, type);
            } else if (data.type === "done") {
              doneReceived = true;
              setProgressPercent(100);
              setCurrentFileMsg("Cruce completado con éxito");
              addLog(data.message || "Proceso finalizado.", "success");
              if (data.kpis) setKpis(data.kpis);
              if (data.records) setRecords(data.records);
              if (data.excelBase64) setExcelBase64(data.excelBase64);
              if (data.downloadFilename) setDownloadFilename(data.downloadFilename);

              setTimeout(() => {
                setStep("results");
              }, 1200);
            } else if (data.type === "error") {
              throw new Error(data.error || "Ocurrió un error en el servidor");
            }
          } catch (jsonErr) {
            console.error("Error al parsear evento SSE:", jsonErr);
          }
        }
      }

      if (!doneReceived) {
        throw new Error("La conexión con el servidor finalizó antes de completar el cruce. Si el archivo es muy pesado, intenta procesarlo individualmente.");
      }
    } catch (err) {
      console.error("[DataCreditoCruceModal] Error:", err);
      const msg = err instanceof Error ? err.message : "Error durante el cruce de datos";
      setErrorMsg(msg);
      addLog(`Error fatal: ${msg}`, "error");
    }
  };

  // Filtrado de registros en la vista de resultados
  const filteredRecords = useMemo(() => {
    let list = records;

    // Filtro por pestaña
    if (activeTab === "coincidencias") {
      list = list.filter((r) => r.estadoCruce === "coincidencia");
    } else if (activeTab === "sin_reporte") {
      list = list.filter((r) => r.estadoCruce === "sin_reporte");
    } else if (activeTab === "no_en_formulario") {
      list = list.filter((r) => r.estadoCruce === "no_en_formulario");
    }

    // Buscador
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.cedula.toLowerCase().includes(q) ||
          r.nombre.toLowerCase().includes(q) ||
          String(r.puntaje).toLowerCase().includes(q) ||
          String(r.peorMora).toLowerCase().includes(q),
      );
    }

    return list;
  }, [records, activeTab, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-datacredito-title"
    >
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-gray-100">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coodel-primary/10 text-coodel-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 id="modal-datacredito-title" className="text-lg font-bold text-coodel-primary">
                Cruce de Solicitudes y DataCrédito con IA
              </h2>
              <p className="text-xs text-gray-500">
                Extracción automática y consolidación de reportes de buró crediticio en Excel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === "results" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                Nuevo Cruce
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Cerrar modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── VISTA 1: CARGA DE ARCHIVOS ─── */}
        {step === "upload" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
                <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold">Atención</p>
                  <p className="text-xs mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Selector de Origen de Solicitudes */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-coodel-primary/5 border border-coodel-primary/15">
              <div>
                <p className="text-xs font-bold text-coodel-primary uppercase tracking-wide">
                  Origen de las Solicitudes
                </p>
                <p className="text-[11px] text-gray-600">
                  {sourceMode === "coodelsur"
                    ? "Genera automáticamente el formato oficial con las solicitudes del sistema (sin necesidad de Excel)."
                    : "Carga tu propio archivo Excel (.xlsx o .xls) con las solicitudes a evaluar."}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setSourceMode("coodelsur")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    sourceMode === "coodelsur"
                      ? "bg-coodel-primary text-white shadow-xs font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Solicitudes Coodelsur
                  {selectedPersonIds.length > 0 && (
                    <span className="ml-1.5 inline-block bg-white/20 text-white rounded-full px-1.5 py-0.2 text-[10px]">
                      {selectedPersonIds.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("excel")}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    sourceMode === "excel"
                      ? "bg-coodel-primary text-white shadow-xs font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Subir Excel externo
                  {excelFile && <span className="ml-1 text-emerald-500 font-bold">✓</span>}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Opción 1: Solicitudes de Coodelsur */}
              {sourceMode === "coodelsur" ? (
                <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-xs text-left">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coodel-primary/10 text-coodel-primary">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">1. Solicitudes Seleccionadas</h3>
                          <p className="text-[11px] text-gray-500">
                            Formato oficial de 20 columnas Coodelsur
                          </p>
                        </div>
                      </div>
                      {selectedPersonIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPersonIds([])}
                          className="text-[11px] text-gray-400 hover:text-red-600 font-medium"
                        >
                          Deseleccionar
                        </button>
                      )}
                    </div>

                    {selectedPersonIds.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-900 font-medium">
                          <span>{selectedPersonIds.length} persona(s) seleccionada(s)</span>
                          <span className="font-mono font-bold text-emerald-800">Listo</span>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 rounded-lg p-2 bg-gray-50/60">
                          {selectedPersonsList.map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center justify-between rounded-md bg-white border border-gray-200 px-2.5 py-1.5 text-xs shadow-2xs"
                            >
                              <div className="truncate pr-2">
                                <p className="font-semibold text-gray-900 truncate">{person.nombre}</p>
                                <p className="text-[11px] text-gray-500 font-mono">
                                  C.C. {person.cedula} · Tel: {person.telefono}
                                  {person.capitalSolicitado ? ` · ${formatMoney(person.capitalSolicitado)}` : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedPersonIds((prev) => prev.filter((id) => id !== person.id))}
                                className="text-gray-400 hover:text-red-500 p-1 text-xs font-bold"
                                title="Quitar de este cruce"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-center my-1">
                        <p className="text-xs font-semibold text-gray-700">
                          Todas las solicitudes de Coodelsur
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Se cruzará automáticamente contra las solicitudes registradas que coincidan con los PDFs.
                        </p>
                      </div>
                    )}

                    <div className="mt-3 relative">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar en todas las solicitudes por nombre o cédula..."
                          value={personSearchQuery}
                          onChange={(e) => setPersonSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-8 py-1.5 text-xs focus:border-coodel-primary focus:outline-none"
                        />
                        <svg
                          className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {isSearchingRemote && (
                          <div className="absolute right-2.5 top-2.5">
                            <svg className="animate-spin h-3.5 w-3.5 text-coodel-primary" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          </div>
                        )}
                        {!isSearchingRemote && personSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setPersonSearchQuery("");
                              setRemoteSearchResults([]);
                            }}
                            className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {personSearchQuery.trim().length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden divide-y divide-gray-100 max-h-56 overflow-y-auto">
                          {searchResults.length > 0 ? (
                            searchResults.map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => addPerson(lead)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50/60 flex items-center justify-between transition-colors group"
                              >
                                <div className="truncate pr-2">
                                  <p className="font-semibold text-gray-800 group-hover:text-coodel-primary truncate">
                                    {lead.nombre}
                                  </p>
                                  <p className="text-[10px] text-gray-500 font-mono">
                                    C.C. {lead.cedula} · Tel: {lead.telefono}
                                    {lead.capitalSolicitado ? ` · ${formatMoney(lead.capitalSolicitado)}` : ""}
                                  </p>
                                </div>
                                <span className="text-[11px] font-bold text-coodel-primary shrink-0 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 group-hover:bg-coodel-primary group-hover:text-white transition-colors">
                                  + Agregar
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-center text-[11px] text-gray-500">
                              {isSearchingRemote ? (
                                <span className="inline-flex items-center gap-1.5 text-coodel-primary font-medium">
                                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                  Buscando en todas las solicitudes...
                                </span>
                              ) : (
                                <span>No se encontraron solicitudes registradas para &quot;{personSearchQuery}&quot;</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-gray-400">
                    Solo sube los PDFs en el panel derecho y haz clic en Iniciar Cruce.
                  </p>
                </div>
              ) : (
                /* Dropzone 1: Archivo Excel */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleExcelDrop}
                  className="flex flex-col justify-between rounded-xl border-2 border-dashed border-gray-200 hover:border-coodel-primary/40 p-5 bg-gray-50/50 transition-all text-center"
                >
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mx-auto mb-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">1. Archivo Excel de Solicitudes</h3>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      Arrastra aquí tu archivo .xlsx o selecciónalo de tu equipo
                    </p>

                    {excelFile ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-left">
                        <div className="truncate pr-2">
                          <p className="text-xs font-semibold text-emerald-900 truncate">{excelFile.name}</p>
                          <p className="text-[11px] text-emerald-700">{(excelFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExcelFile(null)}
                          className="text-xs font-bold text-red-600 hover:text-red-800 p-1"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer shadow-sm transition-colors mx-auto">
                        <span>Seleccionar Excel (.xlsx)</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setExcelFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <p className="mt-3 text-[11px] text-gray-400 italic">
                    Archivo Excel con las solicitudes de crédito a cruzar.
                  </p>
                </div>
              )}

              {/* Dropzone 2: Lote de PDFs DataCrédito */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handlePdfDrop}
                className="flex flex-col rounded-xl border-2 border-dashed border-gray-200 hover:border-coodel-primary/40 p-5 bg-gray-50/50 transition-all text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mx-auto mb-3">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-800">2. Lote de PDFs de DataCrédito</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  Arrastra uno o varios reportes en PDF (Persona Natural / Historia de Crédito)
                </p>

                {pdfFiles.length > 0 ? (
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-xs font-semibold text-coodel-primary px-1">
                      <span>{pdfFiles.length} reporte(s) seleccionado(s)</span>
                      <button
                        type="button"
                        onClick={() => setPdfFiles([])}
                        className="text-red-600 hover:underline text-[11px]"
                      >
                        Limpiar todos
                      </button>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1 border border-gray-200 rounded-lg p-2 bg-white">
                      {pdfFiles.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] text-gray-600 truncate py-0.5">
                          <span className="truncate pr-2">{f.name}</span>
                          <span className="text-gray-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer shadow-sm transition-colors mx-auto">
                    <span>Seleccionar PDFs (.pdf)</span>
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          setPdfFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                  </label>
                )}

                <p className="mt-3 text-[11px] text-gray-400">
                  Desencriptación automática para PDFs protegidos con la cédula del titular.
                </p>
              </div>
            </div>

            {/* Ajustes avanzados opcionales */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 hover:text-coodel-primary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-coodel-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Configuración de Inteligencia Artificial (opcional)</span>
                </div>
                <span className="text-xs text-gray-400">{showConfig ? "Ocultar" : "Configurar"}</span>
              </button>

              {showConfig && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      placeholder="sk-... (o dejar vacío para usar clave del servidor)"
                      value={openaiApiKey}
                      onChange={(e) => handleSaveApiKey(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-coodel-primary focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                      Guarda automáticamente en tu navegador para futuros análisis.
                    </p>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">
                      Contraseña maestra de PDFs (opcional)
                    </label>
                    <input
                      type="password"
                      placeholder="Si los PDFs tienen una clave fija"
                      value={pdfPassword}
                      onChange={(e) => setPdfPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-coodel-primary focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                      Por defecto se prueban los dígitos de la cédula en el nombre.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── VISTA 2: PROCESAMIENTO EN VIVO (SSE) ─── */}
        {step === "processing" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col justify-center">
            <div className="text-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coodel-primary/10 text-coodel-primary mx-auto animate-pulse">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-coodel-primary border-t-transparent" />
              </div>
              <h3 className="text-base font-bold text-coodel-primary">
                Cruzando Información con Inteligencia Artificial
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">{currentFileMsg}</p>
            </div>

            {/* Barra de progreso */}
            <div className="w-full max-w-lg mx-auto space-y-1">
              <div className="flex justify-between text-xs font-semibold text-gray-600">
                <span>Progreso general</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 border border-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-coodel-primary to-coodel-accent transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Consola de terminal en tiempo real */}
            <div className="w-full max-w-2xl mx-auto rounded-xl border border-gray-800 bg-gray-900 p-4 text-left shadow-inner">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
                <span className="text-[11px] font-mono text-gray-400">Registro de extracción en vivo</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div
                ref={logTerminalRef}
                className="h-44 overflow-y-auto font-mono text-[11px] space-y-1 pr-1 text-gray-300"
              >
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed ${
                      log.type === "success"
                        ? "text-emerald-400"
                        : log.type === "warn"
                        ? "text-amber-300"
                        : log.type === "error"
                        ? "text-rose-400 font-bold"
                        : "text-gray-300"
                    }`}
                  >
                    <span className="text-gray-500 mr-2">[{log.time}]</span>
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── VISTA 3: TABLERO DE RESULTADOS ─── */}
        {step === "results" && kpis && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* 6 KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Solicitudes Excel</p>
                <p className="text-xl font-extrabold text-coodel-dark mt-0.5">{kpis.totalExcel}</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">PDFs Analizados</p>
                <p className="text-xl font-extrabold text-coodel-primary mt-0.5">{kpis.totalPdfs}</p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Cruces Exitosos</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                  {kpis.coincidencias} <span className="text-xs font-semibold">({kpis.tasaCoincidencia}%)</span>
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Score Promedio</p>
                <p
                  className={`text-xl font-extrabold mt-0.5 ${
                    kpis.scorePromedio >= 700
                      ? "text-emerald-600"
                      : kpis.scorePromedio >= 550
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {kpis.scorePromedio || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pendiente Reporte</p>
                <p className="text-xl font-extrabold text-amber-700 mt-0.5">{kpis.pendientes}</p>
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 shadow-sm text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-800">No en Formulario</p>
                <p className="text-xl font-extrabold text-purple-700 mt-0.5">{kpis.noEnFormulario}</p>
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("todos")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "todos"
                      ? "bg-coodel-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Todos ({records.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("coincidencias")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "coincidencias"
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Coincidencias ({kpis.coincidencias})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("sin_reporte")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "sin_reporte"
                      ? "bg-amber-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Sin Reporte ({kpis.pendientes})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("no_en_formulario")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === "no_en_formulario"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  No en Formulario ({kpis.noEnFormulario})
                </button>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Buscar por cédula o nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-coodel-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Tabla Detallada con Semáforos */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#002446] text-white font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">Documento</th>
                      <th className="px-3 py-2.5">Solicitante</th>
                      <th className="px-3 py-2.5 text-center">Score</th>
                      <th className="px-3 py-2.5 text-center">Riesgo</th>
                      <th className="px-3 py-2.5 text-center">Mora</th>
                      <th className="px-3 py-2.5 text-center">Vectores</th>
                      <th className="px-3 py-2.5 text-right">Deuda Total</th>
                      <th className="px-3 py-2.5 text-right">Cuotas</th>
                      <th className="px-3 py-2.5 text-center">Estado Cruce</th>
                      <th className="px-3 py-2.5 text-center">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                          No se encontraron registros con los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r, idx) => {
                        const scoreNum = typeof r.puntaje === "number" ? r.puntaje : 0;
                        const scoreTone =
                          scoreNum >= 700
                            ? "bg-emerald-100 text-emerald-800"
                            : scoreNum >= 550
                            ? "bg-amber-100 text-amber-800"
                            : scoreNum > 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-gray-100 text-gray-500";

                        const isRiesgoBajo = r.nivelRiesgo === "Bajo";
                        const isRiesgoMedio = r.nivelRiesgo === "Medio";
                        const isRiesgoAlto = r.nivelRiesgo === "Alto";

                        const riesgoCellBg = isRiesgoBajo
                          ? "bg-emerald-50/50"
                          : isRiesgoMedio
                          ? "bg-amber-50/50"
                          : isRiesgoAlto
                          ? "bg-rose-50/50"
                          : "";

                        const riesgoBadgeTone = isRiesgoBajo
                          ? "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold"
                          : isRiesgoMedio
                          ? "bg-amber-100 text-amber-950 border-amber-400 font-bold"
                          : isRiesgoAlto
                          ? "bg-rose-100 text-rose-950 border-rose-400 font-bold"
                          : "bg-gray-100 text-gray-500 border-gray-200 font-normal";

                        const vInfo = r.vectores && r.vectores !== "Pendiente reporte" ? analyzeVector(r.vectores) : null;

                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 font-mono font-medium text-gray-900">{r.cedula}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[150px]">{r.nombre}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block rounded-md px-2 py-0.5 font-bold font-mono text-[11px] ${scoreTone}`}>
                                {r.puntaje ?? "—"}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-center transition-colors ${riesgoCellBg}`}>
                              <span className={`inline-block rounded border px-2 py-0.5 text-[11px] shadow-xs ${riesgoBadgeTone}`}>
                                {r.nivelRiesgo}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                                  r.peorMora === "Al día"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : r.peorMora === "Pendiente reporte"
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {r.peorMora}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {vInfo ? (
                                <div className="inline-flex flex-col items-center max-w-[130px]">
                                  <span className="font-mono text-[10px] tracking-wider font-bold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5">
                                    {r.vectores}
                                  </span>
                                  <span
                                    title={vInfo.detalle}
                                    className={`text-[9px] font-semibold mt-0.5 truncate w-full text-center ${
                                      vInfo.estado === "critico"
                                        ? "text-rose-600"
                                        : vInfo.estado === "alerta"
                                        ? "text-amber-600"
                                        : "text-emerald-700"
                                    }`}
                                  >
                                    {vInfo.resumen}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[10px] font-mono">Pendiente</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800 font-medium">
                              {formatMoney(r.totalDeuda)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800 font-medium">
                              {formatMoney(r.valorCuotas)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  r.estadoCruce === "coincidencia"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.estadoCruce === "sin_reporte"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {r.estadoCruceLabel}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedRecordForDetail(r)}
                                className="rounded bg-gray-100 hover:bg-coodel-primary hover:text-white px-2 py-1 text-[11px] font-semibold text-coodel-primary transition-colors"
                              >
                                Ver Ficha
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── BARRA INFERIOR DE ACCIONES ─── */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
          <div>
            {step === "upload" && (
              <p className="text-xs text-gray-500">
                {pdfFiles.length > 0
                  ? sourceMode === "coodelsur"
                    ? `${pdfFiles.length} reporte(s) listo(s) para cruzar con solicitudes de Coodelsur`
                    : `${pdfFiles.length} reporte(s) listos para análisis con IA`
                  : "Selecciona los PDFs de DataCrédito para continuar"}
              </p>
            )}
            {step === "results" && kpis && (
              <p className="text-xs text-gray-500">
                Total procesado: <strong className="text-gray-800">{records.length}</strong> solicitudes consolidadas
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {step === "results" ? "Cerrar" : "Cancelar"}
            </Button>

            {step === "upload" && (
              <Button
                type="button"
                size="sm"
                disabled={pdfFiles.length === 0 || (sourceMode === "excel" && !excelFile)}
                onClick={() => void handleStartCruce()}
                className="flex items-center gap-1.5 bg-coodel-primary hover:bg-coodel-primary-light text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Iniciar Cruce con IA</span>
              </Button>
            )}

            {step === "results" && (
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 bg-[#708238] hover:bg-[#5f6e30] text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Descargar Excel Enriquecido (.xlsx)</span>
              </Button>
            )}
          </div>
        </div>

        {/* ─── MODAL SECUNDARIO: FICHA DETALLADA DEL SOLICITANTE ─── */}
        {selectedRecordForDetail && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-coodel-primary">{selectedRecordForDetail.nombre}</h3>
                  <p className="text-xs text-gray-500 font-mono">C.C. {selectedRecordForDetail.cedula}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecordForDetail(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Score de Crédito</span>
                  <span className="text-lg font-bold text-coodel-dark font-mono">{selectedRecordForDetail.puntaje ?? "—"}</span>
                </div>
                <div
                  className={`rounded-xl p-2.5 border transition-colors ${
                    selectedRecordForDetail.nivelRiesgo === "Bajo"
                      ? "bg-emerald-50/70 border-emerald-300"
                      : selectedRecordForDetail.nivelRiesgo === "Medio"
                      ? "bg-amber-50/70 border-amber-300"
                      : selectedRecordForDetail.nivelRiesgo === "Alto"
                      ? "bg-rose-50/70 border-rose-300"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">
                    Nivel de Riesgo
                  </span>
                  <span
                    className={`inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold border shadow-xs ${
                      selectedRecordForDetail.nivelRiesgo === "Bajo"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-400"
                        : selectedRecordForDetail.nivelRiesgo === "Medio"
                        ? "bg-amber-100 text-amber-950 border-amber-400"
                        : selectedRecordForDetail.nivelRiesgo === "Alto"
                        ? "bg-rose-100 text-rose-950 border-rose-400"
                        : "bg-gray-100 text-gray-600 border-gray-300"
                    }`}
                  >
                    {selectedRecordForDetail.nivelRiesgo}
                  </span>
                </div>
                {selectedRecordForDetail.montoSolicitado !== undefined && (
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Monto Solicitado</span>
                    <span className="text-sm font-semibold text-gray-900 font-mono">
                      {formatMoney(selectedRecordForDetail.montoSolicitado)}
                    </span>
                  </div>
                )}
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Monto Sugerido</span>
                  <span className="text-sm font-semibold text-gray-900 font-mono">
                    {formatMoney(selectedRecordForDetail.montoSugerido)}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Ingreso DataCrédito</span>
                  <span className="text-sm font-semibold text-gray-900 font-mono">
                    {formatMoney(selectedRecordForDetail.ingresoData)}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Total Deuda Actual</span>
                  <span className="text-sm font-semibold text-gray-900 font-mono">
                    {formatMoney(selectedRecordForDetail.totalDeuda)}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Valor Cuotas Mensuales</span>
                  <span className="text-sm font-semibold text-gray-900 font-mono">
                    {formatMoney(selectedRecordForDetail.valorCuotas)}
                  </span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Peor Mora</span>
                  <span className="text-xs font-semibold text-gray-800">{selectedRecordForDetail.peorMora}</span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2.5">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Endeudamiento</span>
                  <span className="text-xs font-semibold text-gray-800">{selectedRecordForDetail.endeudamiento}</span>
                </div>
              </div>

              {/* Sección de Vectores y Análisis Detallado */}
              {(() => {
                const vectorInfo = analyzeVector(selectedRecordForDetail.vectores);
                const isPendiente =
                  selectedRecordForDetail.vectores === "Pendiente reporte" ||
                  !selectedRecordForDetail.vectores;

                const badgeColor =
                  vectorInfo.estado === "optimo"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : vectorInfo.estado === "alerta"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : vectorInfo.estado === "critico"
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-gray-100 text-gray-600 border-gray-200";

                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div>
                        <span className="text-[11px] font-bold text-gray-800 uppercase tracking-wide block">
                          Vector Histórico de Pagos (12 meses)
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Comportamiento mensual reportado en DataCrédito Experian
                        </span>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                        {vectorInfo.resumen}
                      </span>
                    </div>

                    {/* Cadena y desglose mes a mes */}
                    {!isPendiente && vectorInfo.desglose.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1 px-1">
                          <span>Hace 12 meses</span>
                          <span className="font-mono text-gray-700 font-bold tracking-widest bg-gray-100 px-2 py-0.5 rounded">
                            {selectedRecordForDetail.vectores}
                          </span>
                          <span>Mes actual</span>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                          {vectorInfo.desglose.map((m) => {
                            const pillBg =
                              m.estado === "al_dia"
                                ? "bg-emerald-600 text-white"
                                : m.estado === "mora_leve"
                                ? "bg-amber-500 text-white"
                                : m.estado === "mora_grave"
                                ? "bg-rose-600 text-white"
                                : "bg-gray-200 text-gray-700";

                            return (
                              <div
                                key={m.mes}
                                title={`Mes ${m.mes}: ${m.simbolo} (${m.significado})`}
                                className="flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50 p-1 text-center"
                              >
                                <span className="text-[9px] text-gray-400 font-medium">M{m.mes}</span>
                                <span className={`h-6 w-6 rounded-full flex items-center justify-center font-mono font-bold text-[11px] my-0.5 ${pillBg}`}>
                                  {m.simbolo}
                                </span>
                                <span className="text-[8px] text-gray-600 truncate w-full font-medium">
                                  {m.estado === "al_dia" ? "Al día" : m.estado === "neutro" ? "Sin saldo" : "Mora"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Explicación y Análisis Detallado */}
                    <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-2.5 text-xs">
                      <span className="text-[11px] font-bold text-emerald-950 block mb-1">
                        Explicación y Análisis del Vector:
                      </span>
                      <p className="text-gray-700 leading-relaxed text-[11px]">
                        {selectedRecordForDetail.analisisVectores || vectorInfo.detalle}
                      </p>
                    </div>

                    {/* Guía de Simbología */}
                    <div className="border-t border-gray-100 pt-2 text-[10px] text-gray-500 space-y-1">
                      <span className="font-semibold text-gray-700 block">Simbología oficial DataCrédito:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-0.5">
                        <div><strong className="text-emerald-700 font-mono">N:</strong> Normal / Al día (Sin mora)</div>
                        <div><strong className="text-amber-700 font-mono">1:</strong> Mora de 30 a 59 días</div>
                        <div><strong className="text-amber-800 font-mono">2:</strong> Mora de 60 a 89 días</div>
                        <div><strong className="text-rose-700 font-mono">3:</strong> Mora de 90 a 119 días</div>
                        <div><strong className="text-rose-800 font-mono">C:</strong> Cartera castigada</div>
                        <div><strong className="text-gray-600 font-mono">0:</strong> Inactiva o saldo cero</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-xs">
                <span className="text-blue-900 block font-bold mb-1">Diagnóstico de Inteligencia Artificial</span>
                <p className="text-gray-700 leading-relaxed">{selectedRecordForDetail.diagnosticoIA}</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedRecordForDetail(null)}>
                  Cerrar Ficha
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
