/**
 * summary.js — Kalkulasi ringkasan keuangan untuk Data Bot
 *
 * Modul ini menyediakan fungsi-fungsi untuk menghitung
 * ringkasan keuangan: bulanan, harian, dan breakdown per kategori.
 * Semua query menggunakan SQL aggregation agar efisien.
 *
 * Tanggal menggunakan localtime untuk konsistensi zona waktu Indonesia.
 *
 * @module services/summary
 */

const db = require('../database');

// ============================================================
// PREPARED STATEMENTS — Ringkasan Bulanan
// ============================================================

/** Total pemasukan per bulan */
const stmtMonthlyIncome = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE user_id = ?
    AND type = 'income'
    AND strftime('%m', created_at) = ?
    AND strftime('%Y', created_at) = ?
`);

/** Total pengeluaran per bulan */
const stmtMonthlyExpense = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE user_id = ?
    AND type = 'expense'
    AND strftime('%m', created_at) = ?
    AND strftime('%Y', created_at) = ?
`);

/** Jumlah transaksi per bulan */
const stmtMonthlyCount = db.prepare(`
  SELECT COUNT(*) AS count
  FROM transactions
  WHERE user_id = ?
    AND strftime('%m', created_at) = ?
    AND strftime('%Y', created_at) = ?
`);

/** Kategori pengeluaran terbesar per bulan */
const stmtTopExpenseCategory = db.prepare(`
  SELECT category AS name, SUM(amount) AS amount
  FROM transactions
  WHERE user_id = ?
    AND type = 'expense'
    AND strftime('%m', created_at) = ?
    AND strftime('%Y', created_at) = ?
  GROUP BY category
  ORDER BY amount DESC
  LIMIT 1
`);

/** Kategori pemasukan terbesar per bulan */
const stmtTopIncomeCategory = db.prepare(`
  SELECT category AS name, SUM(amount) AS amount
  FROM transactions
  WHERE user_id = ?
    AND type = 'income'
    AND strftime('%m', created_at) = ?
    AND strftime('%Y', created_at) = ?
  GROUP BY category
  ORDER BY amount DESC
  LIMIT 1
`);

// ============================================================
// PREPARED STATEMENTS — Ringkasan Harian
// ============================================================

/** Total pemasukan hari ini */
const stmtDailyIncome = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE user_id = ?
    AND type = 'income'
    AND date(created_at) = date('now', 'localtime')
`);

/** Total pengeluaran hari ini */
const stmtDailyExpense = db.prepare(`
  SELECT COALESCE(SUM(amount), 0) AS total
  FROM transactions
  WHERE user_id = ?
    AND type = 'expense'
    AND date(created_at) = date('now', 'localtime')
`);

/** Jumlah transaksi hari ini */
const stmtDailyCount = db.prepare(`
  SELECT COUNT(*) AS count
  FROM transactions
  WHERE user_id = ?
    AND date(created_at) = date('now', 'localtime')
`);

// ============================================================
// PREPARED STATEMENTS — Breakdown Kategori
// ============================================================

/** Breakdown per kategori untuk tipe dan bulan tertentu */
const stmtCategoryBreakdown = db.prepare(`
  SELECT category, SUM(amount) AS total, COUNT(*) AS count
  FROM transactions
  WHERE user_id = ?
    AND type = ?
    AND strftime('%m', created_at) = ?
    AND strftime('%Y', created_at) = ?
  GROUP BY category
  ORDER BY total DESC
`);

// ============================================================
// PREPARED STATEMENTS — Transaksi Terbaru
// ============================================================

/** Ambil transaksi terbaru dengan semua kolom */
const stmtRecentTransactions = db.prepare(`
  SELECT *
  FROM transactions
  WHERE user_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

// ============================================================
// HELPER — Format bulan dan tahun ke string yang dipakai SQLite
// ============================================================

/**
 * Pad angka menjadi 2 digit string.
 * Contoh: 6 → '06', 12 → '12'
 *
 * @param {number} num - Angka yang akan di-pad
 * @returns {string} String 2 digit
 * @private
 */
function padTwo(num) {
  return String(num).padStart(2, '0');
}

// ============================================================
// FUNGSI-FUNGSI PUBLIK
// ============================================================

/**
 * Hitung ringkasan keuangan bulanan untuk seorang user.
 *
 * Mengembalikan:
 *   - totalIncome: total pemasukan bulan ini
 *   - totalExpense: total pengeluaran bulan ini
 *   - balance: selisih (pemasukan - pengeluaran)
 *   - transactionCount: jumlah transaksi
 *   - topExpenseCategory: kategori pengeluaran terbesar { name, amount }
 *   - topIncomeCategory: kategori pemasukan terbesar { name, amount }
 *
 * @param {number} userId - ID user di tabel users
 * @param {number} [month] - Bulan (1-12). Default: bulan saat ini
 * @param {number} [year] - Tahun (misal 2026). Default: tahun saat ini
 * @returns {object} Objek ringkasan bulanan
 */
function getMonthlySummary(userId, month, year) {
  // Default ke bulan dan tahun saat ini jika tidak disediakan
  const now = new Date();
  const m = padTwo(month || (now.getMonth() + 1));
  const y = String(year || now.getFullYear());

  // Hitung total pemasukan
  const totalIncome = stmtMonthlyIncome.get(userId, m, y).total;

  // Hitung total pengeluaran
  const totalExpense = stmtMonthlyExpense.get(userId, m, y).total;

  // Hitung jumlah transaksi
  const transactionCount = stmtMonthlyCount.get(userId, m, y).count;

  // Cari kategori pengeluaran terbesar
  const topExpenseRow = stmtTopExpenseCategory.get(userId, m, y);
  const topExpenseCategory = topExpenseRow
    ? { name: topExpenseRow.name, amount: topExpenseRow.amount }
    : { name: '-', amount: 0 };

  // Cari kategori pemasukan terbesar
  const topIncomeRow = stmtTopIncomeCategory.get(userId, m, y);
  const topIncomeCategory = topIncomeRow
    ? { name: topIncomeRow.name, amount: topIncomeRow.amount }
    : { name: '-', amount: 0 };

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    transactionCount,
    topExpenseCategory,
    topIncomeCategory,
  };
}

/**
 * Hitung ringkasan keuangan hari ini untuk seorang user.
 *
 * @param {number} userId - ID user di tabel users
 * @returns {object} Objek ringkasan harian
 *   { totalIncome, totalExpense, balance, transactionCount }
 */
function getDailySummary(userId) {
  const totalIncome = stmtDailyIncome.get(userId).total;
  const totalExpense = stmtDailyExpense.get(userId).total;
  const transactionCount = stmtDailyCount.get(userId).count;

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    transactionCount,
  };
}

/**
 * Breakdown pengeluaran/pemasukan per kategori untuk bulan tertentu.
 * Hasilnya diurutkan dari total terbesar.
 *
 * @param {number} userId - ID user di tabel users
 * @param {'income'|'expense'} type - Tipe transaksi
 * @param {number} [month] - Bulan (1-12). Default: bulan saat ini
 * @param {number} [year] - Tahun. Default: tahun saat ini
 * @returns {Array<{ category: string, total: number, count: number }>}
 *   Array kategori dengan total dan jumlah transaksi
 */
function getCategoryBreakdown(userId, type, month, year) {
  const now = new Date();
  const m = padTwo(month || (now.getMonth() + 1));
  const y = String(year || now.getFullYear());

  return stmtCategoryBreakdown.all(userId, type, m, y);
}

/**
 * Ambil transaksi terbaru user dengan semua field.
 *
 * @param {number} userId - ID user di tabel users
 * @param {number} [limit=5] - Jumlah maksimal transaksi
 * @returns {Array<object>} Array transaksi terbaru
 */
function getRecentTransactions(userId, limit = 5) {
  return stmtRecentTransactions.all(userId, limit);
}

module.exports = {
  getMonthlySummary,
  getDailySummary,
  getCategoryBreakdown,
  getRecentTransactions,
};
