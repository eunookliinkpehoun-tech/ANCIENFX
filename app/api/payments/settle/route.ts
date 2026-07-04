import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import {
  computeReferralCommission,
  getDashboardState,
  getSessionUser,
} from "@/lib/dashboard"

export async function POST() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()

    const [paymentRows] = await connection.execute<RowDataPacket[]>(
      `SELECT p.*, bs.id AS bot_session_id
       FROM payments p
       JOIN bot_sessions bs ON bs.id = p.bot_session_id
       WHERE p.user_id = ? AND p.status = 'pending'
       ORDER BY p.id DESC LIMIT 1
       FOR UPDATE`,
      [session.id],
    )

    const payment = paymentRows[0]
    if (!payment) {
      await connection.rollback()
      return NextResponse.json({ ok: false, message: "Aucun paiement en attente." }, { status: 400 })
    }

    // TODO: integrate Stripe/PayPal webhook. For now, mark as completed on user action.
    await connection.execute(
      "UPDATE payments SET status = 'completed', paid_at = NOW(), payment_method = 'manual' WHERE id = ?",
      [payment.id],
    )
    await connection.execute(
      "UPDATE bot_sessions SET status = 'paid', resolved_at = NOW() WHERE id = ?",
      [payment.bot_session_id],
    )

    const [userRows] = await connection.execute<RowDataPacket[]>(
      "SELECT referred_by_user_id FROM users WHERE id = ? LIMIT 1",
      [session.id],
    )
    const referrerId = userRows[0]?.referred_by_user_id

    if (referrerId) {
      const commission = computeReferralCommission(Number(payment.platform_share))
      if (commission > 0) {
        await connection.execute(
          `INSERT INTO referral_commissions
           (referrer_user_id, referred_user_id, payment_id, amount, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [referrerId, session.id, payment.id, commission],
        )
        await connection.execute(
          "UPDATE user_referrals SET status = 'active' WHERE referred_user_id = ? AND status = 'pending'",
          [session.id],
        )
      }
    }

    const mt5AccountId = (
      await connection.execute<RowDataPacket[]>(
        "SELECT id FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1",
        [session.id],
      )
    )[0][0]?.id

    if (mt5AccountId) {
      await connection.execute(
        `INSERT INTO bot_sessions (user_id, mt5_account_id, status) VALUES (?, ?, 'idle')`,
        [session.id, mt5AccountId],
      )
    }

    await connection.commit()

    const state = await getDashboardState(session.id)
    return NextResponse.json({
      ok: true,
      message: "Paiement enregistré. Le bot copieur est de nouveau actif.",
      ...state,
    })
  } catch (error) {
    await connection.rollback()
    console.error("payment settle error", error)
    return NextResponse.json({ ok: false, message: "Impossible de valider le paiement." }, { status: 500 })
  } finally {
    connection.release()
  }
}
