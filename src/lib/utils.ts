export function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now  = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0)
    return `Hoy ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1)
    return `Ayer ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7)
    return date.toLocaleDateString("es", { weekday: "long" });
  return date.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now  = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7)   return "Esta semana";
  return "Más antiguo";
}

export function groupByDate<T>(items: T[], getDate: (i: T) => number): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = formatRelativeDate(getDate(item));
    (groups[key] ??= []).push(item);
  }
  return groups;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export const SUPPORTED_EXTS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".mp4", ".mkv", ".mov", ".avi", ".webm"];
