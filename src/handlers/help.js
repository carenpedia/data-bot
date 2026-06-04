// ============================================
// HANDLER: /help — Panduan Penggunaan
// ============================================
// Menampilkan panduan lengkap cara menggunakan
// Data Bot, termasuk format angka dan semua
// perintah yang tersedia.
// ============================================

const { backToMenuKeyboard } = require('../utils/keyboard');

/**
 * Mendaftarkan handler /help dan callback 'help' pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  // Pesan panduan lengkap
  const helpMessage =
    `❓ *Panduan Penggunaan Data Bot*\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +

    `📝 *MENCATAT PENGELUARAN*\n` +
    `Ketik langsung seperti chat biasa:\n` +
    `• "beli nasi goreng 15rb"\n` +
    `• "bayar listrik 200k"\n` +
    `• "parkir 5000"\n\n` +

    `💰 *MENCATAT PEMASUKAN*\n` +
    `• "gaji bulanan 5jt"\n` +
    `• "orderan baju 150rb"\n` +
    `• "dapat bonus 500k"\n\n` +

    `📊 *PERINTAH LAINNYA*\n` +
    `/menu — Menu utama\n` +
    `/laporan — Laporan keuangan bulanan\n` +
    `/sheet — Buka Google Sheet kamu\n` +
    `/hapus — Hapus transaksi terakhir\n` +
    `/help — Panduan ini\n\n` +

    `💡 *FORMAT ANGKA*\n` +
    `rb/ribu = ribuan (10rb = 10.000)\n` +
    `jt/juta = jutaan (1.5jt = 1.500.000)\n` +
    `k = ribuan (200k = 200.000)\n` +
    `━━━━━━━━━━━━━━━━━━━`;

  // Handle perintah /help
  bot.command('help', async (ctx) => {
    try {
      await ctx.replyWithMarkdown(helpMessage, backToMenuKeyboard());
    } catch (error) {
      console.error('❌ Error di /help:', error);
      await ctx.reply('Waduh, ada error nih 😅 Coba lagi ya!');
    }
  });

  // Handle callback query saat tombol 'Bantuan' ditekan
  bot.action('help', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText(helpMessage, {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard(),
      });
    } catch (error) {
      console.error('❌ Error di callback help:', error);
      try {
        await ctx.replyWithMarkdown(helpMessage, backToMenuKeyboard());
      } catch (fallbackError) {
        console.error('❌ Fallback help juga gagal:', fallbackError);
      }
    }
  });
}

module.exports = { register };
