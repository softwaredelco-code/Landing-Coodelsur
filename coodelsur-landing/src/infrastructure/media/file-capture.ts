import type { FileCapture } from "@/shared/types/credito";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function fileToCapture(file: File, fallbackName: string): Promise<FileCapture> {
  const preview = await readFileAsDataUrl(file);
  return {
    fileName: file.name || fallbackName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    preview,
  };
}

export async function blobToCapture(blob: Blob, fileName: string): Promise<FileCapture> {
  const preview = await readFileAsDataUrl(new File([blob], fileName, { type: blob.type }));
  return {
    fileName,
    mimeType: blob.type || "application/octet-stream",
    size: blob.size,
    preview,
  };
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  fileName = "foto-cedula.jpg",
): Promise<FileCapture> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  if (!context || canvas.width === 0 || canvas.height === 0) {
    throw new Error("No se pudo capturar la imagen");
  }

  context.drawImage(video, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });

  if (!blob) throw new Error("No se pudo generar la foto");
  return blobToCapture(blob, fileName);
}

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;

  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Opens the camera with relaxed constraints and fallbacks (desktop webcams, iOS, Android). */
export async function getVideoStream(options?: {
  facingMode?: "user" | "environment";
  preferHd?: boolean;
}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia no disponible");
  }

  const { facingMode, preferHd = true } = options ?? {};
  const hd = preferHd ? { width: { ideal: 1280 }, height: { ideal: 720 } } : {};
  const attempts: MediaStreamConstraints[] = [];

  // "environment" solo tiene sentido en móvil; en PC provoca cuelgues en el diálogo de permisos.
  const effectiveFacing = facingMode === "environment" && !isMobileDevice() ? "user" : facingMode;

  if (effectiveFacing) {
    attempts.push({
      video: { facingMode: { ideal: effectiveFacing }, ...hd },
      audio: false,
    });
  }

  attempts.push({ video: { ...hd }, audio: false });
  attempts.push({ video: true, audio: false });

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await withTimeout(
        navigator.mediaDevices.getUserMedia(constraints),
        15000,
        "Tiempo de espera agotado al abrir la cámara",
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo abrir la cámara");
}
