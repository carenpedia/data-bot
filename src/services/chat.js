const { getMonthlySummary, getCategoryBreakdown } = require('./summary');
const { formatRupiah } = require('../utils/formatter');

/**
 * Mendapatkan respon interaktif (chitchat) dari bot.
 * Jika tidak ada pola yang cocok, kembalikan null.
 *
 * @param {string} text - Teks dari pengguna
 * @param {object} user - Data pengguna dari database
 * @returns {string|null} Respon bot atau null
 */
async function getChatResponse(text, user) {
  const t = text.toLowerCase().trim();
  
  if (t.includes('siapa aku') || t.includes('namaku siapa') || t.includes('siapakah aku') || t.includes('aku siapa') || t.includes('aku ini siapa')) {
    return `Tentu saja aku kenal! Tuan adalah kak *${user.name}* yang luar biasa! 🌟\nTelegram ID Tuan adalah \`${user.telegram_id}\`.\nAku adalah pelayan setia yang selalu siap mencatat keuangan Tuan kapanpun dibutuhkan! 🫡`;
  }
  
  if (t.includes('kamu siapa') || t.includes('siapa kamu') || t === 'bot' || t.includes('nama kamu') || t.includes('kamu itu siapa')) {
    return `Aku adalah **Data Bot**, asisten keuangan pribadi Tuan! 🤖💼\nAku diciptakan untuk membantu Tuan mencatat pemasukan dan pengeluaran agar lebih rapi. Cukup perintahkan aku, dan aku akan laksanakan dengan cepat! ✨`;
  }
  
  if (t === 'halo' || t === 'hi' || t === 'hai' || t === 'hello' || t === 'p' || t === 'ping' || t === 'oy') {
    return `Halo Tuan *${user.name}*! 👋\nAda transaksi yang ingin dicatat hari ini? Ketik saja langsung, misalnya "beli kopi 15rb". Aku siap sedia melayani! 📝`;
  }
  
  if (t.includes('terima kasih') || t.includes('makasih') || t.includes('thanks') || t === 'tq' || t.includes('thank you')) {
    return `Sama-sama, Tuan *${user.name}*! 🙏\nItu sudah menjadi tugasku. Panggil aku lagi kalau butuh bantuan mencatat ya! 😉`;
  }
  
  if (t.includes('keren') || t.includes('mantap') || t.includes('bagus') || t.includes('hebat') || t.includes('good') || t.includes('anjay')) {
    return `Hehe, terima kasih banyak pujiannya Tuan! 🥰\nAku akan terus berusaha menjadi asisten terbaik untuk Tuan! 🚀`;
  }
  
  if (t.includes('selamat pagi') || t.includes('pagi') || t.includes('met pagi')) {
    return `Selamat pagi, Tuan *${user.name}*! 🌅\nSemoga hari ini rezekinya lancar dan banyak pemasukan ya! Amin! 💰`;
  }
  
  if (t.includes('selamat malam') || t.includes('malam') || t.includes('met malam')) {
    return `Selamat malam, Tuan *${user.name}*! 🌙\nJangan lupa istirahat yang cukup. Aku akan selalu menjaga catatan keuanganmu di sini. 🛌💤`;
  }

  // --- LOGIC: APAKAH AKU BOROS? ---
  if (t.includes('boros') || t.includes('hemat') || (t.includes('aku') && t.includes('boros'))) {
    // Ambil data bulan ini
    const summary = getMonthlySummary(user.telegram_id);
    const breakdown = getCategoryBreakdown(user.telegram_id, 'expense');
    
    // Kategori pengeluaran "tersier" atau gaya hidup
    const nonEssentialCategories = ['Makanan', 'Hiburan', 'Belanja'];
    
    let nonEssentialTotal = 0;
    for (const item of breakdown) {
      if (nonEssentialCategories.includes(item.category) || item.category === 'Lainnya') {
        nonEssentialTotal += item.total;
      }
    }
    
    if (summary.totalExpense === 0) {
      return `Berdasarkan dataku, Tuan *${user.name}* belum ada pengeluaran sama sekali bulan ini! Tuan super hemat! 🥇💸\nAyo terus pertahankan!`;
    }
    
    const expenseRatio = summary.totalIncome > 0 ? (summary.totalExpense / summary.totalIncome) : 1;
    const nonEssentialRatio = nonEssentialTotal / summary.totalExpense;
    
    let verdict = "";
    let advice = "";
    
    if (expenseRatio > 0.8 || (nonEssentialRatio > 0.5 && summary.totalExpense > 500000)) {
      verdict = "Sepertinya Tuan **AGAK BOROS** nih bulan ini! 📉🫣";
      advice = `Bulan ini Tuan sudah menghabiskan ${formatRupiah(summary.totalExpense)}.\n` +
               `Parahnya, sekitar ${Math.round(nonEssentialRatio * 100)}% dari itu dihabiskan untuk gaya hidup atau pengeluaran yang tidak terlalu penting (seperti jajan, hiburan, atau belanja) sebesar ${formatRupiah(nonEssentialTotal)}.\n\n` +
               `Saran dariku: Coba kurangi jajan di luar dan pikir dua kali sebelum *checkout* belanjaan, Tuan! Sedikit berhemat sekarang biar cepat kaya dan banyak tabungan! 💸✨`;
    } else if (expenseRatio > 0.5) {
      verdict = "Pengeluaran Tuan bulan ini **NORMAL**, tidak terlalu boros tapi belum terbilang hemat. 📊🤔";
      advice = `Tuan sudah mengeluarkan uang sebesar ${formatRupiah(summary.totalExpense)}.\nPengeluaran gaya hidup Tuan sekitar ${formatRupiah(nonEssentialTotal)}.\n\nCoba ditahan sedikit ya Tuan pengeluarannya biar sisanya bisa ditabung! 💰`;
    } else {
      verdict = "Wah, Tuan sangat **HEMAT** bulan ini! 🏆🤑";
      advice = `Total pengeluaran Tuan baru ${formatRupiah(summary.totalExpense)} dengan porsi gaya hidup yang sangat terkontrol.\n\nKerja bagus, Tuan! Pertahankan kebiasaan emas ini biar kekayaan Tuan semakin menggunung! 🏔️✨`;
    }
    
    return `${verdict}\n\n${advice}`;
  }
  // --- LOGIC: CARA NABUNG ---
  if (t.includes('cara nabung') || t.includes('cara menabung') || t.includes('tips nabung') || t.includes('tips menabung')) {
    const summary = getMonthlySummary(user.telegram_id);
    const breakdown = getCategoryBreakdown(user.telegram_id, 'expense');
    
    if (summary.totalIncome === 0) {
      return `Hmm, Tuan *${user.name}*... untuk bisa menabung, tentu Tuan harus punya pemasukan dulu. 😅\nSaat ini belum ada pemasukan yang tercatat di bulan ini. Yuk, semangat cari cuan dan pemasukan tambahan! 💪🔥`;
    }
    
    // Temukan kategori pengeluaran terbesar
    let biggestExpenseCategory = null;
    if (breakdown.length > 0) {
      biggestExpenseCategory = breakdown[0]; // array sudah diurutkan DESC
    }
    
    let advice = `💡 **Tips Menabung Spesial untuk Tuan ${user.name}!** 💡\n\n`;
    
    advice += `Bulan ini Tuan punya pemasukan sebesar **${formatRupiah(summary.totalIncome)}**.\n`;
    
    // Formula menabung 50/30/20
    const targetSavings = Math.round(summary.totalIncome * 0.2); // 20%
    const currentBalance = summary.totalIncome - summary.totalExpense;
    
    advice += `Idealnya, Tuan menyisihkan minimal 20% dari pemasukan untuk ditabung, yaitu sekitar **${formatRupiah(targetSavings)}**.\n\n`;
    
    if (currentBalance < targetSavings) {
      advice += `⚠️ Saat ini sisa saldo Tuan adalah ${formatRupiah(currentBalance)}, belum mencapai target tabungan ideal.\n\n`;
      
      if (biggestExpenseCategory) {
        advice += `🚨 **Bocoran dari Data Bot:**\nPengeluaran terbesar Tuan saat ini ada di kategori **"${biggestExpenseCategory.category}"** (${formatRupiah(biggestExpenseCategory.total)}).\nCoba kurangi sedikit pengeluaran di bagian ini ya Tuan! ✂️\n\n`;
      }
    } else {
      advice += `✨ Wah! Sisa saldo Tuan saat ini adalah **${formatRupiah(currentBalance)}**! Ini berarti target tabungan Tuan sudah aman bulan ini!\nSegera pisahkan uang ini ke rekening tabungan yang berbeda supaya tidak tidak sengaja terpakai ya. 🏦🔒\n\n`;
    }
    
    advice += `**Ingat Tuan:** Menabung itu bukan dari *sisa* uang belanja, tapi uang yang sengaja *disisihkan di awal*! Semangat kaya raya! 🚀💸`;
    
    return advice;
  }
  
  return null;
}

module.exports = { getChatResponse };
