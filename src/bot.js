// ============================================
// BOT.JS — Setup Bot Telegram & Routing Pesan
// ============================================
const { Telegraf } = require('telegraf');

// Import handlers
const startHandler = require('./handlers/start');
const menuHandler = require('./handlers/menu');
const helpHandler = require('./handlers/help');
const sheetHandler = require('./handlers/sheet');
const reportHandler = require('./handlers/report');
const deleteHandler = require('./handlers/delete');
const adminHandler = require('./handlers/admin');

// Import services
const { parseTransaction } = require('./services/parser');
const { ensureUser, saveTransaction, getUser } = require('./services/transaction');
const { getMonthlySummary } = require('./services/summary');
const { formatRupiah } = require('./utils/formatter');
const { afterTransactionKeyboard } = require('./utils/keyboard');

/**
 * Membuat dan mengkonfigurasi bot Telegram
 * @param {string} token - Token bot dari BotFather
 * @returns {Telegraf} Instance bot yang sudah dikonfigurasi
 */
function createBot(token) {
  const bot = new Telegraf(token);

  // ============================================
  // MIDDLEWARE — Logging & User Check
  // ============================================
  bot.use(async (ctx, next) => {
    // Log setiap pesan masuk (untuk debugging)
    if (ctx.message && ctx.message.text) {
      const userName = ctx.from.first_name || 'Unknown';
      console.log(`📨 [${userName}] (${ctx.from.id}): ${ctx.message.text}`);
    }
    return next();
  });

  // ============================================
  // REGISTRASI SEMUA HANDLER
  // ============================================
  startHandler.register(bot);
  menuHandler.register(bot);
  helpHandler.register(bot);
  sheetHandler.register(bot);
  reportHandler.register(bot);
  deleteHandler.register(bot);
  adminHandler.register(bot);

  // ============================================
  // HANDLER TRANSAKSI — Natural Language Processing
  // ============================================
  // Handler ini HARUS didaftarkan TERAKHIR karena menangkap
  // semua pesan teks yang bukan command
  bot.on('text', async (ctx) => {
    try {
      const text = ctx.message.text;

      // Abaikan pesan yang dimulai dengan '/' (command)
      if (text.startsWith('/')) return;

      // Pastikan user terdaftar di database (di awal agar bisa akses nama/id user)
      const user = ensureUser(ctx.from.id, ctx.from.first_name, ctx.from.username);

      // Cek apakah user aktif
      if (!user.is_active) {
        await ctx.reply(
          `⚠️ Maaf, akun Tuan sedang tidak aktif.\n` +
          `Hubungi admin untuk mengaktifkan kembali.`
        );
        return;
      }

      // Coba parse pesan sebagai transaksi
      const parsed = parseTransaction(text);

      // Jika bukan format transaksi yang valid, cek apakah ini obrolan santai
      if (!parsed) {
        const { getChatResponse } = require('./services/chat');
        const chatResponse = await getChatResponse(text, user);
        
        if (chatResponse) {
          // Jika ada respon obrolan
          await ctx.replyWithMarkdown(chatResponse);
        } else {
          // Jika tidak dikenali sama sekali
          await ctx.reply(
            `🤔 Hmm, aku belum paham maksud Tuan nih...\n\n` +
            `💡 Kalau mau catat transaksi, coba ketik:\n` +
            `• "beli bakso 10rb" (pengeluaran)\n` +
            `• "gaji bulan ini 5jt" (pemasukan)\n` +
            `• "orderan baju 200rb" (pemasukan)\n\n` +
            `Atau ketik /help untuk panduan lengkap! 😊`
          );
        }
        return;
      }

      // Simpan transaksi ke database
      const transaction = saveTransaction(ctx.from.id, parsed);

      // Sinkronisasikan ke Google Sheet (jika ada sheet_url)
      if (user.sheet_url) {
        const { appendTransactionToSheet } = require('./services/googleSheets');
        appendTransactionToSheet(user.sheet_url, transaction).catch(err => 
          console.error('❌ Gagal sinkronisasi transaksi ke Google Sheet:', err)
        );
      }

      // Ambil ringkasan bulanan terkini
      const summary = getMonthlySummary(ctx.from.id);

      // Tentukan emoji berdasarkan tipe transaksi
      const typeEmoji = parsed.type === 'income' ? '💰' : '💸';
      const typeLabel = parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const categoryEmoji = getCategoryEmoji(parsed.category);

      // Kirim balasan interaktif
      const message =
        `━━━━━━━━━━━━━━━━━━━\n` +
        `✅ ${typeLabel} Tercatat!\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `${categoryEmoji} Kategori: ${parsed.category}\n` +
        `📝 Keterangan: ${parsed.description}\n` +
        `${typeEmoji} Jumlah: ${formatRupiah(parsed.amount)}\n\n` +
        `📊 Ringkasan Bulan Ini:\n` +
        `💰 Pemasukan: ${formatRupiah(summary.totalIncome)}\n` +
        `💸 Pengeluaran: ${formatRupiah(summary.totalExpense)}\n` +
        `💵 Sisa Saldo: ${formatRupiah(summary.balance)}\n` +
        `━━━━━━━━━━━━━━━━━━━`;

      await ctx.reply(message, afterTransactionKeyboard());

    } catch (error) {
      console.error('❌ Error memproses transaksi:', error);
      await ctx.reply(
        `😵 Ups, ada kesalahan teknis!\n` +
        `Coba lagi ya, atau ketik /help untuk bantuan.`
      );
    }
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  bot.catch((err, ctx) => {
    console.error(`❌ Error untuk user ${ctx.from?.id}:`, err);
    ctx.reply('😵 Maaf, terjadi kesalahan. Coba lagi ya!').catch(() => {});
  });

  return bot;
}

/**
 * Mapping emoji berdasarkan kategori transaksi
 */
function getCategoryEmoji(category) {
  const emojiMap = {
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
  return emojiMap[category] || '📦';
}

module.exports = { createBot, getCategoryEmoji };
