/**
 * transaction.js — Operasi CRUD transaksi menggunakan SQLite
 *
 * Modul ini mengelola semua operasi database untuk pengguna
 * dan transaksi keuangan. Menggunakan prepared statements
 * untuk performa optimal.
 *
 * Tabel yang digunakan:
 *   - users: data pengguna Telegram
 *   - transactions: catatan transaksi keuangan
 *
 * @module services/transaction
 */

const db = require('../database');

// ============================================================
// PREPARED STATEMENTS
// Di-cache saat pertama kali dipanggil untuk performa optimal.
// better-sqlite3 mendukung .prepare() yang mengembalikan
// objek statement yang bisa digunakan berulang kali.
// ============================================================

// --- User Statements ---

/** Cari user berdasarkan telegram_id */
const stmtGetUser = db.prepare(
  'SELECT * FROM users WHERE telegram_id = ?'
);

/** Insert user baru */
const stmtInsertUser = db.prepare(`
  INSERT INTO users (telegram_id, name, username, is_active, created_at)
  VALUES (?, ?, ?, 1, datetime('now', 'localtime'))
`);

/** Update nama & username user (untuk kasus ganti info) */
const stmtUpdateUserInfo = db.prepare(
  'UPDATE users SET name = ?, username = ? WHERE telegram_id = ?'
);

/** Update sheet_url user */
const stmtSetSheetUrl = db.prepare(
  'UPDATE users SET sheet_url = ? WHERE telegram_id = ?'
);

/** Aktifkan/nonaktifkan user */
const stmtSetUserActive = db.prepare(
  'UPDATE users SET is_active = ? WHERE telegram_id = ?'
);

/** Ambil semua user */
const stmtGetAllUsers = db.prepare(
  'SELECT * FROM users ORDER BY created_at DESC'
);


// --- Transaction Statements ---

/** Simpan transaksi baru */
const stmtInsertTransaction = db.prepare(`
  INSERT INTO transactions (user_id, type, category, description, amount, created_at)
  VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
`);

/** Ambil transaksi berdasarkan ID */
const stmtGetTransaction = db.prepare(
  'SELECT * FROM transactions WHERE id = ?'
);

/** Ambil transaksi terakhir user */
const stmtGetLastTransaction = db.prepare(
  'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
);

/** Hapus transaksi (dengan validasi kepemilikan) */
const stmtDeleteTransaction = db.prepare(
  'DELETE FROM transactions WHERE id = ? AND user_id = ?'
);

/** Ambil transaksi terbaru user dengan limit */
const stmtGetUserTransactions = db.prepare(
  'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
);

// ============================================================
// FUNGSI-FUNGSI PUBLIK
// ============================================================

/**
 * Pastikan user terdaftar di database.
 * Jika belum ada, buat baru. Jika sudah ada, update info namanya/username-nya
 * (untuk menangani kasus user ganti nama/username Telegram).
 *
 * @param {number|string} telegramId - ID Telegram pengguna
 * @param {string} name - Nama pengguna Telegram
 * @param {string} [username] - Username Telegram pengguna (opsional)
 * @returns {object} Baris user dari database
 */
function ensureUser(telegramId, name, username) {
  const existing = stmtGetUser.get(String(telegramId));

  if (existing) {
    // Update nama atau username jika ada perubahan
    if ((name && existing.name !== name) || existing.username !== username) {
      stmtUpdateUserInfo.run(name || existing.name, username || null, String(telegramId));
    }
    // Return data terbaru
    return stmtGetUser.get(String(telegramId));
  }

  // User belum ada, buat baru
  stmtInsertUser.run(String(telegramId), name || 'Unknown', username || null);
  return stmtGetUser.get(String(telegramId));
}


/**
 * Simpan transaksi baru ke database.
 *
 * @param {number} userId - ID user di tabel users (bukan telegram_id)
 * @param {object} data - Data transaksi
 * @param {string} data.type - 'income' atau 'expense'
 * @param {string} data.category - Kategori transaksi
 * @param {string} data.description - Deskripsi transaksi
 * @param {number} data.amount - Jumlah uang (dalam Rupiah)
 * @returns {object} Baris transaksi yang baru disimpan (termasuk id)
 */
function saveTransaction(userId, { type, category, description, amount }) {
  const result = stmtInsertTransaction.run(
    userId, type, category, description, amount
  );

  // Kembalikan data lengkap transaksi yang baru dibuat
  return stmtGetTransaction.get(result.lastInsertRowid);
}

/**
 * Ambil transaksi terakhir pengguna.
 * Berguna untuk fitur "hapus transaksi terakhir".
 *
 * @param {number} userId - ID user di tabel users
 * @returns {object|undefined} Data transaksi, atau undefined jika belum ada
 */
function getLastTransaction(userId) {
  return stmtGetLastTransaction.get(userId);
}

/**
 * Ambil transaksi berdasarkan ID.
 * Berguna untuk mengambil data transaksi sebelum dihapus.
 *
 * @param {number} transactionId - ID transaksi
 * @returns {object|undefined} Data transaksi, atau undefined jika tidak ditemukan
 */
function getTransactionById(transactionId) {
  return stmtGetTransaction.get(transactionId);
}

/**
 * Hapus transaksi berdasarkan ID.
 * Hanya bisa menghapus transaksi milik user yang bersangkutan
 * (untuk keamanan).
 *
 * @param {number} transactionId - ID transaksi yang akan dihapus
 * @param {number} userId - ID user pemilik transaksi
 * @returns {boolean} true jika berhasil dihapus, false jika tidak ditemukan
 */
function deleteTransaction(transactionId, userId) {
  const result = stmtDeleteTransaction.run(transactionId, userId);
  // changes > 0 berarti ada baris yang terhapus
  return result.changes > 0;
}

/**
 * Ambil daftar transaksi terbaru pengguna.
 *
 * @param {number} userId - ID user di tabel users
 * @param {number} [limit=10] - Jumlah maksimal transaksi yang diambil
 * @returns {Array<object>} Array transaksi, diurutkan dari terbaru
 */
function getUserTransactions(userId, limit = 10) {
  return stmtGetUserTransactions.all(userId, limit);
}

/**
 * Ambil data user berdasarkan telegram_id atau username.
 *
 * @param {number|string} identifier - ID Telegram atau Username pengguna (dengan atau tanpa @)
 * @returns {object|undefined} Data user, atau undefined jika tidak ditemukan
 */
function getUser(identifier) {
  if (identifier === undefined || identifier === null) return undefined;
  
  const target = String(identifier).trim();
  
  // Jika target diawali dengan @ atau bukan angka murni, kita cari berdasarkan username
  if (target.startsWith('@') || isNaN(Number(target))) {
    const username = target.startsWith('@') ? target.slice(1) : target;
    return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
  }
  
  // Cari berdasarkan telegram_id
  return stmtGetUser.get(target);
}

/**
 * Set URL Google Sheet untuk pengguna.
 *
 * @param {number|string} identifier - ID Telegram atau Username pengguna
 * @param {string} url - URL Google Sheet
 */
function setSheetUrl(identifier, url) {
  const user = getUser(identifier);
  if (user) {
    stmtSetSheetUrl.run(url, String(user.telegram_id));
  }
}

/**
 * Aktifkan atau nonaktifkan user.
 *
 * @param {number|string} identifier - ID Telegram atau Username pengguna
 * @param {boolean} isActive - true untuk aktifkan, false untuk nonaktifkan
 */
function setUserActive(identifier, isActive) {
  const user = getUser(identifier);
  if (user) {
    stmtSetUserActive.run(isActive ? 1 : 0, String(user.telegram_id));
  }
}


/**
 * Ambil semua user di database.
 * Digunakan untuk keperluan admin.
 *
 * @returns {Array<object>} Array semua user
 */
function getAllUsers() {
  return stmtGetAllUsers.all();
}

module.exports = {
  ensureUser,
  saveTransaction,
  getLastTransaction,
  getTransactionById,
  deleteTransaction,
  getUserTransactions,
  getUser,
  setSheetUrl,
  setUserActive,
  getAllUsers,
};
