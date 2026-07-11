import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sqlite3 from 'sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const migrationPath = path.resolve(__dirname, '../prisma/migrations/20260416120000_measurements_as_text/migration.sql')
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../app.db')

async function run() {
  try {
    const sql = await fs.readFile(migrationPath, 'utf8')
    if (!sql.trim()) {
      console.error('Migration file is empty:', migrationPath)
      process.exit(1)
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, err => {
      if (err) {
        console.error('Failed to open database:', dbPath)
        console.error(err)
        process.exit(1)
      }
    })

    await new Promise((resolve, reject) => {
      db.exec('BEGIN TRANSACTION;', beginErr => {
        if (beginErr) return reject(beginErr)
        db.exec(sql, execErr => {
          if (execErr) {
            db.exec('ROLLBACK;')
            return reject(execErr)
          }
          db.exec('COMMIT;', commitErr => {
            if (commitErr) return reject(commitErr)
            resolve()
          })
        })
      })
    })

    db.close()
    console.log('Migration applied successfully:', migrationPath)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

run()
