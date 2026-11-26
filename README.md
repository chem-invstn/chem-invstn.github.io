# CHEM•INV — Santan Laboratory

🔗 Aplikasi: **https://chem-invstn.github.io**

Sistem inventaris bahan kimia laboratorium: terima & ambil barang (FEFO), stok, PO & reservasi gudang, cek stok fisik (opname), lembar keselamatan (SDS), laporan.

- **Frontend:** HTML/CSS/JS statis di GitHub Pages (repository ini)
- **Backend:** Google Apps Script (REST API JSON) + Google Sheets & Drive — kode `Kode.gs` disimpan di Apps Script, tidak di sini
- **Keamanan:** login nama + password (hash di server), sesi token, kunci 15 menit setelah 5 kali salah

Konfigurasi satu-satunya: `js/config.js` (URL Web App `/exec`). Panduan: `PANDUAN-INSTALASI.md`.

Versi 3.0.0
