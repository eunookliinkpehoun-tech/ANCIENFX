import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto"

const SESSION_COOKIE = "fxmirror_session"

export type SessionUser = {
  id: number
  email: string
  name: string
}

function secret() {
  const value = process.env.SECRET_KEY
  if (!value) throw new Error("Missing SECRET_KEY environment variable")
  return value
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(":")
  if (scheme !== "scrypt" || !salt || !hash) return false

  const expected = Buffer.from(hash, "hex")
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function createReferralCode(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase()

  return `${base || "FX"}${randomBytes(4).toString("hex").toUpperCase()}`
}

export function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }),
  ).toString("base64url")
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifySessionToken(token: string): SessionUser | null {
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url")
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number }
  if (!parsed.exp || parsed.exp < Date.now()) return null

  return { id: parsed.id, email: parsed.email, name: parsed.name }
}

export function sessionCookieName() {
  return SESSION_COOKIE
}
