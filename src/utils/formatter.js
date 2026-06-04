/**
 * formatter.js — Utilitas format mata uang dan tanggal untuk Data Bot
 *
 * Semua format mengikuti standar Indonesia:
 *   • Mata uang: Rp 10.000 (titik sebagai pemisah ribuan)
 *   • Tanggal  : 3 Juni 2026 (nama bulan dalam Bahasa Indonesia)
 *
 * @module utils/formatter
 */

// Nama-nama bulan dalam Bahasa Indonesia
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format angka menjadi format Rupiah Indonesia.
 * Contoh: 10000 → 'Rp 10.000'
 *
 * @param {number} number - Jumlah uang (bilangan bulat atau desimal)
 * @returns {string} String terformat, misal 'Rp 10.000'
 */
function formatRupiah(number) {
  // Pastikan input berupa angka
  const num = Number(number);
  if (isNaN(num)) return 'Rp 0';

  // Bulatkan ke bilangan bulat (Rupiah tidak pakai sen)
  const rounded = Math.round(num);

  // Gunakan toLocaleString dengan locale 'id-ID' untuk format Indonesia,
  // lalu tambahkan prefix 'Rp '
  const formatted = Math.abs(rounded)
    .toLocaleString('id-ID');

  // Tangani angka negatif
  return rounded < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Format objek Date menjadi tanggal panjang Indonesia.
 * Contoh: new Date('2026-06-03') → '3 Juni 2026'
 *
 * @param {Date|string|number} date - Tanggal yang akan diformat
 * @returns {string} String tanggal, misal '3 Juni 2026'
 */
function formatDate(date) {
  const d = _ensureDate(date);
  if (!d) return '-';

  const tanggal = d.getDate();
  const bulan = BULAN[d.getMonth()];
  const tahun = d.getFullYear();

  return `${tanggal} ${bulan} ${tahun}`;
}

/**
 * Format objek Date menjadi tanggal + waktu Indonesia.
 * Contoh: '3 Juni 2026, 14:30'
 *
 * @param {Date|string|number} date - Tanggal/waktu yang akan diformat
 * @returns {string} String tanggal-waktu, misal '3 Juni 2026, 14:30'
 */
function formatDateTime(date) {
  const d = _ensureDate(date);
  if (!d) return '-';

  const tanggalStr = formatDate(d);
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');

  return `${tanggalStr}, ${jam}:${menit}`;
}

/**
 * Format objek Date menjadi tanggal pendek DD/MM/YYYY.
 * Contoh: new Date('2026-06-03') → '03/06/2026'
 *
 * @param {Date|string|number} date - Tanggal yang akan diformat
 * @returns {string} String tanggal pendek, misal '03/06/2026'
 */
function formatShortDate(date) {
  const d = _ensureDate(date);
  if (!d) return '-';

  const tanggal = String(d.getDate()).padStart(2, '0');
  const bulan = String(d.getMonth() + 1).padStart(2, '0');
  const tahun = d.getFullYear();

  return `${tanggal}/${bulan}/${tahun}`;
}

/**
 * Helper internal: konversi berbagai tipe input menjadi objek Date yang valid.
 *
 * @param {Date|string|number} input - Input tanggal
 * @returns {Date|null} Objek Date yang valid, atau null jika gagal
 * @private
 */
function _ensureDate(input) {
  if (!input) return null;

  // Jika sudah berupa Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Coba parse dari string atau timestamp
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
  formatRupiah,
  formatDate,
  formatDateTime,
  formatShortDate,
  // Ekspor juga daftar bulan untuk keperluan modul lain
  BULAN,
};
