/**
 * Client-safe file helpers shared by the task attachment panel, the chat
 * composer, and the client portal hub.
 */

/** "1.4 MB" / "820 KB" — locale-independent units. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

/** Strips path separators + control chars so a user file name is a safe storage suffix. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/%?#\u0000-\u001f]/g, "_").trim();
  const fallback = cleaned.length > 0 ? cleaned : "file";
  return fallback.slice(0, 200);
}

/** RFC4122 v4 UUID (crypto.randomUUID with a pragmatic fallback). */
export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}