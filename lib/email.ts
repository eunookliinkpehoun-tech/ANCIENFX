import nodemailer from "nodemailer"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"

type WeeklyStats = {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  netProfit: number
  grossProfit: number
  grossLoss: number
  profitPercent: number
  bestTrade: number
  worstTrade: number
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function computeWeeklyStats(userId: number): Promise<WeeklyStats> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT profit FROM mt5_trades
     WHERE user_id = ?
       AND close_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId],
  )

  const profits = rows.map((r) => Number(r.profit))
  const totalTrades = profits.length
  const winningTrades = profits.filter((p) => p > 0).length
  const losingTrades = profits.filter((p) => p < 0).length
  const netProfit = profits.reduce((a, b) => a + b, 0)
  const grossProfit = profits.filter((p) => p > 0).reduce((a, b) => a + b, 0)
  const grossLoss = profits.filter((p) => p < 0).reduce((a, b) => a + b, 0)
  const bestTrade = totalTrades ? Math.max(...profits) : 0
  const worstTrade = totalTrades ? Math.min(...profits) : 0

  const [balanceRows] = await db.execute<RowDataPacket[]>(
    "SELECT balance FROM mt5_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1",
    [userId],
  )
  const balance = balanceRows[0] ? Number(balanceRows[0].balance) : 0
  const profitPercent = balance > 0 ? Math.round((netProfit / balance) * 10000) / 100 : 0

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    netProfit: Math.round(netProfit * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitPercent,
    bestTrade,
    worstTrade,
  }
}

function weeklyReportHtml(name: string, stats: WeeklyStats) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0a1730">
      <h2>Rapport hebdomadaire FXMIRROR</h2>
      <p>Bonjour ${name},</p>
      <p>Voici le résumé de vos performances sur les 7 derniers jours :</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Trades exécutés</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right"><strong>${stats.totalTrades}</strong></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Trades gagnants</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${stats.winningTrades}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Trades perdants</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${stats.losingTrades}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Profit net</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${stats.netProfit >= 0 ? "#059669" : "#dc2626"}"><strong>${stats.netProfit >= 0 ? "+" : ""}${stats.netProfit.toFixed(2)} USD</strong></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Performance (%)</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${stats.profitPercent.toFixed(2)}%</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Meilleur trade</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">+${stats.bestTrade.toFixed(2)} USD</td></tr>
        <tr><td style="padding:8px">Pire trade</td><td style="padding:8px;text-align:right">${stats.worstTrade.toFixed(2)} USD</td></tr>
      </table>
      <p style="margin-top:24px;color:#64748b;font-size:13px">FXMIRROR — Copy trading MetaTrader 4/5</p>
    </div>
  `
}

export async function sendWeeklyReport(userId: number, email: string, name: string): Promise<boolean> {
  if (!smtpConfigured()) {
    console.warn("SMTP not configured, skipping weekly email for user", userId)
    return false
  }

  const stats = await computeWeeklyStats(userId)
  const transport = createTransport()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  try {
    await transport.sendMail({
      from,
      to: email,
      subject: "FXMIRROR — Rapport hebdomadaire de trading",
      html: weeklyReportHtml(name, stats),
    })
    await db.execute(
      "INSERT INTO email_logs (user_id, email_type, status) VALUES (?, 'weekly_report', 'sent')",
      [userId],
    )
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await db.execute(
      "INSERT INTO email_logs (user_id, email_type, status, error_message) VALUES (?, 'weekly_report', 'failed', ?)",
      [userId, message],
    )
    return false
  }
}

export async function sendWeeklyReportsToAllUsers(): Promise<{ sent: number; failed: number }> {
  const [users] = await db.execute<RowDataPacket[]>(
    "SELECT id, full_name, email FROM users WHERE status = 'active'",
  )

  let sent = 0
  let failed = 0
  for (const user of users) {
    const ok = await sendWeeklyReport(user.id, user.email, user.full_name)
    if (ok) sent += 1
    else failed += 1
  }
  return { sent, failed }
}
