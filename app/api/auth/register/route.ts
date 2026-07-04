import { NextResponse } from "next/server"
import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { createReferralCode, createSessionToken, hashPassword, normalizeEmail, sessionCookieName } from "@/lib/auth"

type ExistingUser = RowDataPacket & {
  id: number
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fullName = String(body.fullName || "").trim()
    const email = normalizeEmail(String(body.email || ""))
    const password = String(body.password || "")
    const referralCode = String(body.referralCode || "").trim().toUpperCase()

    if (fullName.length < 2) {
      return NextResponse.json({ ok: false, message: "Le nom complet est obligatoire." }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, message: "Adresse e-mail invalide." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, message: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 })
    }

    const [duplicateRows] = await db.execute<ExistingUser[]>("SELECT id FROM users WHERE email = ? LIMIT 1", [email])
    if (duplicateRows.length > 0) {
      return NextResponse.json({ ok: false, message: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 })
    }

    let referrerId: number | null = null
    if (referralCode) {
      const [refRows] = await db.execute<ExistingUser[]>(
        "SELECT id FROM users WHERE referral_code = ? LIMIT 1",
        [referralCode],
      )
      if (refRows.length === 0) {
        return NextResponse.json({ ok: false, message: "Code de parrainage introuvable." }, { status: 400 })
      }
      referrerId = refRows[0].id
    }

    let ownReferralCode = createReferralCode(fullName)
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const [rows] = await db.execute<ExistingUser[]>("SELECT id FROM users WHERE referral_code = ? LIMIT 1", [
        ownReferralCode,
      ])
      if (rows.length === 0) break
      ownReferralCode = createReferralCode(fullName)
    }

    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (full_name, email, password_hash, referral_code, referred_by_user_id, trial_ends_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 DAY))`,
        [fullName, email, hashPassword(password), ownReferralCode, referrerId],
      )

      const userId = insertResult.insertId
      if (referrerId) {
        await connection.execute(
          `INSERT INTO user_referrals (referrer_user_id, referred_user_id, referral_code, status)
           VALUES (?, ?, ?, 'pending')`,
          [referrerId, userId, referralCode],
        )
      }
      await connection.commit()

      const response = NextResponse.json({
        ok: true,
        message: "Inscription réussie. Bienvenue sur FXMIRROR.",
        user: { id: userId, name: fullName, email, referralCode: ownReferralCode },
      })
      response.cookies.set(sessionCookieName(), createSessionToken({ id: userId, email, name: fullName }), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
      return response
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error("register error", error)
    return NextResponse.json({ ok: false, message: "Impossible de créer le compte pour le moment." }, { status: 500 })
  }
}
