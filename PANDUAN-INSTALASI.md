# CHEM•INV v3 — Panduan Migrasi ke GitHub Pages + Apps Script API

Arsitektur baru:

```
GitHub Pages (tampilan)                      Google Apps Script (backend)
https://NAMA.github.io/...        ──fetch──►  Web App /exec  ──►  Google Sheets + Drive
index.html • css/ • js/ • img/                Kode.gs (REST API JSON, login nama + password)
```

- **Data tidak dipindah.** Spreadsheet `DB_CHEM-INV`, folder Drive (SDS, foto, label, cadangan), pengguna, dan password tetap sama.
- Staf sekarang membuka **alamat GitHub Pages**, bukan lagi URL `/exec`. URL `/exec` hanya menjadi "pintu data" (API).
- Backend di-deploy dengan akses **Siapa saja** supaya bisa dipanggil dari GitHub Pages. Semua data tetap dilindungi **login nama + password** di server (password disimpan dalam bentuk hash, 5 kali salah → kunci 15 menit).

---

## BAGIAN A — Backend (Apps Script)

Pakai **proyek Apps Script yang sama** dengan yang sekarang, supaya data langsung tersambung.

1. Buka proyek Apps Script **CHEM-INV**.
2. Buka berkas **Kode**, hapus semua isinya, tempel isi **Kode.gs** versi 3.0.0, lalu simpan (Ctrl+S).
3. Hapus berkas **Index**, **Stylesheet**, dan **JavaScript** (klik ⋮ di samping nama berkas → Hapus). Tampilan sekarang ada di GitHub.
4. Pilih fungsi **setupAppEnvironment** → ▶ **Jalankan**. Aman diulang: data tidak ditimpa.
5. Ubah deployment:
   - **Terapkan → Kelola deployment** → pilih deployment yang ada → ✏️ **Edit**
   - **Versi:** Versi baru
   - **Jalankan sebagai:** Saya
   - **Yang memiliki akses:** **Siapa saja**
   - Klik **Terapkan**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
   - Kalau pilihan akses tidak bisa diubah, buat **Deployment baru → Aplikasi web** dengan pengaturan di atas.
6. Tes: buka URL `/exec` di browser. Yang muncul harus teks seperti
   `{"success":true,"message":"API CHEM-INV aktif",...}`. Ini normal — `/exec` sekarang hanya API.
7. Opsional: jalankan **cekInstalasi** → di Log eksekusi semua baris harus ✅.

> ⚠️ Jangan bagikan spreadsheet database ke staf, dan jangan menambah editor di proyek Apps Script.

---

## BAGIAN B — Frontend (GitHub Pages)

### B1. Isi alamat backend
Buka `js/config.js`, ganti `https://script.google.com/macros/s/GANTI_DENGAN_ID_DEPLOYMENT/exec` dengan URL `/exec` dari langkah A5.
URL ini **bukan rahasia** dan memang terlihat publik di GitHub; yang menjaga data adalah login.

> Kalau `js/config.js` belum diisi, aplikasi menampilkan layar **"Hubungkan ke server"** untuk menempel URL `/exec` — tersimpan hanya di perangkat itu. Untuk semua staf, isi permanen di `js/config.js`.

### B2. Unggah ke GitHub
**Folder yang diunggah = folder hasil ekstrak `chem-inv-web`**, yaitu folder yang **langsung** berisi `index.html`, `css`, `js`, `img`. Bukan folder induknya.

Jangan pakai tombol "Upload files" di web GitHub — struktur folder `css/` dan `js/` akan rusak. Pilih salah satu:

- **Dikerjakan Claude** (tanpa terminal): buat repository kosong (Public, tanpa README), lalu beri tahu Claude nama repository-nya. Claude yang mengunggah.
- **Terminal / PowerShell**, dari dalam folder `chem-inv-web` (cek dulu dengan `dir` bahwa `index.html` ada di baris teratas):
  ```
  git init
  git add .
  git commit -m "CHEM-INV v3"
  git branch -M main
  git remote add origin https://github.com/NAMA/REPO.git
  git push -u origin main
  ```
  Password saat push = **Personal Access Token** (github.com/settings/tokens, centang scope *repo*), bukan password akun.
- **GitHub Desktop**: Add Local Repository → pilih folder `chem-inv-web` → Publish repository (hilangkan centang *Keep this code private*).

### B3. Aktifkan Pages
Repository → **Settings → Pages**: Source **Deploy from a branch**, Branch **main** / **(root)** → Save. Centang **Enforce HTTPS**.
Tunggu 1–2 menit; alamat situs muncul di halaman itu.

---

## BAGIAN C — Uji
1. Buka alamat GitHub Pages → layar masuk CHEM•INV muncul.
2. Masuk dengan akun yang sudah ada (nama + password sama seperti sebelumnya).
3. Coba Ambil Barang atau Terima Barang, lalu cek sheet di spreadsheet.
4. Di HP: buka alamat yang sama → menu browser → **Tambahkan ke layar utama** (ikon CHEM•INV).

## Memperbarui di kemudian hari
- **Tampilan** (index.html, css, js): unggah ulang ke GitHub. Tekan **Ctrl+Shift+R** bila masih tampil versi lama.
- **Backend** (Kode.gs): tempel ulang di Apps Script → **Kelola deployment → Edit → Versi baru**. URL `/exec` tetap sama, jadi `js/config.js` tidak perlu diubah.

## Bila ada masalah

| Yang terlihat | Penyebab & solusi |
|---|---|
| "Tidak dapat menghubungi server… pastikan deployment … Siapa saja" | Akses deployment bukan **Siapa saja**, atau URL di `js/config.js` salah. Ulangi A5 lalu B1. |
| "Server tidak mengembalikan data JSON" | URL bukan `/exec` dari deployment ini, atau deployment belum versi baru. |
| Layar "Hubungkan ke server" muncul | `js/config.js` belum diisi URL `/exec`. |
| "Tahap tertahan: html" / halaman tanpa warna | Folder `css/` atau `js/` tidak ikut terunggah (file rata di root). Unggah ulang dengan struktur folder utuh. |
| GitHub Pages 404 | `index.html` tidak di root repository (folder induk yang terunggah), atau Pages belum diaktifkan (B3). |
| Tampil versi lama | Cache browser — Ctrl+Shift+R atau buka jendela Incognito. |
| "Terlalu banyak percobaan gagal" | 5 kali salah password → tunggu 15 menit, atau Admin mengatur ulang password. |
