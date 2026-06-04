// ============================================
// DATABASE — Setup SQLite & Skema Tabel
// ============================================
const Database = require('better-sqlite3');
const path = require('path');

// Buat koneksi ke database SQLite
const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Aktifkan WAL mode untuk performa lebih baik
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================
// BUAT TABEL
// ============================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    name TEXT,
    username TEXT,
    sheet_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );
`);

// Jalankan migrasi jika kolom username belum ada
try {
  db.exec("ALTER TABLE users ADD COLUMN username TEXT");
  console.log("✅ Migrasi database: Kolom 'username' berhasil ditambahkan!");
} catch (e) {
  // Kolom sudah ada, abaikan error
}

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category TEXT DEFAULT 'Lainnya',
    description TEXT,
    amount INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user 
    ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_created 
    ON transactions(created_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_type 
    ON transactions(user_id, type);
`);

console.log('✅ Database siap digunakan!');

module.exports = db;
