// ============================================
// HANDLER: /hapus — Hapus Transaksi Terakhir
// ============================================
// Menampilkan transaksi terakhir user dan
// meminta konfirmasi sebelum menghapusnya.
// Mendukung flow: tampilkan → konfirmasi → hapus.
// ============================================

const { getLastTransaction, deleteTransaction } = require('../services/transaction');
const { formatRupiah, formatDateTime } = require('../utils/formatter');
const { backToMenuKeyboard } = require('../utils/keyboard');
const { Markup } = require('telegraf');

/**
 * Membuat keyboard konfirmasi hapus.
 * @param {number} transactionId - ID transaksi yang akan dihapus
 * @returns {object} Inline keyboard markup
 */
function confirmDeleteKeyboard(transactionId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Ya, Hapus', `confirm_delete_${transactionId}`),
      Markup.button.callback('❌ Batal', 'cancel_delete'),
    ],
  ]);
}

// Mapping emoji untuk kategori (sinkron dengan report.js)
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
 * Menampilkan transaksi terakhir dan tombol konfirmasi.
 * @param {object} ctx - Telegraf context
 * @param {boolean} isCallback - Apakah ini dari callback query
 */
async function showDeleteConfirmation(ctx, isCallback = false) {
  const telegramId = ctx.from.id;
  const lastTrx = getLastTransaction(telegramId);

  if (!lastTrx) {
    // Tidak ada transaksi untuk dihapus
    const noDataMessage =
      `🗑️ *Hapus Transaksi Terakhir*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `Belum ada transaksi yang bisa dihapus 😅`;

    if (isCallback) {
      await ctx.editMessageText(noDataMessage, {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard(),
      });
    } else {
      await ctx.replyWithMarkdown(noDataMessage, backToMenuKeyboard());
    }
    return;
  }

  // Tampilkan detail transaksi terakhir
  const icon = lastTrx.type === 'income' ? '💰' : '💸';
  const categoryEmoji = CATEGORY_EMOJI[lastTrx.category] || '📦';
  const dateStr = formatDateTime(lastTrx.created_at);

  const message =
    `🗑️ *Hapus Transaksi Terakhir*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Transaksi terakhir kamu:\n\n` +
    `${icon} *${lastTrx.description}*\n` +
    `💰 Jumlah: ${formatRupiah(lastTrx.amount)}\n` +
    `${categoryEmoji} Kategori: ${lastTrx.category}\n` +
    `📅 Waktu: ${dateStr}\n\n` +
    `Yakin mau dihapus?`;

  const keyboard = confirmDeleteKeyboard(lastTrx.id);

  if (isCallback) {
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  } else {
    await ctx.replyWithMarkdown(message, keyboard);
  }
}

/**
 * Mendaftarkan handler /hapus dan callback delete pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  // Handle perintah /hapus
  bot.command('hapus', async (ctx) => {
    try {
      await showDeleteConfirmation(ctx, false);
    } catch (error) {
      console.error('❌ Error di /hapus:', error);
      await ctx.reply('Waduh, ada error nih 😅 Coba lagi ya!');
    }
  });

  // Handle callback query dari menu (tombol 'Hapus Terakhir')
  bot.action('delete_last', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await showDeleteConfirmation(ctx, true);
    } catch (error) {
      console.error('❌ Error di callback delete_last:', error);
      try {
        await showDeleteConfirmation(ctx, false);
      } catch (fallbackError) {
        console.error('❌ Fallback delete_last juga gagal:', fallbackError);
      }
    }
  });

  // Handle konfirmasi hapus — callback: confirm_delete_<ID>
  bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const transactionId = parseInt(ctx.match[1], 10);

      // Hapus transaksi dari database
      const deleted = deleteTransaction(transactionId);

      if (deleted) {
        const successMessage =
          `✅ *Transaksi berhasil dihapus!*\n\n` +
          `Data keuanganmu sudah diperbarui 👍`;

        await ctx.editMessageText(successMessage, {
          parse_mode: 'Markdown',
          ...backToMenuKeyboard(),
        });
      } else {
        const failMessage =
          `⚠️ *Gagal menghapus transaksi*\n\n` +
          `Transaksi mungkin sudah dihapus sebelumnya.`;

        await ctx.editMessageText(failMessage, {
          parse_mode: 'Markdown',
          ...backToMenuKeyboard(),
        });
      }
    } catch (error) {
      console.error('❌ Error di confirm_delete:', error);
      await ctx.reply('Waduh, gagal menghapus 😅 Coba lagi ya!');
    }
  });

  // Handle pembatalan hapus
  bot.action('cancel_delete', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const cancelMessage =
        `❌ *Penghapusan dibatalkan.*\n\n` +
        `Transaksi kamu tetap aman! 👌`;

      await ctx.editMessageText(cancelMessage, {
        parse_mode: 'Markdown',
        ...backToMenuKeyboard(),
      });
    } catch (error) {
      console.error('❌ Error di cancel_delete:', error);
      await ctx.reply('Penghapusan dibatalkan ✅');
    }
  });
}

module.exports = { register };
