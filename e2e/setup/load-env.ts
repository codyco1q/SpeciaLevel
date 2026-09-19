import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimal `.env.local` loader for the Node-side E2E plumbing
 * (`global-setup.ts` and the service-role test helpers).
 *
 * Playwright does not read Next.js env files on its own, and the app's
 * Supabase credentials live in `.env.local` (git-ignored). This reads that
 * file once and fills in any variable that is not already exported, so CI
 * can override individual values via the environment.
 *
 * Only the key/value pairs this suite needs (Supabase URL + service-role
 * key) are used — the file is never bundled or printed.
 */
export function loadEnvLocal(root = process.cwd()): void {
  const envFile = join(root, ".env.local");
  if (!existsSync(envFile)) return;

  for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key) continue;

    let value = line.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    if (process.env[key] === undefined) process.env[key] = value;
  }
}
