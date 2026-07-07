import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/dashboard"
import { isAdminUser, getMasterConfig, saveMasterConfig, clearMasterConfig } from "@/lib/settings"
import { provisionMaster, getMasterStatus, removeMaster } from "@/lib/mt5/copyfactory"

async function requireAdmin() {
  const session = await getSessionUser()
  if (!session) return { error: "Non authentifié.", status: 401 as const }
  const admin = await isAdminUser(session.id)
  if (!admin) return { error: "Accès réservé aux administrateurs.", status: 403 as const }
  return { session }
}

/** GET /api/admin/master — état actuel du compte maître. */
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status })
  }

  const config = await getMasterConfig()
  if (!config) {
    return NextResponse.json({ ok: true, configured: false, master: null })
  }

  const status = await getMasterStatus(config.metaApiAccountId, config.strategyId)
  return NextResponse.json({
    ok: true,
    configured: true,
    master: {
      login: config.login,
      server: config.server,
      platform: config.platform,
      strategyId: config.strategyId,
      ...status,
    },
  })
}

/** POST /api/admin/master — provisionne (ou remplace) le compte maître. */
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const login = String(body.login || "").trim()
    const password = String(body.password || "")
    const server = String(body.server || "").trim()
    const platform = body.platform === "mt4" ? "mt4" : "mt5"

    if (!login || !password || !server) {
      return NextResponse.json({ ok: false, message: "Login, mot de passe et serveur sont requis." }, { status: 400 })
    }

    // Retirer l'ancien maître (le cas échéant) pour libérer ses ressources MetaApi.
    const existing = await getMasterConfig()
    if (existing) {
      await removeMaster(existing.metaApiAccountId, existing.strategyId)
      await clearMasterConfig()
    }

    const result = await provisionMaster({ login, password, server, platform })

    await saveMasterConfig({
      metaApiAccountId: result.metaApiAccountId,
      strategyId: result.strategyId,
      login: result.login,
      server: result.server,
      platform,
    })

    return NextResponse.json({
      ok: true,
      message: "Compte maître connecté et stratégie de copie créée.",
      master: {
        login: result.login,
        server: result.server,
        broker: result.broker,
        balance: result.balance,
        equity: result.equity,
        currency: result.currency,
        strategyId: result.strategyId,
      },
    })
  } catch (error) {
    console.error("[v0] admin master POST error:", error)
    const message = error instanceof Error ? error.message : "Impossible de configurer le compte maître."
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

/** DELETE /api/admin/master — retire le compte maître et sa stratégie. */
export async function DELETE() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status })
  }

  try {
    const existing = await getMasterConfig()
    if (existing) {
      await removeMaster(existing.metaApiAccountId, existing.strategyId)
      await clearMasterConfig()
    }
    return NextResponse.json({ ok: true, message: "Compte maître retiré." })
  } catch (error) {
    console.error("[v0] admin master DELETE error:", error)
    return NextResponse.json({ ok: false, message: "Impossible de retirer le compte maître." }, { status: 500 })
  }
}
