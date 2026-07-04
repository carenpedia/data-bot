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

// Nama bulan dalam Bahasa Indonesia
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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
 * Membuat judul tab berdasarkan bulan dan tahun.
 * Contoh: "Juli 2026"
 *
 * @param {number} month - Bulan (1-12)
 * @param {number} year - Tahun (contoh: 2026)
 * @returns {string} Judul tab
 */
function getMonthlyTabTitle(month, year) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ============================================================
// TEMPLATE — Inisialisasi Layout Baru pada Tab
// ============================================================

/**
 * Menginisialisasi template pada tab Google Sheet.
 *
 * Layout baru:
 *   Kolom A-D  → PEMASUKAN  (Tanggal, Kategori, Keterangan, Jumlah)
 *   Kolom E    → separator kosong
 *   Kolom F-I  → PENGELUARAN (Tanggal, Kategori, Keterangan, Jumlah)
 *   Kolom J    → separator kosong
 *   Kolom K-L  → RINGKASAN  (label & rumus)
 *
 * Baris 1: Judul section
 * Baris 2: Header kolom
 * Baris 3+: Data transaksi
 *
 * @param {object} sheets - Instance Sheets API
 * @param {string} spreadsheetId - ID Spreadsheet
 * @param {number} sheetId - ID Sheet (tab)
 * @param {string} sheetTitle - Judul/Nama Sheet (tab)
 */
async function initializeSheetTemplate(sheets, spreadsheetId, sheetId, sheetTitle) {
  // Baris 1: Judul Section
  const sectionTitles = [['💰 PEMASUKAN', '', '', '', '', '💸 PENGELUARAN', '', '', '', '', '📊 RINGKASAN']];

  // Baris 2: Header Kolom (Pemasukan A-D & Pengeluaran F-I)
  const headers = [['Tanggal', 'Kategori', 'Keterangan', 'Jumlah (Rp)', '', 'Tanggal', 'Kategori', 'Keterangan', 'Jumlah (Rp)']];

  // Ringkasan (K1:L4)
  const summary = [
    ['📊 RINGKASAN', ''],
    ['Total Pemasukan', '=SUM(D3:D10000)'],
    ['Total Pengeluaran', '=SUM(I3:I10000)'],
    ['Sisa Saldo', '=L2-L3']
  ];

  // 1. Tulis judul section (A1:K1)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:K1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: sectionTitles }
  });

  // 2. Tulis header kolom (A2:I2)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!A2:I2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: headers }
  });

  // 3. Tulis tabel ringkasan (K1:L4)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!K1:L4`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: summary }
  });

  // 4. Format tampilan (warna, font, freeze)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // ─── Judul "💰 PEMASUKAN" (A1:D1) → Hijau Premium ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0, endRowIndex: 1,
              startColumnIndex: 0, endColumnIndex: 4
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.18, green: 0.54, blue: 0.34 },
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true, fontSize: 12
                },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        // ─── Header Pemasukan (A2:D2) → Hijau Muda ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1, endRowIndex: 2,
              startColumnIndex: 0, endColumnIndex: 4
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.85, green: 0.93, blue: 0.83 },
                textFormat: { bold: true, fontSize: 10 },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        // ─── Judul "💸 PENGELUARAN" (F1:I1) → Merah ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0, endRowIndex: 1,
              startColumnIndex: 5, endColumnIndex: 9
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.80, green: 0.20, blue: 0.20 },
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true, fontSize: 12
                },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        // ─── Header Pengeluaran (F2:I2) → Merah Muda ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1, endRowIndex: 2,
              startColumnIndex: 5, endColumnIndex: 9
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.96, green: 0.80, blue: 0.80 },
                textFormat: { bold: true, fontSize: 10 },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        // ─── Judul Ringkasan (K1:L1) → Biru ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0, endRowIndex: 1,
              startColumnIndex: 10, endColumnIndex: 12
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.24, green: 0.45, blue: 0.75 },
                textFormat: {
                  foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                  bold: true, fontSize: 12
                },
                horizontalAlignment: 'CENTER'
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
          }
        },
        // ─── Label Ringkasan (K2:K4) → Bold ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1, endRowIndex: 4,
              startColumnIndex: 10, endColumnIndex: 11
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(textFormat)'
          }
        },
        // ─── Baris Sisa Saldo (K4:L4) → Highlight Biru Muda ───
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 3, endRowIndex: 4,
              startColumnIndex: 10, endColumnIndex: 12
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.85, green: 0.92, blue: 0.98 },
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        // ─── Bekukan 2 baris pertama (judul + header) ───
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                frozenRowCount: 2
              }
            },
            fields: 'gridProperties.frozenRowCount'
          }
        }
      ]
    }
  });
}

// ============================================================
// TAB BULANAN — Get or Create
// ============================================================

/**
 * Mendapatkan atau membuat tab bulanan pada Google Sheet.
 * Jika tab untuk bulan/tahun tersebut belum ada, buat baru dan inisialisasi template.
 * Jika sheet hanya punya satu tab default yang masih kosong, rename saja.
 *
 * @param {object} sheets - Instance Sheets API
 * @param {string} spreadsheetId - ID Spreadsheet
 * @param {number} month - Bulan (1-12)
 * @param {number} year - Tahun (contoh: 2026)
 * @returns {Promise<{sheetId: number, sheetTitle: string}>}
 */
async function getOrCreateMonthlyTab(sheets, spreadsheetId, month, year) {
  const targetTitle = getMonthlyTabTitle(month, year);

  // Ambil semua tab yang ada di spreadsheet
  const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheetInfo.data.sheets;

  // Cari tab dengan judul yang cocok
  const existing = existingSheets.find(s => s.properties.title === targetTitle);
  if (existing) {
    return {
      sheetId: existing.properties.sheetId,
      sheetTitle: existing.properties.title
    };
  }

  // Cek apakah ini tab pertama dan masih default (Sheet1 / kosong)
  // Jika iya, rename saja daripada buat tab baru
  if (existingSheets.length === 1) {
    const firstSheet = existingSheets[0];
    const firstTitle = firstSheet.properties.title;

    // Cek apakah sheet ini masih kosong (belum ada data)
    const checkData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${firstTitle}'!A1:I3`
    });

    const isEmpty = !checkData.data.values || checkData.data.values.length === 0;

    if (isEmpty) {
      // Rename tab default ke nama bulan
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: firstSheet.properties.sheetId,
                title: targetTitle
              },
              fields: 'title'
            }
          }]
        }
      });

      // Inisialisasi template pada tab yang sudah di-rename
      await initializeSheetTemplate(sheets, spreadsheetId, firstSheet.properties.sheetId, targetTitle);

      console.log(`📑 Tab default di-rename menjadi: "${targetTitle}"`);
      return {
        sheetId: firstSheet.properties.sheetId,
        sheetTitle: targetTitle
      };
    }
  }

  // Buat tab baru
  const addSheetResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: targetTitle
          }
        }
      }]
    }
  });

  const newSheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;

  // Inisialisasi template pada tab baru
  await initializeSheetTemplate(sheets, spreadsheetId, newSheetId, targetTitle);

  console.log(`📑 Tab baru dibuat: "${targetTitle}"`);
  return {
    sheetId: newSheetId,
    sheetTitle: targetTitle
  };
}

// ============================================================
// HELPER — Format tanggal transaksi
// ============================================================

/**
 * Format tanggal transaksi menjadi string DD/MM/YYYY HH:mm
 *
 * @param {string|number} dateInput - Tanggal (ISO string, timestamp, dll.)
 * @returns {{formattedDate: string, month: number, year: number}}
 */
function formatTransactionDate(dateInput) {
  const dateObj = new Date(dateInput || Date.now());
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = dateObj.getMonth() + 1;
  const monthStr = String(month).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return {
    formattedDate: `${day}/${monthStr}/${year} ${hours}:${minutes}`,
    month,
    year
  };
}

// ============================================================
// FUNGSI UTAMA — CRUD Transaksi di Google Sheet
// ============================================================

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

    // 3. Buat tab untuk bulan saat ini (rename Sheet1 default)
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    await getOrCreateMonthlyTab(sheets, spreadsheetId, month, year);

    console.log(`✅ Google Sheet dikonfigurasi dengan tab "${getMonthlyTabTitle(month, year)}".`);
    return sheetUrl;
  } catch (error) {
    console.error('❌ Gagal membuat Google Sheet otomatis:', error);
    return null;
  }
}

/**
 * Menambahkan baris transaksi baru ke Google Sheet user.
 * Otomatis memilih tab bulanan yang tepat dan section yang sesuai
 * (Pemasukan → kolom A-D, Pengeluaran → kolom F-I).
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
    // Tentukan bulan & tahun dari tanggal transaksi
    const { formattedDate, month, year } = formatTransactionDate(tx.created_at);

    // Dapatkan atau buat tab bulanan yang sesuai
    const { sheetTitle } = await getOrCreateMonthlyTab(sheets, spreadsheetId, month, year);

    // Format baris data (tanpa kolom Tipe — sudah terpisah secara layout)
    const rowData = [
      formattedDate,
      tx.category || 'Lainnya',
      tx.description || '',
      tx.amount || 0
    ];

    // Tentukan range berdasarkan tipe transaksi
    // income  → kolom A-D (section Pemasukan)
    // expense → kolom F-I (section Pengeluaran)
    const range = tx.type === 'income'
      ? `'${sheetTitle}'!A:D`
      : `'${sheetTitle}'!F:I`;

    // Append data transaksi ke baris berikutnya pada section yang tepat
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowData] }
    });

    const typeLabel = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    console.log(`📊 Berhasil sinkronisasi ${typeLabel} ke tab "${sheetTitle}" (${tx.description} - Rp ${tx.amount})`);
    return true;
  } catch (error) {
    console.error('❌ Gagal sinkronisasi transaksi ke Google Sheet:', error);
    return false;
  }
}

/**
 * Sinkronisasi seluruh transaksi yang ada di database lokal ke Google Sheet.
 * Data dikelompokkan per bulan dan ditulis ke tab bulanan masing-masing.
 * Dalam setiap tab, pemasukan dan pengeluaran ditulis ke section terpisah.
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
    // 1. Kelompokkan transaksi berdasarkan bulan/tahun
    const grouped = {};

    for (const tx of transactions) {
      const { formattedDate, month, year } = formatTransactionDate(tx.created_at);
      const key = `${year}-${String(month).padStart(2, '0')}`; // "2026-07" → untuk sorting

      if (!grouped[key]) {
        grouped[key] = { month, year, income: [], expense: [] };
      }

      const rowData = [
        formattedDate,
        tx.category || 'Lainnya',
        tx.description || '',
        tx.amount || 0
      ];

      if (tx.type === 'income') {
        grouped[key].income.push(rowData);
      } else {
        grouped[key].expense.push(rowData);
      }
    }

    // 2. Tulis data untuk setiap grup bulan (diurutkan kronologis)
    const sortedKeys = Object.keys(grouped).sort();

    for (const key of sortedKeys) {
      const { month, year, income, expense } = grouped[key];
      const { sheetTitle } = await getOrCreateMonthlyTab(sheets, spreadsheetId, month, year);

      // Tulis batch pemasukan ke section A-D
      if (income.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${sheetTitle}'!A:D`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: income }
        });
      }

      // Tulis batch pengeluaran ke section F-I
      if (expense.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${sheetTitle}'!F:I`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: expense }
        });
      }

      console.log(`📊 Tab "${sheetTitle}": ${income.length} pemasukan, ${expense.length} pengeluaran disinkronkan.`);
    }

    console.log(`📊 Berhasil sinkronisasi masal ${transactions.length} transaksi ke Google Sheet (${sortedKeys.length} tab bulan).`);
    return true;
  } catch (error) {
    console.error('❌ Gagal sinkronisasi masal transaksi ke Google Sheet:', error);
    return false;
  }
}

/**
 * Menghapus baris transaksi terakhir di Google Sheet.
 * Menentukan tab dan section yang tepat berdasarkan data transaksi.
 *
 * Menggunakan clear (bukan delete row) agar tidak menggeser baris
 * pada section yang berlawanan.
 *
 * @param {string} sheetUrl - URL Google Sheet user
 * @param {object} transaction - Data transaksi yang dihapus (untuk menentukan tab & section)
 * @returns {Promise<boolean>} true jika sukses
 */
async function deleteLastTransactionFromSheet(sheetUrl, transaction) {
  const clients = getGoogleClients();
  if (!clients) return false;

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) return false;

  const { sheets } = clients;

  try {
    // Tentukan tab bulan berdasarkan tanggal transaksi
    const dateObj = new Date(transaction.created_at || Date.now());
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const targetTitle = getMonthlyTabTitle(month, year);

    // Ambil info spreadsheet dan cari tab yang sesuai
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheet = spreadsheetInfo.data.sheets.find(
      s => s.properties.title === targetTitle
    );

    if (!targetSheet) {
      console.log(`⚠️ Tab "${targetTitle}" tidak ditemukan di Google Sheet.`);
      return false;
    }

    const sheetTitle = targetSheet.properties.title;

    // Tentukan range berdasarkan tipe transaksi
    const isIncome = transaction.type === 'income';
    const dataRange = isIncome
      ? `'${sheetTitle}'!A:D`
      : `'${sheetTitle}'!F:I`;

    // Ambil data dari section yang sesuai
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: dataRange
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 2) {
      // Hanya header (2 baris judul + header), tidak ada data transaksi
      console.log('⚠️ Tidak ada data transaksi di section ini untuk dihapus.');
      return false;
    }

    // Hapus konten baris terakhir (menggunakan clear, bukan delete row,
    // agar tidak menggeser baris pada section yang berlawanan)
    const lastRowNumber = rows.length; // 1-indexed
    const clearRange = isIncome
      ? `'${sheetTitle}'!A${lastRowNumber}:D${lastRowNumber}`
      : `'${sheetTitle}'!F${lastRowNumber}:I${lastRowNumber}`;

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: clearRange
    });

    const typeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran';
    console.log(`📊 Berhasil menghapus ${typeLabel} baris ke-${lastRowNumber} dari tab "${sheetTitle}".`);
    return true;
  } catch (error) {
    console.error('❌ Gagal menghapus transaksi dari Google Sheet:', error);
    return false;
  }
}

module.exports = {
  createAutomatedSheet,
  appendTransactionToSheet,
  deleteLastTransactionFromSheet,
  syncAllTransactionsToSheet
};
