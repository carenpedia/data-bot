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
    // Belum ada sheet URL — buat otomatis!
    const initMessage = 
      `📄 *Google Sheet*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Spreadsheet kamu belum dibuat. Sedang membuatkan secara otomatis... ⏳\n\n` +
      `Proses ini memakan waktu beberapa detik saja.`;
    
    let statusMsg;
    if (isCallback) {
      statusMsg = await ctx.editMessageText(initMessage, { parse_mode: 'Markdown' });
    } else {
      statusMsg = await ctx.replyWithMarkdown(initMessage);
    }

    try {
      const name = ctx.from.first_name || 'Pengguna';
      // Jalankan pembuatan sheet otomatis
      const sheetUrl = await createAutomatedSheet(name);

      if (sheetUrl) {
        // Simpan ke database
        setSheetUrl(telegramId, sheetUrl);

        const successMessage =
          `📄 *Google Sheet Berhasil Dibuat!*\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `Google Sheet kamu berhasil dibuat otomatis. Klik tombol di bawah untuk membukanya! 📊`;

        const keyboard = sheetKeyboard(sheetUrl);

        // Kirim update pesan sukses
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          null,
          successMessage,
          {
            parse_mode: 'Markdown',
            ...keyboard
          }
        );
      } else {
        throw new Error('Gagal mendapatkan URL Google Sheet');
      }
    } catch (error) {
      console.error('❌ Gagal otomatisasi sheet di /sheet:', error);
      const errorMessage =
        `📄 *Google Sheet*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Maaf, terjadi kesalahan saat membuat Google Sheet otomatis. 😅\n` +
        `Hubungi admin untuk bantuan manual.`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        errorMessage,
        {
          parse_mode: 'Markdown',
          ...backToMenuKeyboard()
        }
      );
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
