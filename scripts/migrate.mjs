import fs from "node:fs"
import path from "node:path"
import mysql from "mysql2/promise"

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"]
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env`)
    process.exit(1)
  }
}

const migrationsDir = path.join(process.cwd(), "backend/migrations")
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
  })

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY schema_migrations_filename_unique (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [appliedRows] = await conn.execute("SELECT filename FROM schema_migrations")
  const applied = new Set(appliedRows.map((r) => r.filename))

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`)
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    console.log(`apply ${file}`)
    await conn.query(sql)
    await conn.execute("INSERT INTO schema_migrations (filename) VALUES (?)", [file])
  }

  await conn.end()
  console.log("Migrations complete.")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
