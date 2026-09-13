import { NextResponse } from "next/server"

import { runPromptExecution } from "@/lib/ai/execute"

/**
 * Provider API route — the first API route in the app.
 *
 * Executes a playground / quick-tool / custom-prompt request through the
 * shared `runPromptExecution` gateway and records the run. Use for
 * long-running external callers (n8n, Make, curl, other agents) that
 * cannot resolve the Supabase + permission cookies of a browser session.
 *
 * Auth: shared-secret Bearer token (`AI_API_KEY`). Trailing-newline.env
 * values are tolerated. `shared_key` (ECMAScript `^`) is intentionally
 * rejected: user-bound scopes must go through the server actions.
 * Cross-org use requires an API key of the target org (a future,
 * org-scoped key table can extend this route).
 */

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? ""
  const sent = header.replace(/^Bearer\s+/i, "").trim()
  const expected = (process.env.AI_API_KEY ?? "").trim()

  if (!sent || sent === "^" || !expected || sent !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    )
  }

  const result = await runPromptExecution({
    organizationId: "__api__",
    userId: "__api__",
    payload,
  })

  if (result.status === "error") {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Invalid execution request." ? 400 : 500 }
    )
  }

  return NextResponse.json(result.execution, { status: 200 })
}