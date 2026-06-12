const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Path ke file kunci JSON
const KEY_FILE = path.join(process.cwd(), 'google-key.json');

// Scope yang dibutuhkan: mengakses Drive (buat file & atur izin) dan Sheets (tulis data)
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets'
];

/**
 * Mendapatkan instance Google API Client terautentikasi
 * @returns {object|null} { drive, sheets } atau null jika kredensial tidak ditemukan
 */
function getGoogleClients() {
  if (!fs.existsSync(KEY_FILE)) {
    console.warn('⚠️ File google-key.json tidak ditemukan. Fitur otomatisasi Google Sheets dinonaktifkan.');
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: SCOPES
  });

  return {
    drive: google.drive({ version: 'v3', auth }),
    sheets: google.sheets({ version: 'v4', auth })
  };
}

/**
 * Mengekstrak ID Spreadsheet dari URL Google Sheets
 * @param {string} url - URL Google Sheet
 * @returns {string|null} ID Spreadsheet atau null
 */
function extractSpreadsheetId(url) {
  if (!url) return null;
  const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}

/**
 * Menginisialisasi header dan ringkasan rumus pada Google Sheet yang kosong.
 *
 * @param {object} sheets - Instance Sheets API
 * @param {string} spreadsheetId - ID Spreadsheet
 * @param {number} sheetId - ID Sheet (tab)
 * @param {string} sheetTitle - Judul/Nama Sheet (tab)
 */
async function initializeSheetTemplate(sheets, spreadsheetId, sheetId, sheetTitle) {
  const headers = [['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah (Rp)']];
  const summary = [
    ['Total Pemasukan', '=SUMIF(B:B; "Pemasukan"; E:E)'],
    ['Total Pengeluaran', '=SUMIF(B:B; "Pengeluaran"; E:E)'],
    ['Sisa Saldo', '=H1-H2']
  ];

  // Tulis Header Utama (A1:E1)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:E1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: headers }
  });

  // Tulis Tabel Ringkasan (Kolom G & H)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!G1:H3`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: summary }
  });

  // Format Tampilan (Tebalkan font, warna background, freeze row)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          // Format Header Utama (A1:E1) -> Hijau Premium
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 5
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.18, green: 0.54, blue: 0.34 }, // Hijau premium
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true,
                  fontSize: 11
                },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        {
          // Format Label Ringkasan (G1:G3) -> Bold
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 3,
              startColumnIndex: 6,
              endColumnIndex: 7
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(textFormat)'
          }
        },
        {
          // Format Baris Sisa Saldo (G3:H3) -> Highlight Hijau Muda
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 6,
              endColumnIndex: 8
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.88, green: 0.95, blue: 0.91 }, // Hijau muda soft
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        {
          // Bekukan baris pertama
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                frozenRowCount: 1
              }
            },
            fields: 'gridProperties.frozenRowCount'
          }
        }
      ]
    }
  });
}

/**
 * Membuat Google Sheet baru secara otomatis untuk user baru,
 * mengeset header, dan membagikan akses link (Anyone with link can edit).
 *
 * @param {string} userName - Nama user Telegram
 * @returns {Promise<string|null>} URL Google Sheets yang baru dibuat
 */
async function createAutomatedSheet(userName) {
  const clients = getGoogleClients();
  if (!clients) return null;

  const { drive, sheets } = clients;

  try {
    console.log(`🎬 Mulai membuat Google Sheet otomatis untuk: ${userName}`);

    // 1. Buat file spreadsheet baru di Google Drive
    const fileMetadata = {
      name: `Data Bot - ${userName}`,
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };

    // Jika ada folder parent yang ditentukan (untuk membebankan kuota ke drive user, bukan service account)
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
    }

    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id,webViewLink'
    });

    const spreadsheetId = file.data.id;
    const sheetUrl = file.data.webViewLink;

    console.log(`✅ File Google Sheet dibuat. ID: ${spreadsheetId}`);

    // 2. Berikan izin akses link "Anyone with link can edit"
    // Agar user bisa membuka dan mengedit secara langsung di browser/hp mereka
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: 'writer',
        type: 'anyone'
      }
    });

    console.log(`✅ Izin akses link diatur ke "Anyone can edit"`);

    // Dapatkan detail tab pertama
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetId = firstSheet.properties.sheetId;
    const sheetTitle = firstSheet.properties.title;

    // 3. Set Header Kolom dan Ringkasan Rumus
    await initializeSheetTemplate(sheets, spreadsheetId, sheetId, sheetTitle);

    console.log(`✅ Header Google Sheet dikonfigurasi & diformat.`);
    return sheetUrl;
  } catch (error) {
    console.error('❌ Gagal membuat Google Sheet otomatis:', error);
    return null;
  }
}

/**
 * Menambahkan baris transaksi baru ke Google Sheet user.
 *
 * @param {string} sheetUrl - URL Google Sheet user
 * @param {object} tx - Data transaksi
 * @returns {Promise<boolean>} true jika sukses
 */
async function appendTransactionToSheet(sheetUrl, tx) {
  const clients = getGoogleClients();
  if (!clients) return false;

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return false;

  const { sheets } = clients;

  try {
    // Ambil info sheet pertama secara dinamis
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetId = firstSheet.properties.sheetId;
    const sheetTitle = firstSheet.properties.title;

    // 1. Cek apakah Sheet masih kosong (belum ada header)
    const checkHeader = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:E1`
    });

    const hasHeader = checkHeader.data.values && checkHeader.data.values.length > 0;

    if (!hasHeader) {
      console.log(`📝 Google Sheet terdeteksi kosong. Membuat header & format otomatis pada tab: ${sheetTitle}...`);
      await initializeSheetTemplate(sheets, spreadsheetId, sheetId, sheetTitle);
    }

    // 2. Format tanggal: DD/MM/YYYY HH:mm
    const dateObj = new Date(tx.created_at || Date.now());
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;

    const typeStr = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    
    const rowData = [
      formattedDate,
      typeStr,
      tx.category || 'Lainnya',
      tx.description || '',
      tx.amount || 0
    ];

    // 3. Append data transaksi ke baris berikutnya
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetTitle}'!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] }
    });

    console.log(`📊 Berhasil sinkronisasi transaksi ke Google Sheet (${tx.description} - Rp ${tx.amount})`);
    return true;
  } catch (error) {
    console.error('❌ Gagal sinkronisasi transaksi ke Google Sheet:', error);
    return false;
  }
}

/**
 * Sinkronisasi seluruh transaksi yang ada di database lokal ke Google Sheet (misal saat sheet baru didaftarkan).
 *
 * @param {string} sheetUrl - URL Google Sheet user
 * @param {Array<object>} transactions - Daftar transaksi dari database (diurutkan dari lama ke baru)
 * @returns {Promise<boolean>} true jika sukses
 */
async function syncAllTransactionsToSheet(sheetUrl, transactions) {
  if (!transactions || transactions.length === 0) return true;

  const clients = getGoogleClients();
  if (!clients) return false;

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return false;

  const { sheets } = clients;

  try {
    // Ambil info sheet pertama secara dinamis
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetId = firstSheet.properties.sheetId;
    const sheetTitle = firstSheet.properties.title;

    // 1. Pastikan header sudah ada dan terformat
    const checkHeader = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:E1`
    });

    const hasHeader = checkHeader.data.values && checkHeader.data.values.length > 0;

    if (!hasHeader) {
      console.log(`📝 Google Sheet kosong saat sync masal. Membuat header & format otomatis pada tab: ${sheetTitle}...`);
      await initializeSheetTemplate(sheets, spreadsheetId, sheetId, sheetTitle);
    }

    // 2. Format baris-baris data transaksi
    const rowsData = transactions.map(tx => {
      const dateObj = new Date(tx.created_at || Date.now());
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;

      const typeStr = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      
      return [
        formattedDate,
        typeStr,
        tx.category || 'Lainnya',
        tx.description || '',
        tx.amount || 0
      ];
    });

    // 3. Tulis seluruh data secara massal (batch append)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${sheetTitle}'!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rowsData }
    });

    console.log(`📊 Berhasil sinkronisasi masal ${transactions.length} transaksi ke Google Sheet.`);
    return true;
  } catch (error) {
    console.error('❌ Gagal sinkronisasi masal transaksi ke Google Sheet:', error);
    return false;
  }
}

/**
 * Menghapus baris transaksi terakhir di Google Sheet.
 * Digunakan saat user melakukan pembatalan/penghapusan transaksi terakhir.
 *
 * @param {string} sheetUrl - URL Google Sheet user
 * @returns {Promise<boolean>} true jika sukses
 */
async function deleteLastTransactionFromSheet(sheetUrl) {
  const clients = getGoogleClients();
  if (!clients) return false;

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return false;

  const { sheets } = clients;

  try {
    // Ambil info sheet pertama secara dinamis
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheet = spreadsheetInfo.data.sheets[0];
    const sheetId = firstSheet.properties.sheetId;
    const sheetTitle = firstSheet.properties.title;

    // 1. Ambil data baris untuk mengetahui baris terakhir yang terisi
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle}'!A:E`
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      console.log('⚠️ Google Sheet kosong atau hanya berisi header. Tidak ada yang bisa dihapus.');
      return false; // Kosong atau hanya header
    }

    const lastRowIndex = rows.length; // 1-indexed index baris terakhir

    // 3. Hapus baris terakhir
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: lastRowIndex - 1, // 0-indexed, baris terakhir
                endIndex: lastRowIndex // eksklusif
              }
            }
          }
        ]
      }
    });

    console.log(`📊 Berhasil menghapus baris ke-${lastRowIndex} di Google Sheet.`);
    return true;
  } catch (error) {
    console.error('❌ Gagal menghapus transaksi terakhir di Google Sheet:', error);
    return false;
  }
}

module.exports = {
  createAutomatedSheet,
  appendTransactionToSheet,
  deleteLastTransactionFromSheet,
  syncAllTransactionsToSheet
};
