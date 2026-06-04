// ============================================
// HANDLER: /menu — Menu Utama Data Bot
// ============================================
// Menampilkan menu navigasi utama dengan
// inline keyboard. Bisa diakses via command
// /menu atau callback query 'menu'.
// ============================================

const { mainMenuKeyboard } = require('../utils/keyboard');

/**
 * Mendaftarkan handler /menu dan callback 'menu' pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  // Pesan menu yang ditampilkan
  const menuMessage =
    `📋 *Menu Utama Data Bot*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Pilih menu yang kamu butuhkan:`;

  // Handle perintah /menu
  bot.command('menu', async (ctx) => {
    try {
      await ctx.replyWithMarkdown(menuMessage, mainMenuKeyboard());
    } catch (error) {
      console.error('❌ Error di /menu:', error);
      await ctx.reply('Waduh, ada error nih 😅 Coba lagi ya!');
    }
  });

  // Handle callback query saat tombol 'Menu Utama' ditekan
  bot.action('menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.editMessageText(menuMessage, {
        parse_mode: 'Markdown',
        ...mainMenuKeyboard(),
      });
    } catch (error) {
      console.error('❌ Error di callback menu:', error);
      // Fallback: kirim pesan baru jika edit gagal
      try {
        await ctx.replyWithMarkdown(menuMessage, mainMenuKeyboard());
      } catch (fallbackError) {
        console.error('❌ Fallback menu juga gagal:', fallbackError);
      }
    }
  });
}

module.exports = { register };
