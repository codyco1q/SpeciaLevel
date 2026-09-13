import { redirect } from "next/navigation"

import { hasPermission } from "@/lib/auth/rbac"
import { getCurrentUserContext } from "@/lib/auth/session"
import { getAiPrompts } from "@/lib/actions/ai"
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary"
import { AiView } from "./ai-view"

/**
 * AI & Intelligent Agents module page.
 * Requires `ai.view` (shown as a terse "no permission" card otherwise —
 * the sidebar item is only rendered for users with the permission, so this
 * is a defense-in-depth fallback for stale URLs).
 */
export const dynamic = "force-dynamic"

export default async function AiPage() {
  const userContext = await getCurrentUserContext()
  if (!userContext) redirect("/login")
  if (!userContext.organization) redirect("/onboarding")

  const { platform } = await getDictionary()
  const locale = await getLocale()
  const t = platform.ai

  if (!hasPermission("ai.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.noPermissionBody}
          </p>
        </div>
      </div>
    )
  }

  const initialPrompts = await getAiPrompts()

  return (
    <div className="p-8">
      <AiView
        initialPrompts={initialPrompts ?? []}
        canManage={hasPermission("ai.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  )
}