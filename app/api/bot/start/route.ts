import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getDashboardState, getSessionUser } from "@/lib/dashboard"

export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const [mt5Rows] = await db.execute<RowDataPacket[]>(
      "SELECT id, balance FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1",
      [session.id],
    )
    if (mt5Rows.length === 0) {
      return NextResponse.json({ ok: false, message: "Aucun compte MT4/MT5 connecté." }, { status: 400 })
    }

    const mt5 = mt5Rows[0]

    const [sessionRows] = await db.execute<RowDataPacket[]>(
      `SELECT id, status FROM bot_sessions
       WHERE user_id = ? AND mt5_account_id = ? AND status IN ('idle', 'running', 'payment_due')
       ORDER BY id DESC LIMIT 1`,
      [session.id, mt5.id],
    )

    const botSession = sessionRows[0]
    if (botSession?.status === "payment_due") {
      return NextResponse.json(
        { ok: false, message: "Règlement requis avant de relancer le bot." },
        { status: 403 },
      )
    }

    if (botSession?.status === "running") {
      return NextResponse.json(
        { ok: false, message: "Un cycle de 24h est déjà en cours." },
        { status: 409 },
      )
    }

    const balance = Number(mt5.balance)
    const cycleEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    if (botSession) {
      await db.execute(
        `UPDATE bot_sessions
         SET status = 'running', start_balance = ?, started_at = NOW(), cycle_ends_at = ?
         WHERE id = ?`,
        [balance, cycleEndsAt, botSession.id],
      )
    } else {
      await db.execute(
        `INSERT INTO bot_sessions (user_id, mt5_account_id, status, start_balance, started_at, cycle_ends_at)
         VALUES (?, ?, 'running', ?, NOW(), ?)`,
        [session.id, mt5.id, balance, cycleEndsAt],
      )
    }

    const state = await getDashboardState(session.id)
    return NextResponse.json({
      ok: true,
      message: "Bot démarré. Le solde actuel a été enregistré pour le calcul des gains (24h).",
      ...state,
    })
  } catch (error) {
    console.error("bot start error", error)
    return NextResponse.json({ ok: false, message: "Impossible de démarrer le bot." }, { status: 500 })
  }
}
