import type { FileCapture } from "@/shared/types/credito";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.75,
): Promise<{ dataUrl: string; size: number }> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, size: file.size };
  }

  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, size: file.size };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, size: file.size }));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, size: file.size }));
            return;
          }
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve({ dataUrl, size: blob.size });
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, size: file.size }));
    };

    img.src = objectUrl;
  });
}

export async function fileToCapture(file: File, fallbackName: string): Promise<FileCapture> {
  if (file.type.startsWith("image/")) {
    const compressed = await compressImageFile(file);
    return {
      fileName: file.name || fallbackName,
      mimeType: "image/jpeg",
      size: compressed.size,
      preview: compressed.dataUrl,
    };
  }

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
  let width = video.videoWidth;
  let height = video.videoHeight;
  const maxDim = 1200;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context || canvas.width === 0 || canvas.height === 0) {
    throw new Error("No se pudo capturar la imagen");
  }

  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.75);
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

export function getCameraErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "No pudimos abrir la cámara. Usa «Subir imagen» o revisa los permisos del navegador.";
  }

  const name = (error as DOMException).name;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Permiso de cámara bloqueado. Haz clic en el candado junto a la URL → Cámara → Permitir, recarga la página e intenta de nuevo.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No encontramos una cámara en este equipo. Usa «Subir imagen».";
    case "NotReadableError":
    case "TrackStartError":
      return "La cámara está en uso por otra app (Zoom, Teams, etc.). Ciérrala e intenta de nuevo.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "No pudimos configurar la cámara. Intenta de nuevo o sube una imagen.";
    default:
      if (error.message.includes("Tiempo de espera")) {
        return "No respondiste a tiempo al permiso de cámara. Vuelve a pulsar «Tomar foto con cámara» y elige Permitir.";
      }
      if (error.message.includes("HTTPS") || error.message.includes("getUserMedia no disponible")) {
        return "Tu navegador no permite usar la cámara en esta página. Usa «Subir imagen».";
      }
      return "No pudimos abrir la cámara. Usa «Subir imagen» o revisa los permisos del navegador.";
  }
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

function isPermissionDenied(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
}

/** Opens the camera with relaxed constraints and fallbacks (desktop webcams, iOS, Android). */
export async function getVideoStream(options?: {
  facingMode?: "user" | "environment";
  preferHd?: boolean;
}): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error("La cámara solo funciona en HTTPS");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia no disponible");
  }

  const { facingMode, preferHd = true } = options ?? {};
  const videoResolution = preferHd
    ? { width: { ideal: 1280 }, height: { ideal: 720 } }
    : {
        width: { ideal: 480, max: 640 },
        height: { ideal: 480, max: 640 },
        frameRate: { ideal: 15, max: 24 },
      };
  const mobile = isMobileDevice();
  const attempts: MediaStreamConstraints[] = [];

  if (mobile) {
    const effectiveFacing = facingMode ?? "environment";
    attempts.push({
      video: { facingMode: { ideal: effectiveFacing }, ...videoResolution },
      audio: false,
    });
    attempts.push({ video: { ...videoResolution }, audio: false });
    attempts.push({ video: true, audio: false });
  } else {
    // En PC: la restricción más simple primero evita cuelgues del diálogo de Chrome.
    attempts.push({ video: true, audio: false });
    attempts.push({ video: { ...videoResolution }, audio: false });
  }

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      const request = navigator.mediaDevices.getUserMedia(constraints);
      // En PC no hay timeout: el usuario puede tardar en pulsar «Permitir».
      return mobile
        ? await withTimeout(request, 90000, "Tiempo de espera agotado al abrir la cámara")
        : await request;
    } catch (error) {
      lastError = error;
      if (isPermissionDenied(error)) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo abrir la cámara");
}
