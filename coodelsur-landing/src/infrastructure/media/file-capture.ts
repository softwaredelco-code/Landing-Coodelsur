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
