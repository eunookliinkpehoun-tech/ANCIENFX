import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { getSessionUser } from "@/lib/dashboard"

function toNumber(value: unknown) {
  return value == null ? 0 : Number(value)
}

function toIso(value: unknown) {
  return value ? new Date(value as string | Date).toISOString() : null
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@")
  if (!domain) return email
  const head = name.slice(0, 3)
  return `${head}${name.length > 3 ? "***" : ""}@${domain}`
}

export async function GET() {
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ ok: false, message: "Non authentifié." }, { status: 401 })
  }

  try {
    const [userRows] = await db.execute<RowDataPacket[]>(
      "SELECT referral_code FROM users WHERE id = ? LIMIT 1",
      [session.id],
    )
    const referralCode = userRows[0]?.referral_code || ""

    const [summaryRows] = await db.execute<RowDataPacket[]>(
      `SELECT
         COUNT(DISTINCT ur.referred_user_id) AS referral_count,
         COUNT(DISTINCT CASE WHEN ur.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ur.referred_user_id END) AS recent_count,
         COALESCE(SUM(CASE WHEN rc.status = 'pending' THEN rc.amount ELSE 0 END), 0) AS available_balance,
         COALESCE(SUM(CASE WHEN rc.status IN ('pending', 'paid') THEN rc.amount ELSE 0 END), 0) AS total_earned,
         COALESCE(SUM(CASE WHEN rc.status = 'paid' THEN rc.amount ELSE 0 END), 0) AS total_withdrawn
       FROM user_referrals ur
       LEFT JOIN referral_commissions rc ON rc.referrer_user_id = ur.referrer_user_id
        AND rc.referred_user_id = ur.referred_user_id
       WHERE ur.referrer_user_id = ?`,
      [session.id],
    )

    const [referralRows] = await db.execute<RowDataPacket[]>(
      `SELECT
         ur.id,
         ur.status,
         ur.created_at,
         u.full_name,
         u.email,
         COALESCE(SUM(CASE WHEN rc.status IN ('pending', 'paid') THEN rc.amount ELSE 0 END), 0) AS generated_gain
       FROM user_referrals ur
       JOIN users u ON u.id = ur.referred_user_id
       LEFT JOIN referral_commissions rc ON rc.referred_user_id = ur.referred_user_id
        AND rc.referrer_user_id = ur.referrer_user_id
       WHERE ur.referrer_user_id = ?
       GROUP BY ur.id, ur.status, ur.created_at, u.full_name, u.email
       ORDER BY ur.created_at DESC
       LIMIT 100`,
      [session.id],
    )

    const summary = summaryRows[0] || {}
    return NextResponse.json({
      ok: true,
      referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://fxmirror.app"}?ref=${referralCode}`,
      stats: {
        referralCount: toNumber(summary.referral_count),
        recentCount: toNumber(summary.recent_count),
        availableBalance: toNumber(summary.available_balance),
        totalEarned: toNumber(summary.total_earned),
        totalWithdrawn: toNumber(summary.total_withdrawn),
      },
      referrals: referralRows.map((row) => ({
        id: String(row.id),
        name: row.full_name,
        email: maskEmail(String(row.email || "")),
        date: toIso(row.created_at),
        status: row.status,
        gain: toNumber(row.generated_gain),
      })),
    })
  } catch (error) {
    console.error("parrainage error", error)
    return NextResponse.json({ ok: false, message: "Impossible de charger le parrainage." }, { status: 500 })
  }
}
