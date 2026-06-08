// ============================================
// HANDLER: Admin — Perintah Khusus Admin
// ============================================
// Perintah-perintah untuk mengelola user bot
// dalam fase beta. Hanya bisa diakses oleh
// admin yang ID-nya tercatat di env ADMIN_ID.
// ============================================

const { ensureUser, getUser, setSheetUrl, setUserActive, getAllUsers, getUserTransactions } = require('../services/transaction');
const { formatDate } = require('../utils/formatter');

/**
 * Mendaftarkan semua perintah admin pada bot.
 * @param {import('telegraf').Telegraf} bot - Instance Telegraf bot
 */
function register(bot) {
  /**
   * Cek apakah pengirim pesan adalah admin.
   * @param {object} ctx - Telegraf context
   * @returns {boolean} true jika admin
   */
  const isAdmin = (ctx) => {
    return String(ctx.from.id) === String(process.env.ADMIN_ID);
  };

  /**
   * Kirim pesan ditolak jika bukan admin.
   * @param {object} ctx - Telegraf context
   * @returns {boolean} true jika bukan admin (akses ditolak)
   */
  const denyIfNotAdmin = async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply('⛔ Maaf, kamu tidak memiliki akses admin.');
      return true;
    }
    return false;
  };

  // ──────────────────────────────
  // /admin — Tampilkan Panel Admin
  // ──────────────────────────────
  bot.command('admin', async (ctx) => {
    try {
      if (await denyIfNotAdmin(ctx)) return;

      const message =
        `🔐 *Panel Admin Data Bot*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Daftar Perintah Admin:*\n\n` +
        `/daftar ID NAMA — Daftarkan user baru\n` +
        `/setsheet ID URL — Atur Google Sheet user\n` +
        `/users — Lihat semua user terdaftar\n` +
        `/aktif ID — Aktifkan user\n` +
        `/nonaktif ID — Nonaktifkan user\n` +
        `━━━━━━━━━━━━━━━━━━━`;

      await ctx.replyWithMarkdown(message);
    } catch (error) {
      console.error('❌ Error di /admin:', error);
      await ctx.reply('Terjadi error saat membuka panel admin.');
    }
  });

  // ──────────────────────────────
  // /daftar <telegram_id> <nama>
  // Daftarkan user baru
  // ──────────────────────────────
  bot.command('daftar', async (ctx) => {
    try {
      if (await denyIfNotAdmin(ctx)) return;

      // Parse argumen: /daftar <id> <nama>
      const args = ctx.message.text.split(/\s+/).slice(1);

      if (args.length < 2) {
        await ctx.reply(
          '⚠️ Format salah!\n\n' +
          '📝 Cara pakai:\n' +
          '/daftar <telegram_id> <nama>\n\n' +
          '📌 Contoh:\n' +
          '/daftar 123456789 Budi Santoso'
        );
        return;
      }

      const telegramId = parseInt(args[0], 10);
      if (isNaN(telegramId)) {
        await ctx.reply('⚠️ Telegram ID harus berupa angka!');
        return;
      }

      // Nama bisa terdiri dari beberapa kata
      const name = args.slice(1).join(' ');

      // Cek apakah user sudah terdaftar
      const existingUser = getUser(telegramId);
      if (existingUser) {
        await ctx.reply(
          `⚠️ User sudah terdaftar!\n\n` +
          `👤 Nama: ${existingUser.name}\n` +
          `🆔 ID: ${existingUser.telegram_id}\n` +
          `📊 Status: ${existingUser.is_active ? '✅ Aktif' : '❌ Nonaktif'}`
        );
        return;
      }

      // Daftarkan user baru
      ensureUser(telegramId, name);

      await ctx.reply(
        `✅ User berhasil didaftarkan!\n\n` +
        `👤 Nama: ${name}\n` +
        `🆔 Telegram ID: ${telegramId}\n` +
        `📊 Status: ✅ Aktif`
      );
    } catch (error) {
      console.error('❌ Error di /daftar:', error);
      await ctx.reply('Terjadi error saat mendaftarkan user.');
    }
  });

  // ──────────────────────────────
  // /setsheet <telegram_id_atau_username> <sheet_url>
  // Atur Google Sheet URL untuk user
  // ──────────────────────────────
  bot.command('setsheet', async (ctx) => {
    try {
      if (await denyIfNotAdmin(ctx)) return;

      const args = ctx.message.text.split(/\s+/).slice(1);

      if (args.length < 2) {
        await ctx.reply(
          '⚠️ Format salah!\n\n' +
          '📝 Cara pakai:\n' +
          '/setsheet <telegram_id_atau_username> <sheet_url>\n\n' +
          '📌 Contoh:\n' +
          '• /setsheet @budi https://docs.google.com/spreadsheets/d/...\n' +
          '• /setsheet 123456789 https://docs.google.com/spreadsheets/d/...'
        );
        return;
      }

      const target = args[0];
      const sheetUrl = args[1];

      // Validasi URL sederhana
      if (!sheetUrl.startsWith('http://') && !sheetUrl.startsWith('https://')) {
        await ctx.reply('⚠️ URL harus diawali dengan http:// atau https://');
        return;
      }

      // Cek apakah user terdaftar
      const user = getUser(target);
      if (!user) {
        await ctx.reply(
          `⚠️ User dengan ID/Username "${target}" belum terdaftar.\n` +
          `Pastikan user sudah mencari bot ini dan menekan /start terlebih dahulu.`
        );
        return;
      }

      // Set sheet URL
      setSheetUrl(user.telegram_id, sheetUrl);

      // Ambil transaksi historis user untuk disinkronkan (limit 1000 transaksi terbaru, lalu di-reverse agar kronologis)
      const transactions = getUserTransactions(user.telegram_id, 1000);
      if (transactions && transactions.length > 0) {
        const { syncAllTransactionsToSheet } = require('../services/googleSheets');
        // Balikkan urutan agar dari paling lama ke paling baru (kronologis)
        const chronologicalTx = [...transactions].reverse();
        
        syncAllTransactionsToSheet(sheetUrl, chronologicalTx)
          .then(() => console.log(`✅ Sukses menyinkronkan ${chronologicalTx.length} transaksi historis ke Google Sheet untuk ${user.name}`))
          .catch(err => console.error(`❌ Gagal menyinkronkan transaksi historis ke Google Sheet untuk ${user.name}:`, err));
      }

      await ctx.reply(
        `✅ Google Sheet berhasil diatur!\n\n` +
        `👤 User: ${user.name}\n` +
        `🆔 ID: ${user.telegram_id}\n` +
        `👤 Username: ${user.username ? '@' + user.username : '(tidak ada)'}\n` +
        `📄 Sheet: ${sheetUrl}\n\n` +
        `🔄 *Sinkronisasi data historis (${transactions.length} transaksi) sedang berjalan di latar belakang...*`
      );
    } catch (error) {
      console.error('❌ Error di /setsheet:', error);
      await ctx.reply('Terjadi error saat mengatur Google Sheet.');
    }
  });


  // ──────────────────────────────
  // /users — Lihat Semua User Terdaftar
  // ──────────────────────────────
  bot.command('users', async (ctx) => {
    try {
      if (await denyIfNotAdmin(ctx)) return;

      const users = getAllUsers();

      if (!users || users.length === 0) {
        await ctx.reply('📋 Belum ada user yang terdaftar.');
        return;
      }

      let message =
        `👥 *Daftar User Terdaftar*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Total: ${users.length} user\n\n`;

      for (const user of users) {
        const status = user.is_active ? '✅' : '❌';
        const sheet = user.sheet_url ? '📄' : '—';
        const regDate = formatDate(user.created_at);
        const usernameStr = user.username ? ` (@${user.username})` : '';

        message +=
          `${status} *${user.name}*${usernameStr}\n` +
          `   🆔 ${user.telegram_id} ┃ ${sheet} Sheet ┃ 📅 ${regDate}\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━`;

      await ctx.replyWithMarkdown(message);
    } catch (error) {
      console.error('❌ Error di /users:', error);
      await ctx.reply('Terjadi error saat mengambil daftar user.');
    }
  });

  // ──────────────────────────────
  // /aktif <telegram_id_atau_username>
  // Aktifkan user
  // ──────────────────────────────
  bot.command('aktif', async (ctx) => {
    try {
      if (await denyIfNotAdmin(ctx)) return;

      const args = ctx.message.text.split(/\s+/).slice(1);

      if (args.length < 1) {
        await ctx.reply(
          '⚠️ Format salah!\n\n' +
          '📝 Cara pakai: /aktif <telegram_id_atau_username>\n' +
          '📌 Contoh:\n' +
          '• /aktif @budi\n' +
          '• /aktif 123456789'
        );
        return;
      }

      const target = args[0];

      // Cek apakah user terdaftar
      const user = getUser(target);
      if (!user) {
        await ctx.reply(`⚠️ User "${target}" tidak ditemukan.`);
        return;
      }

      if (user.is_active) {
        await ctx.reply(`ℹ️ User *${user.name}* sudah aktif.`, { parse_mode: 'Markdown' });
        return;
      }

      // Aktifkan user
      setUserActive(user.telegram_id, true);

      await ctx.reply(
        `✅ User berhasil diaktifkan!\n\n` +
        `👤 Nama: ${user.name}\n` +
        `🆔 ID: ${user.telegram_id}\n` +
        `👤 Username: ${user.username ? '@' + user.username : '(tidak ada)'}\n` +
        `📊 Status: ✅ Aktif`
      );
    } catch (error) {
      console.error('❌ Error di /aktif:', error);
      await ctx.reply('Terjadi error saat mengaktifkan user.');
    }
  });

  // ──────────────────────────────
  // /nonaktif <telegram_id_atau_username>
  // Nonaktifkan user
  // ──────────────────────────────
  bot.command('nonaktif', async (ctx) => {
    try {
      if (await denyIfNotAdmin(ctx)) return;

      const args = ctx.message.text.split(/\s+/).slice(1);

      if (args.length < 1) {
        await ctx.reply(
          '⚠️ Format salah!\n\n' +
          '📝 Cara pakai: /nonaktif <telegram_id_atau_username>\n' +
          '📌 Contoh:\n' +
          '• /nonaktif @budi\n' +
          '• /nonaktif 123456789'
        );
        return;
      }

      const target = args[0];

      // Cek apakah user terdaftar
      const user = getUser(target);
      if (!user) {
        await ctx.reply(`⚠️ User "${target}" tidak ditemukan.`);
        return;
      }

      if (!user.is_active) {
        await ctx.reply(`ℹ️ User *${user.name}* sudah nonaktif.`, { parse_mode: 'Markdown' });
        return;
      }

      // Nonaktifkan user
      setUserActive(user.telegram_id, false);

      await ctx.reply(
        `✅ User berhasil dinonaktifkan!\n\n` +
        `👤 Nama: ${user.name}\n` +
        `🆔 ID: ${user.telegram_id}\n` +
        `👤 Username: ${user.username ? '@' + user.username : '(tidak ada)'}\n` +
        `📊 Status: ❌ Nonaktif`
      );
    } catch (error) {
      console.error('❌ Error di /nonaktif:', error);
      await ctx.reply('Terjadi error saat menonaktifkan user.');
    }
  });
}


module.exports = { register };
