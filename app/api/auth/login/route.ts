import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { createSessionToken, normalizeEmail, sessionCookieName, verifyPassword } from "@/lib/auth"

type UserRow = RowDataPacket & {
  id: number
  full_name: string
  email: string
  password_hash: string
  status: "active" | "pending" | "blocked"
  referral_code: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = normalizeEmail(String(body.email || ""))
    const password = String(body.password || "")

    const [rows] = await db.execute<UserRow[]>(
      "SELECT id, full_name, email, password_hash, status, referral_code FROM users WHERE email = ? LIMIT 1",
      [email],
    )
    const user = rows[0]

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ ok: false, message: "E-mail ou mot de passe incorrect." }, { status: 401 })
    }
    if (user.status === "blocked") {
      return NextResponse.json({ ok: false, message: "Ce compte est bloqué. Contactez le support." }, { status: 403 })
    }

    await db.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id])

    const response = NextResponse.json({
      ok: true,
      message: "Connexion réussie.",
      user: { id: user.id, name: user.full_name, email: user.email, referralCode: user.referral_code },
    })
    response.cookies.set(sessionCookieName(), createSessionToken({ id: user.id, email: user.email, name: user.full_name }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (error) {
    console.error("login error", error)
    return NextResponse.json({ ok: false, message: "Impossible de se connecter pour le moment." }, { status: 500 })
  }
}
