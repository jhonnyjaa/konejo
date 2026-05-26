// Implementación de cn sin dependencias extra
type ClassValue = string | boolean | null | undefined | Record<string, boolean>;

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter(Boolean)
    .map((x) => {
      if (typeof x === "string") return x;
      if (typeof x === "object" && x !== null) {
        return Object.entries(x as Record<string, boolean>)
          .filter(([, v]) => Boolean(v))
          .map(([k]) => k)
          .join(" ");
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return `${m}m ${s}s`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return `Hoy, ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) {
    return `Ayer, ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays < 7) {
    return date.toLocaleDateString("es", { weekday: "long", hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Estima número de tokens (rough: palabras / 0.75)
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 0.75);
}

// Tipos de archivo de audio/video soportados
export const SUPPORTED_AUDIO_EXTS = [".wav", ".mp3", ".m4a", ".ogg", ".flac"];
export const SUPPORTED_VIDEO_EXTS = [".mp4", ".mkv", ".mov", ".avi", ".webm"];
export const SUPPORTED_EXTS       = [...SUPPORTED_AUDIO_EXTS, ...SUPPORTED_VIDEO_EXTS];
