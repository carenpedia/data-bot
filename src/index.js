// ============================================
// INDEX.JS — Entry Point Data Bot
// ============================================
// Bot Telegram Pencatat Keuangan
// Ramah, interaktif, dan mudah digunakan! 🤖
// ============================================

// Load environment variables
require('dotenv').config();

// Validasi token bot
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN tidak ditemukan!');
  console.error('📋 Langkah yang harus dilakukan:');
  console.error('   1. Salin file .env.example menjadi .env');
  console.error('   2. Isi BOT_TOKEN dengan token dari @BotFather');
  console.error('   3. Isi ADMIN_ID dengan Telegram ID kamu');
  process.exit(1);
}

if (!process.env.ADMIN_ID) {
  console.warn('⚠️  ADMIN_ID belum diatur. Command admin tidak akan berfungsi.');
  console.warn('   Kirim pesan ke @userinfobot untuk mengetahui Telegram ID kamu.');
}

// Inisialisasi database (auto-create tables)
require('./database');

// Import dan buat bot
const { createBot } = require('./bot');
const bot = createBot(process.env.BOT_TOKEN);

// ============================================
// LAUNCH BOT
// ============================================
bot.launch()
  .then(() => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Data Bot berhasil dijalankan!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Admin ID: ${process.env.ADMIN_ID || '(belum diatur)'}`);
    console.log(`⏰ Waktu mulai: ${new Date().toLocaleString('id-ID')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ Bot siap menerima pesan!');
    console.log('🛑 Tekan Ctrl+C untuk menghentikan bot.');
    console.log('');
  });

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
// Berhenti dengan bersih saat menerima sinyal stop
process.once('SIGINT', () => {
  console.log('\n🛑 Menerima sinyal SIGINT. Menghentikan bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n🛑 Menerima sinyal SIGTERM. Menghentikan bot...');
  bot.stop('SIGTERM');
});

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});
