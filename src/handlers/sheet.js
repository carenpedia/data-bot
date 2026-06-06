// ============================================
// HANDLER: /sheet — Link Google Sheet User
// ============================================
// Menampilkan tombol untuk membuka Google Sheet
// milik user. Jika belum diatur, tampilkan pesan
// bahwa sheet belum tersedia.
// ============================================

const { Markup } = require('telegraf');
const { getUser } = require('../services/transaction');
const { backToMenuKeyboard } = require('../utils/keyboard');

/**
 * Membuat keyboard dengan tombol URL ke Google Sheet dan tombol menu.
 * @param {string} sheetUrl - URL Google Sheet user
 * @returns {object} Inline keyboard markup
 */
function sheetKeyboard(sheetUrl) {
  return Markup.inlineKeyboard([
    [Markup.button.url('📊 Buka Google Sheet', sheetUrl)],
    [Markup.button.callback('📋 Menu Utama', 'menu')],
  ]);
}

const { createAutomatedSheet } = require('../services/googleSheets');
const { setSheetUrl } = require('../services/transaction');

/**
 * Mengirim atau mengedit pesan sheet berdasarkan status sheet user.
 * @param {object} ctx - Telegraf context
 * @param {boolean} isCallback - Apakah ini dari callback query
 */
async function sendSheetMessage(ctx, isCallback = false) {
  const telegramId = ctx.from.id;
  const user = getUser(telegramId);

  if (user && user.sheet_url) {
    // User punya sheet URL — tampilkan tombol buka
    const message =
      `📄 *Google Sheet Kamu*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Klik tombol di bawah untuk membuka\n` +
      `spreadsheet keuanganmu! 📊`;

    const keyboard = sheetKeyboard(user.sheet_url);

    if (isCallback) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } else {
      await ctx.replyWithMarkdown(message, keyboard);
    }
  } else {
    // Belum ada sheet URL — tampilkan info
    const message =
      `📄 *Google Sheet*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Maaf, Google Sheet kamu belum diatur. 😅\n` +
      `Hubungi admin untuk mengaktifkan fitur ini!`;

    if (isCallback) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard(),
      });
    } else {
      await ctx.replyWithMarkdown(message, backToMenuKeyboard());
    }
  }
}

/**
 * Mendaftarkan handler /sheet dan callback 'sheet' pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  // Handle perintah /sheet
  bot.command('sheet', async (ctx) => {
    try {
      await sendSheetMessage(ctx, false);
    } catch (error) {
      console.error('❌ Error di /sheet:', error);
      await ctx.reply('Waduh, ada error nih 😅 Coba lagi ya!');
    }
  });

  // Handle callback query saat tombol 'Google Sheet' ditekan
  bot.action('sheet', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await sendSheetMessage(ctx, true);
    } catch (error) {
      console.error('❌ Error di callback sheet:', error);
      try {
        await sendSheetMessage(ctx, false);
      } catch (fallbackError) {
        console.error('❌ Fallback sheet juga gagal:', fallbackError);
      }
    }
  });
}

module.exports = { register };
