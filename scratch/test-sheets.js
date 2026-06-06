require('dotenv').config();
const { createAutomatedSheet, appendTransactionToSheet, deleteLastTransactionFromSheet } = require('../src/services/googleSheets');

async function runTest() {
  console.log('🏁 Memulai uji coba Google Sheets API...');

  try {
    // 1. Uji buat sheet
    const url = await createAutomatedSheet('Test User Antigravity');
    if (!url) {
      console.error('❌ Test GAGAL: Tidak bisa membuat sheet.');
      return;
    }
    console.log(`✅ Test BERHASIL: Sheet dibuat di URL: ${url}`);

    // 2. Uji tambah baris transaksi
    const dummyTx = {
      type: 'expense',
      category: 'Makanan',
      description: 'Beli bakso keju uji coba',
      amount: 15000,
      created_at: new Date().toISOString()
    };

    console.log('⏳ Mencoba menulis data transaksi...');
    const appendOk = await appendTransactionToSheet(url, dummyTx);
    if (!appendOk) {
      console.error('❌ Test GAGAL: Tidak bisa menulis data.');
      return;
    }
    console.log('✅ Test BERHASIL: Berhasil menulis data transaksi.');

    // 3. Uji hapus baris transaksi terakhir
    console.log('⏳ Mencoba menghapus data transaksi terakhir...');
    const deleteOk = await deleteLastTransactionFromSheet(url);
    if (!deleteOk) {
      console.error('❌ Test GAGAL: Tidak bisa menghapus data.');
      return;
    }
    console.log('✅ Test BERHASIL: Berhasil menghapus baris terakhir.');
    console.log('🎉 Semua tes Google Sheets API BERHASIL!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Terjadi error tak terduga selama pengujian:', error);
    process.exit(1);
  }
}

runTest();
