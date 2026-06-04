/**
 * parser.js — Parser bahasa alami untuk transaksi keuangan Indonesia
 *
 * Modul ini menganalisis teks Bahasa Indonesia dan mengekstrak
 * informasi transaksi keuangan: tipe (pemasukan/pengeluaran),
 * kategori, deskripsi, dan jumlah uang.
 *
 * Contoh input yang didukung:
 *   "beli bakso 15rb"           → expense, Makanan, 15000
 *   "gaji bulan juni 5jt"      → income, Gaji, 5000000
 *   "bayar listrik 350.000"    → expense, Tagihan, 350000
 *   "orderan masuk 1.5jt"      → income, Penjualan, 1500000
 *   "topup gopay 100k"         → expense, Lainnya, 100000
 *
 * @module services/parser
 */

// ============================================================
// KATA KUNCI PENGELUARAN (Expense Keywords)
// ============================================================
const expenseKeywords = [
  'beli', 'bayar', 'buat', 'jajan', 'traktir', 'sewa', 'isi',
  'bayarin', 'titip', 'parkir', 'ongkos', 'bensin', 'rugi',
  'cicil', 'kredit', 'utang', 'topup', 'top up', 'sedekah',
  'infaq', 'zakat', 'donasi', 'nabung',
];

// ============================================================
// KATA KUNCI PEMASUKAN (Income Keywords)
// ============================================================
const incomeKeywords = [
  'gaji', 'terima', 'dapat', 'bonus', 'jual', 'dibayar',
  'cashback', 'refund', 'orderan', 'laku', 'omset', 'omzet',
  'laris', 'masuk', 'pesanan', 'lunas', 'cuan', 'untung',
  'komisi', 'fee', 'honor', 'freelance', 'proyek', 'project',
];

// ============================================================
// PETA KATEGORI PENGELUARAN
// Setiap kategori punya daftar kata kunci untuk deteksi otomatis
// ============================================================
const expenseCategories = {
  Makanan: [
    'bakso', 'nasi', 'makan', 'minum', 'kopi', 'jajan', 'snack',
    'es', 'teh', 'ayam', 'sate', 'mie', 'bubur', 'gorengan',
    'roti', 'susu', 'sayur', 'buah', 'lauk', 'warung', 'resto',
    'cafe', 'indomie', 'rendang', 'soto', 'gado', 'pecel',
    'rawon', 'martabak', 'pizza', 'burger',
  ],
  Transportasi: [
    'bensin', 'grab', 'gojek', 'parkir', 'ongkos', 'tol',
    'ojek', 'bus', 'kereta', 'angkot', 'taksi', 'bbm',
    'solar', 'pertamax',
  ],
  Tagihan: [
    'listrik', 'wifi', 'air', 'pulsa', 'internet', 'indihome',
    'pln', 'pdam', 'gas', 'sewa', 'kos', 'kontrakan',
    'cicilan', 'kredit',
  ],
  Belanja: [
    'baju', 'celana', 'sepatu', 'tas', 'hp', 'laptop',
    'elektronik', 'gadget', 'skincare', 'kosmetik',
  ],
  Kesehatan: [
    'obat', 'dokter', 'rumah sakit', 'apotek', 'vitamin', 'klinik',
  ],
  Pendidikan: [
    'buku', 'kursus', 'les', 'sekolah', 'kuliah', 'spp',
  ],
  Hiburan: [
    'nonton', 'game', 'netflix', 'spotify', 'langganan', 'tiket',
  ],
};

// ============================================================
// PETA KATEGORI PEMASUKAN
// ============================================================
const incomeCategories = {
  Gaji: ['gaji', 'salary', 'honor'],
  Penjualan: ['orderan', 'laku', 'omset', 'omzet', 'laris', 'pesanan', 'jual'],
  Bonus: ['bonus', 'cashback', 'refund', 'komisi', 'fee', 'cuan', 'untung'],
  Freelance: ['freelance', 'proyek', 'project'],
  Transfer: ['terima', 'dapat', 'masuk', 'dibayar', 'lunas'],
};

// ============================================================
// REGEX PATTERNS UNTUK DETEKSI JUMLAH UANG
// Urutan penting — pattern yang lebih spesifik harus dicek duluan
// ============================================================

/**
 * Ekstrak jumlah uang dari teks.
 * Mendukung berbagai format Indonesia:
 *   '10rb' / '10ribu' / '10 rb'   → 10.000
 *   '1.5jt' / '1,5jt' / '1.5juta' → 1.500.000
 *   '200k'                         → 200.000
 *   '50000'                        → 50.000
 *   '50.000'                       → 50.000 (format ribuan Indonesia)
 *
 * @param {string} text - Teks input
 * @returns {number|null} Jumlah uang, atau null jika tidak ditemukan
 */
function extractAmount(text) {
  const lower = text.toLowerCase().trim();

  // Pattern 1: Format jutaan — "1.5jt", "1,5jt", "1.5juta", "2 juta", "1.5 jt"
  // Menangkap angka desimal (titik/koma) diikuti 'jt' atau 'juta'
  const jtPattern = /(\d+)[.,](\d+)\s*(?:jt|juta)\b/;
  const jtMatch = lower.match(jtPattern);
  if (jtMatch) {
    const whole = parseInt(jtMatch[1], 10);
    const decimal = jtMatch[2];
    // Konversi bagian desimal: '5' → 0.5, '25' → 0.25, '500' → 0.5
    const fraction = parseInt(decimal, 10) / Math.pow(10, decimal.length);
    return Math.round((whole + fraction) * 1_000_000);
  }

  // Pattern 2: Jutaan bulat — "2jt", "5 juta"
  const jtWholePattern = /(\d+)\s*(?:jt|juta)\b/;
  const jtWholeMatch = lower.match(jtWholePattern);
  if (jtWholeMatch) {
    return parseInt(jtWholeMatch[1], 10) * 1_000_000;
  }

  // Pattern 3: Format ribuan — "10rb", "10ribu", "10 rb", "150 ribu"
  const rbPattern = /(\d+)[.,](\d+)\s*(?:rb|ribu)\b/;
  const rbMatch = lower.match(rbPattern);
  if (rbMatch) {
    const whole = parseInt(rbMatch[1], 10);
    const decimal = rbMatch[2];
    const fraction = parseInt(decimal, 10) / Math.pow(10, decimal.length);
    return Math.round((whole + fraction) * 1_000);
  }

  const rbWholePattern = /(\d+)\s*(?:rb|ribu)\b/;
  const rbWholeMatch = lower.match(rbWholePattern);
  if (rbWholeMatch) {
    return parseInt(rbWholeMatch[1], 10) * 1_000;
  }

  // Pattern 4: Format 'k' (kilo) — "200k", "50K"
  const kPattern = /(\d+)\s*k\b/;
  const kMatch = lower.match(kPattern);
  if (kMatch) {
    return parseInt(kMatch[1], 10) * 1_000;
  }

  // Pattern 5: Format angka Indonesia dengan titik ribuan — "50.000", "1.500.000"
  // Harus ada minimal 1 titik diikuti tepat 3 digit (bukan desimal)
  const dotThousandPattern = /(\d{1,3}(?:\.\d{3})+)\b/;
  const dotMatch = lower.match(dotThousandPattern);
  if (dotMatch) {
    // Hapus titik pemisah ribuan, lalu parse
    const cleaned = dotMatch[1].replace(/\./g, '');
    const value = parseInt(cleaned, 10);
    if (value > 0) return value;
  }

  // Pattern 6: Angka polos — "50000", "100000"
  const plainPattern = /(\d{3,})\b/;
  const plainMatch = lower.match(plainPattern);
  if (plainMatch) {
    const value = parseInt(plainMatch[1], 10);
    if (value > 0) return value;
  }

  // Tidak ditemukan jumlah uang
  return null;
}

/**
 * Cek apakah kata kunci ditemukan di teks pada batas kata (word boundary).
 * Ini mencegah false positive seperti 'makan' terdeteksi di 'dimakamkan'.
 *
 * @param {string} text - Teks yang dicari (sudah lowercase)
 * @param {string} keyword - Kata kunci yang dicek
 * @returns {boolean} true jika keyword ditemukan di batas kata
 */
function matchKeyword(text, keyword) {
  // Escape karakter khusus regex pada keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Gunakan \b untuk word boundary — cocok di awal/akhir kata
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

/**
 * Deteksi tipe transaksi (income/expense) dari teks.
 *
 * @param {string} text - Teks input (lowercase)
 * @returns {'income'|'expense'|null} Tipe transaksi, atau null jika tidak terdeteksi
 */
function detectType(text) {
  const lower = text.toLowerCase();

  // Cek kata kunci pemasukan
  for (const keyword of incomeKeywords) {
    if (matchKeyword(lower, keyword)) {
      return 'income';
    }
  }

  // Cek kata kunci pengeluaran
  for (const keyword of expenseKeywords) {
    if (matchKeyword(lower, keyword)) {
      return 'expense';
    }
  }

  // Tidak ditemukan kata kunci yang cocok
  return null;
}

/**
 * Deteksi kategori transaksi berdasarkan kata kunci dalam teks.
 *
 * @param {string} text - Teks input
 * @param {'income'|'expense'} type - Tipe transaksi
 * @returns {string} Nama kategori (atau 'Lainnya' jika tidak cocok)
 */
function detectCategory(text, type) {
  const lower = text.toLowerCase();
  const categoryMap = type === 'income' ? incomeCategories : expenseCategories;

  // Iterasi setiap kategori dan cek kata kuncinya
  for (const [category, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (matchKeyword(lower, keyword)) {
        return category;
      }
    }
  }

  // Default jika tidak ada yang cocok
  return 'Lainnya';
}

/**
 * Bersihkan teks dan jadikan deskripsi yang rapi.
 * Mengkapitalisasi huruf pertama.
 *
 * @param {string} text - Teks mentah dari pengguna
 * @returns {string} Deskripsi yang sudah dibersihkan
 */
function cleanDescription(text) {
  // Hapus spasi berlebih
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // Kapitalisasi huruf pertama
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Parse teks Bahasa Indonesia menjadi objek transaksi keuangan.
 *
 * Fungsi utama modul ini. Menganalisis teks bebas dan mengekstrak:
 *   - type: 'income' atau 'expense'
 *   - category: kategori otomatis berdasarkan kata kunci
 *   - description: teks asli yang sudah dibersihkan
 *   - amount: jumlah uang dalam Rupiah
 *
 * @param {string} text - Teks input dari pengguna
 * @returns {{ type: string, category: string, description: string, amount: number }|null}
 *   Objek transaksi, atau null jika teks bukan transaksi valid
 *
 * @example
 *   parseTransaction('beli bakso 15rb')
 *   // → { type: 'expense', category: 'Makanan', description: 'Beli bakso 15rb', amount: 15000 }
 *
 *   parseTransaction('gaji bulan ini 5jt')
 *   // → { type: 'income', category: 'Gaji', description: 'Gaji bulan ini 5jt', amount: 5000000 }
 *
 *   parseTransaction('halo apa kabar')
 *   // → null (bukan transaksi)
 */
function parseTransaction(text) {
  // Validasi input
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  // Langkah 1: Deteksi tipe transaksi
  const type = detectType(trimmed);
  if (!type) {
    // Tidak ada kata kunci yang cocok — bukan transaksi
    return null;
  }

  // Langkah 2: Ekstrak jumlah uang
  const amount = extractAmount(trimmed);
  if (!amount || amount <= 0) {
    // Tidak ada jumlah uang yang valid — bukan transaksi
    return null;
  }

  // Langkah 3: Deteksi kategori
  const category = detectCategory(trimmed, type);

  // Langkah 4: Bersihkan deskripsi
  const description = cleanDescription(trimmed);

  return {
    type,
    category,
    description,
    amount,
  };
}

module.exports = {
  parseTransaction,
  // Ekspor internal untuk keperluan testing
  extractAmount,
  detectType,
  detectCategory,
  cleanDescription,
  matchKeyword,
  expenseKeywords,
  incomeKeywords,
};
