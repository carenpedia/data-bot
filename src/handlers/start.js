// ============================================
// HANDLER: /start — Sambutan Pertama Kali
// ============================================
// Handler ini dijalankan saat user pertama kali
// mengirim /start. Mendaftarkan user baru jika
// belum ada, lalu menampilkan pesan selamat datang.
// ============================================

const { ensureUser } = require('../services/transaction');
const { mainMenuKeyboard } = require('../utils/keyboard');

/**
 * Mendaftarkan handler /start pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  bot.start(async (ctx) => {
    try {
      // Pastikan user terdaftar di database
      const telegramId = ctx.from.id;
      const name = ctx.from.first_name || 'Pengguna';
      const username = ctx.from.username || null;
      const user = ensureUser(telegramId, name, username);

      // Buat Google Sheet otomatis di background (jika belum ada)
      if (!user.sheet_url) {
        const { createAutomatedSheet } = require('../services/googleSheets');
        const { setSheetUrl } = require('../services/transaction');
        createAutomatedSheet(name).then((url) => {
          if (url) {
            setSheetUrl(telegramId, url);
            console.log(`✅ Otomatis membuat Google Sheet untuk ${name}: ${url}`);
          }
        }).catch(err => console.error('❌ Gagal membuat Google Sheet di background:', err));
      }

      // Kirim pesan sambutan yang hangat
      const welcomeMessage =
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👋 Halo, ${name}! Selamat datang di *Data Bot*!\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Aku adalah asisten keuanganmu yang siap\n` +
        `membantumu mencatat pemasukan & pengeluaran\n` +
        `dengan mudah — cukup ketik seperti chat biasa! 💬\n\n` +
        `📝 *Contoh cara pakai:*\n` +
        `• "beli bakso 10rb"\n` +
        `• "gaji bulan ini 5jt"\n` +
        `• "orderan kaos 200rb"\n\n` +
        `Ketik /menu untuk melihat semua fitur! 🚀\n` +
        `━━━━━━━━━━━━━━━━━━━`;

      await ctx.replyWithMarkdown(welcomeMessage, mainMenuKeyboard());
    } catch (error) {
      console.error('❌ Error di /start:', error);
      await ctx.reply('Waduh, ada error nih 😅 Coba lagi ya!');
    }
  });
}

module.exports = { register };
