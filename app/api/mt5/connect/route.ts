import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import {
  ensureTrialPeriod,
  getDashboardState,
  getSessionUser,
  serverAllowedDuringTrial,
  isTrialActive,
} from "@/lib/dashboard"
import { connectMt5Account } from "@/lib/mt5/service"

export async function POST(request: Request) {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const body = await request.json()
    const login = String(body.login || "").trim()
    const password = String(body.password || "")
    const server = String(body.server || "").trim()

    if (!login || !password || !server) {
      return NextResponse.json({ ok: false, message: "Tous les champs MT4/MT5 sont obligatoires." }, { status: 400 })
    }

    await ensureTrialPeriod(session.id)

    const [userRows] = await db.execute<RowDataPacket[]>(
      "SELECT trial_ends_at, trial_used FROM users WHERE id = ? LIMIT 1",
      [session.id],
    )
    const user = userRows[0]
    const trialActive = isTrialActive(user?.trial_ends_at)

    // Pré-filtre léger : bloquer seulement les serveurs qui mentionnent
    // explicitement "live" / "real" / "prod" pendant la période d'essai.
    // La vérification définitive se fait après le retour du bridge (account.isDemo).
    if (trialActive && !serverAllowedDuringTrial(server)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Période d'essai active : seuls les comptes DEMO sont autorisés. Votre essai se termine bientôt.",
        },
        { status: 403 },
      )
    }

    // Connexion via le bridge (détermine réellement si le compte est demo)
    const account = await connectMt5Account({ login, password, server })

    // Vérification définitive après retour du bridge
    if (trialActive && !account.isDemo) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Ce compte n'est pas un compte démo. Seuls les comptes DEMO sont autorisés pendant la période d'essai.",
        },
        { status: 403 },
      )
    }

    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()

      await connection.execute("DELETE FROM mt5_accounts WHERE user_id = ?", [session.id])

      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO mt5_accounts
         (user_id, login, server, broker, account_type, leverage, is_demo, status,
          balance, equity, free_margin, daily_profit, currency, connected_at, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          session.id,
          account.login,
          account.server,
          account.broker,
          account.accountType,
          account.leverage,
          account.isDemo ? 1 : 0,
          account.balance,
          account.equity,
          account.freeMargin,
          account.dailyProfit,
          account.currency,
        ],
      )

      const accountId = insertResult.insertId

      await connection.execute(
        "UPDATE bot_sessions SET status = 'cancelled' WHERE user_id = ? AND status IN ('idle', 'running', 'payment_due')",
        [session.id],
      )

      if (accountId) {
        await connection.execute(
          `INSERT INTO bot_sessions (user_id, mt5_account_id, status) VALUES (?, ?, 'idle')`,
          [session.id, accountId],
        )
      }

      if (trialActive && account.isDemo) {
        await connection.execute("UPDATE users SET trial_used = 1 WHERE id = ?", [session.id])
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    const state = await getDashboardState(session.id)
    return NextResponse.json({
      ok: true,
      message: account.isDemo
        ? "Compte démo connecté. Profitez de votre essai de 3 jours."
        : "Compte MT4/MT5 connecté avec succès.",
      ...state,
    })
  } catch (error) {
    console.error("mt5 connect error", error)
    const message = error instanceof Error ? error.message : "Connexion MT4/MT5 impossible."
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
