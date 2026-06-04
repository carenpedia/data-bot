// ============================================
// HANDLER: /laporan — Laporan Keuangan Bulanan
// ============================================
// Menampilkan ringkasan keuangan bulanan:
// total pemasukan, pengeluaran, saldo, breakdown
// per kategori, dan daftar transaksi terakhir.
// ============================================

const { getMonthlySummary, getCategoryBreakdown, getRecentTransactions } = require('../services/summary');
const { formatRupiah, formatDate } = require('../utils/formatter');
const { backToMenuKeyboard } = require('../utils/keyboard');
const { Markup } = require('telegraf');

// Mapping emoji untuk setiap kategori transaksi
const CATEGORY_EMOJI = {
  'Makanan': '🍽️',
  'Transportasi': '🚗',
  'Tagihan': '📱',
  'Belanja': '🛍️',
  'Kesehatan': '💊',
  'Pendidikan': '📚',
  'Hiburan': '🎮',
  'Gaji': '💼',
  'Penjualan': '🏪',
  'Bonus': '🎁',
  'Freelance': '💻',
  'Transfer': '🔄',
  'Lainnya': '📦',
};

/**
 * Mendapatkan emoji untuk kategori tertentu.
 * @param {string} category - Nama kategori
 * @returns {string} Emoji yang sesuai
 */
function getCategoryEmoji(category) {
  return CATEGORY_EMOJI[category] || '📦';
}

/**
 * Mendapatkan nama bulan dalam Bahasa Indonesia.
 * @param {number} month - Nomor bulan (0-11)
 * @returns {string} Nama bulan
 */
function getMonthName(month) {
  const months = [
    'Januari', 'Februari', 'Maret', 'April',
    'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 'Desember',
  ];
  return months[month];
}

/**
 * Membangun pesan laporan keuangan bulanan.
 * @param {number} telegramId - Telegram ID user
 * @returns {string} Pesan laporan yang diformat
 */
function buildReportMessage(telegramId) {
  // Ambil data ringkasan bulanan
  const summary = getMonthlySummary(telegramId);
  const categories = getCategoryBreakdown(telegramId);
  const recentTrx = getRecentTransactions(telegramId, 5);

  // Tentukan bulan dan tahun saat ini
  const now = new Date();
  const monthName = getMonthName(now.getMonth());
  const year = now.getFullYear();

  // Header laporan
  let message =
    `📊 *Laporan Keuangan*\n` +
    `📅 Bulan: ${monthName} ${year}\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n`;

  // Ringkasan keuangan
  message +=
    `💰 Pemasukan: ${formatRupiah(summary.totalIncome)}\n` +
    `💸 Pengeluaran: ${formatRupiah(summary.totalExpense)}\n` +
    `💵 Sisa Saldo: ${formatRupiah(summary.balance)}\n` +
    `📝 Total Transaksi: ${summary.transactionCount}\n`;

  // Breakdown pengeluaran per kategori (jika ada)
  if (categories && categories.length > 0) {
    message += `\n📂 *Pengeluaran per Kategori:*\n`;
    for (const cat of categories) {
      const emoji = getCategoryEmoji(cat.category);
      message += `${emoji} ${cat.category}: ${formatRupiah(cat.total)} (${cat.count}x)\n`;
    }
  }

  // Daftar transaksi terakhir (jika ada)
  if (recentTrx && recentTrx.length > 0) {
    message += `\n📋 *${recentTrx.length} Transaksi Terakhir:*\n`;
    for (const trx of recentTrx) {
      const icon = trx.type === 'income' ? '💰' : '💸';
      const dateStr = formatDate(trx.created_at);
      message += `• ${icon} ${trx.description} — ${formatRupiah(trx.amount)} (${dateStr})\n`;
    }
  }

  message += `━━━━━━━━━━━━━━━━━━━`;

  // Jika tidak ada transaksi sama sekali
  if (summary.transactionCount === 0) {
    message =
      `📊 *Laporan Keuangan*\n` +
      `📅 Bulan: ${monthName} ${year}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Belum ada transaksi bulan ini 😅\n` +
      `Yuk mulai catat keuanganmu!\n\n` +
      `Contoh: "beli bakso 10rb"\n` +
      `━━━━━━━━━━━━━━━━━━━`;
  }

  return message;
}

/**
 * Keyboard untuk laporan: tombol riwayat & menu utama.
 * @returns {object} Inline keyboard markup
 */
function reportKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📜 Riwayat Lengkap', 'history')],
    [Markup.button.callback('📋 Menu Utama', 'menu')],
  ]);
}

/**
 * Membangun pesan riwayat transaksi (10 terakhir).
 * @param {number} telegramId - Telegram ID user
 * @returns {string} Pesan riwayat yang diformat
 */
function buildHistoryMessage(telegramId) {
  const recentTrx = getRecentTransactions(telegramId, 10);

  if (!recentTrx || recentTrx.length === 0) {
    return (
      `📜 *Riwayat Transaksi*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Belum ada transaksi yang tercatat 😅\n` +
      `━━━━━━━━━━━━━━━━━━━`
    );
  }

  let message =
    `📜 *Riwayat Transaksi*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Menampilkan ${recentTrx.length} transaksi terakhir:\n\n`;

  for (const trx of recentTrx) {
    const icon = trx.type === 'income' ? '💰' : '💸';
    const typeLabel = trx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    const dateStr = formatDate(trx.created_at);
    const emoji = getCategoryEmoji(trx.category);

    message +=
      `${icon} *${trx.description}*\n` +
      `   ${emoji} ${trx.category} ┃ ${formatRupiah(trx.amount)} ┃ ${dateStr}\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━`;
  return message;
}

/**
 * Mendaftarkan handler /laporan, callback 'report', dan callback 'history' pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  // Handle perintah /laporan
  bot.command('laporan', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const message = buildReportMessage(telegramId);
      await ctx.replyWithMarkdown(message, reportKeyboard());
    } catch (error) {
      console.error('❌ Error di /laporan:', error);
      await ctx.reply('Waduh, gagal bikin laporan nih 😅 Coba lagi ya!');
    }
  });

  // Handle callback query saat tombol 'Laporan' ditekan dari menu
  bot.action('report', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const message = buildReportMessage(telegramId);
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...reportKeyboard(),
      });
    } catch (error) {
      console.error('❌ Error di callback report:', error);
      try {
        const telegramId = ctx.from.id;
        const message = buildReportMessage(telegramId);
        await ctx.replyWithMarkdown(message, reportKeyboard());
      } catch (fallbackError) {
        console.error('❌ Fallback report juga gagal:', fallbackError);
      }
    }
  });

  // Handle callback query untuk riwayat transaksi lengkap
  bot.action('history', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const message = buildHistoryMessage(telegramId);
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard(),
      });
    } catch (error) {
      console.error('❌ Error di callback history:', error);
      try {
        const telegramId = ctx.from.id;
        const message = buildHistoryMessage(telegramId);
        await ctx.replyWithMarkdown(message, backToMenuKeyboard());
      } catch (fallbackError) {
        console.error('❌ Fallback history juga gagal:', fallbackError);
      }
    }
  });
}

module.exports = { register };
