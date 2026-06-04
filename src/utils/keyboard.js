/**
 * keyboard.js — Helper inline keyboard Telegram untuk Data Bot
 *
 * Menyediakan berbagai layout tombol inline yang digunakan
 * di seluruh bot. Semua callback_data menggunakan string pendek
 * agar mudah ditangani di handler.
 *
 * Callback data conventions:
 *   'menu'              → kembali ke menu utama
 *   'report'            → lihat laporan bulanan
 *   'history'           → riwayat transaksi
 *   'sheet'             → buka Google Sheet
 *   'help'              → bantuan
 *   'delete_last'       → hapus transaksi terakhir
 *   'confirm_delete_ID' → konfirmasi hapus transaksi dengan ID tertentu
 *   'cancel_delete'     → batalkan penghapusan
 *
 * @module utils/keyboard
 */

const { Markup } = require('telegraf');

/**
 * Keyboard menu utama — ditampilkan saat pengguna kirim /start atau /menu.
 *
 * Layout:
 *   [📊 Laporan Bulanan] [📋 Riwayat Transaksi]
 *   [📄 Buka Google Sheet] [❓ Bantuan]
 *
 * @returns {object} Telegraf inline keyboard markup
 */
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    // Baris 1: Laporan dan Riwayat
    [
      Markup.button.callback('📊 Laporan Bulanan', 'report'),
      Markup.button.callback('📋 Riwayat Transaksi', 'history'),
    ],
    // Baris 2: Google Sheet dan Bantuan
    [
      Markup.button.callback('📄 Buka Google Sheet', 'sheet'),
      Markup.button.callback('❓ Bantuan', 'help'),
    ],
  ]);
}

/**
 * Keyboard setelah transaksi berhasil disimpan.
 * Memberikan opsi cepat untuk melihat laporan, sheet, hapus, atau kembali.
 *
 * Layout:
 *   [📊 Lihat Laporan] [📄 Google Sheet]
 *   [🗑️ Hapus Transaksi Ini] [📋 Menu Utama]
 *
 * @returns {object} Telegraf inline keyboard markup
 */
function afterTransactionKeyboard() {
  return Markup.inlineKeyboard([
    // Baris 1: Laporan dan Sheet
    [
      Markup.button.callback('📊 Lihat Laporan', 'report'),
      Markup.button.callback('📄 Google Sheet', 'sheet'),
    ],
    // Baris 2: Hapus dan Menu
    [
      Markup.button.callback('🗑️ Hapus Transaksi Ini', 'delete_last'),
      Markup.button.callback('📋 Menu Utama', 'menu'),
    ],
  ]);
}

/**
 * Keyboard konfirmasi penghapusan transaksi.
 * Menyertakan ID transaksi dalam callback data agar handler
 * tahu transaksi mana yang akan dihapus.
 *
 * Layout:
 *   [✅ Ya, Hapus] [❌ Batal]
 *
 * @param {number|string} transactionId - ID transaksi yang akan dihapus
 * @returns {object} Telegraf inline keyboard markup
 */
function confirmDeleteKeyboard(transactionId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ya, Hapus', `confirm_delete_${transactionId}`),
      Markup.button.callback('❌ Batal', 'cancel_delete'),
    ],
  ]);
}

/**
 * Keyboard sederhana untuk kembali ke menu utama.
 * Digunakan setelah menampilkan laporan, bantuan, dsb.
 *
 * Layout:
 *   [📋 Menu Utama]
 *
 * @returns {object} Telegraf inline keyboard markup
 */
function backToMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Menu Utama', 'menu'),
    ],
  ]);
}

module.exports = {
  mainMenuKeyboard,
  afterTransactionKeyboard,
  confirmDeleteKeyboard,
  backToMenuKeyboard,
};
