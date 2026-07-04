import mysql from "mysql2/promise"

const requiredEnv = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"] as const

function readDbConfig() {
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing database environment variable: ${key}`)
    }
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  }
}

declare global {
  // eslint-disable-next-line no-var
  var fxmirrorDbPool: mysql.Pool | undefined
}

export const db = globalThis.fxmirrorDbPool ?? mysql.createPool(readDbConfig())

if (process.env.NODE_ENV !== "production") {
  globalThis.fxmirrorDbPool = db
}
