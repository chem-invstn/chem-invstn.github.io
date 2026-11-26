/*! CHEM•INV v3.0.0 — Santan Laboratory | frontend statis, data lewat API Apps Script */
(function () {
'use strict';
window.__ciStage = 'js';
/**
 * ============================================================
 * CHEM•INV — Frontend JavaScript (SPA instan)
 * Prinsip: (1) semua halaman dimuat sekali, navigasi lokal 0 ms;
 * (2) optimistic UI + localStorage (draf & outbox);
 * (3) state master di memori (window.App), cari/filter lokal;
 * (4) satu panggilan server per aksi (batch di backend).
 * Frontend statis (GitHub Pages) — semua data lewat fetch ke API Apps Script.
 * ============================================================
 */
'use strict';

// ════════════════════════════════════════════════════════
// BAGIAN 1: KONSTANTA & STATE
// ════════════════════════════════════════════════════════

const VIEWS = [
  { id: 'dashboard', main: true, label: 'Beranda', icon: 'bi-house-door', color: '#2563EB' },
  { id: 'terima', main: true, label: 'Terima Barang', title: 'Terima Barang', sub: 'Catat bahan yang baru datang', icon: 'bi-box-arrow-in-down', color: '#0D9488' },
  { id: 'ambil', main: true, label: 'Ambil Barang', title: 'Ambil Barang', sub: 'Sistem memilihkan botol yang harus dipakai duluan', icon: 'bi-eyedropper', color: '#2563EB' },
  { id: 'stok', main: true, label: 'Stok Barang', title: 'Stok Barang', sub: 'Lihat jumlah, lokasi, dan tanggal kedaluwarsa', icon: 'bi-boxes', color: '#7C3AED' },
  { id: 'po', main: true, mparent: 'lainnya', label: 'PO dan Reservasi', title: 'PO dan Reservasi', sub: 'Pesanan pembelian ke pemasok & reservasi barang dari gudang', icon: 'bi-cart3', color: '#D97706' },
  { id: 'lainnya', main: true, label: 'Lainnya', title: 'Menu Lainnya', sub: 'Fitur tambahan untuk pengecekan & administrasi', icon: 'bi-grid', color: '#EA580C' },
  { id: 'opname', parent: 'lainnya', label: 'Cek Stok Fisik', title: 'Cek Stok Fisik (Opname)', sub: 'Hitung isi rak lalu cocokkan dengan catatan sistem', icon: 'bi-clipboard-check', color: '#16A34A' },
  { id: 'sds', parent: 'lainnya', label: 'Lembar Keselamatan', title: 'Lembar Keselamatan (SDS)', sub: 'Dokumen keselamatan setiap bahan kimia', icon: 'bi-shield-check', color: '#DC2626' },
  { id: 'master', parent: 'lainnya', label: 'Data Dasar', title: 'Data Dasar', sub: 'Daftar bahan, pemasok, lokasi, dan satuan', icon: 'bi-database', color: '#0891B2' },
  { id: 'audit', parent: 'lainnya', label: 'Laporan & Riwayat', title: 'Laporan & Riwayat', sub: 'Siapa melakukan apa, kapan — dan unduh laporan', icon: 'bi-bar-chart-line', color: '#7C3AED' },
  { id: 'pengaturan', parent: 'lainnya', label: 'Pengaturan', title: 'Pengaturan', sub: 'Pengguna, aturan, dan jadwal otomatis', icon: 'bi-gear', color: '#475569', admin: true }
];

const EN = {
  kondisi: ['Baik', 'Bocor', 'Label rusak', 'Segel terbuka', 'Pecah'],
  alasan_selisih: ['Kurang kirim', 'Lebih kirim', 'Rusak', 'Salah barang', 'Satuan berbeda', 'Lainnya'],
  tanpa_po: ['Warehouse Stock', 'Sampel gratis', 'Pembelian darurat', 'Hibah', 'Pindahan dari lab lain', 'Lainnya'],
  tujuan: ['Analisis rutin', 'Preparasi reagen', 'Kalibrasi/standar', 'Penelitian/R&D', 'Pelatihan', 'Lainnya'],
  alasan_override: ['Botol terbuka dipakai dulu', 'Lokasi lebih dekat', 'Saran tidak ditemukan fisik', 'Persyaratan metode/grade', 'Lainnya'],
  kategori: ['Pelarut', 'Asam', 'Basa', 'Reagen/Garam', 'Standar', 'Indikator', 'Consumable', 'Lainnya'],
  bentuk: ['Padat', 'Cair', 'Gas', 'N/A'],
  satuan_dasar: ['g', 'mL', 'pcs'],
  tipe_lokasi: ['Gudang', 'Rak', 'Lemari asam', 'Lemari bahan mudah terbakar', 'Kulkas', 'Freezer', 'Lainnya'],
  peran: ['Admin', 'Lead Lab Tech', 'Analyst', 'Jr. Analyst'],
  ghs: { GHS01: 'Bahan peledak', GHS02: 'Mudah menyala', GHS03: 'Pengoksidasi', GHS04: 'Gas bertekanan', GHS05: 'Korosif', GHS06: 'Toksik akut', GHS07: 'Berbahaya/iritan', GHS08: 'Bahaya kesehatan', GHS09: 'Bahaya lingkungan' }
};
const TOL = 0.0001;
const AKTIF = ['Tersedia', 'Terbuka'];
const AKHIR = ['Habis', 'Retur', 'Dibuang', 'Hilang', 'Dibatalkan'];

/** Peta nama sheet server → kunci state klien & kolom ID */
const TMAP = {
  Users: ['users', 'user_id'], Lokasi: ['lokasi', 'lokasi_id'], Supplier: ['supplier', 'supplier_id'], Master_Bahan: ['bahan', 'bahan_id'],
  Konversi_Satuan: ['konversi', 'konv_id'], SDS: ['sds', 'sds_id'], PO_Header: ['po_header', 'po_no'], PO_Item: ['po_item', 'po_item_id'],
  Batch: ['batch', 'batch_id'], Wadah: ['wadah', 'wadah_id'], Stok_Opname: ['opname', 'opname_id'], Opname_Detail: ['opname_detail', 'detail_id'],
  Pengambilan: ['pengambilan', 'ambil_id'], Mutasi_Wadah: ['mutasi', 'mutasi_id']
};

/** State global aplikasi (frontend cache) */
const App = window.App = {
  token: null, user: null, S: null, idx: {}, view: null, dirty: new Set(), modals: [], busy: 0, writing: 0,
  lastLat: null, serverVer: null, online: true, outbox: [], rollbacks: {}, charts: {}, pendingRender: false,
  ui: {
    dash: { fefoFilter: 'all', trendBahan: null },
    stok: { mode: 'katalog', q: '', kat: 'SEMUA', st: 'SEMUA', lok: '', sds: 'SEMUA', sel: null, page: 1, expTier: 90 },
    master: { tab: 'bahan', q: '', potab: 'PO' },
    audit: { tab: 'audit', f: {}, offset: 0, rows: null, total: 0, rep: 'pengambilan', dari: '', sampai: '', repData: null },
    opname: { sel: null, filter: 'all' },
    sds: { f: 'all', q: '' },
    peng: { tab: 'users' }
  }
};

// ════════════════════════════════════════════════════════
// BAGIAN 2: UTILITAS
// ════════════════════════════════════════════════════════

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const r4 = x => Math.round(Number(x) * 10000) / 10000;
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const nf = {};
function fmtN(v, d) { d = d === undefined ? 2 : d; const k = 'n' + d; nf[k] = nf[k] || new Intl.NumberFormat('id-ID', { maximumFractionDigits: d }); return nf[k].format(num(v)); }
function fmtQ(v, u) { return fmtN(v) + (u ? ' ' + u : ''); }
function dUTC(s) { const p = String(s).substr(0, 10).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function addDays(s, n) { const d = new Date(dUTC(s) + n * 864e5); return d.toISOString().substr(0, 10); }
function daysBetween(a, b) { return Math.round((dUTC(b) - dUTC(a)) / 864e5); }
function today() { try { return new Intl.DateTimeFormat('sv-SE', { timeZone: (App.S && App.S.tz) || undefined }).format(new Date()); } catch (e) { return new Date().toISOString().substr(0, 10); } }
function nowTxt() { try { return new Intl.DateTimeFormat('sv-SE', { timeZone: (App.S && App.S.tz) || undefined, dateStyle: 'short', timeStyle: 'medium' }).format(new Date()).replace(',', ''); } catch (e) { return new Date().toISOString().replace('T', ' ').substr(0, 19); } }
function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function dTxt(s) { if (!s) return '—'; if (String(s).startsWith('9999')) return 'Tidak ada'; return String(s).substr(0, 10); }
function tTxt(s) { return s ? String(s).substr(11, 5) : ''; }
function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9µ%\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); }; }
function initials(n) { return String(n || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join(''); }
function userName(id) { const u = App.idx.usersById && App.idx.usersById.get(String(id || '')); return u ? u.nama : (id === 'SISTEM' || id === 'SYS' ? 'Sistem' : String(id || '—').split('@')[0]); }
function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function isValidCAS(cas) {
  if (!/^\d{2,7}-\d{2}-\d$/.test(cas)) return false;
  const d = cas.replace(/-/g, ''); const chk = +d.slice(-1);
  return d.slice(0, -1).split('').reverse().reduce((a, c, i) => a + (+c) * (i + 1), 0) % 10 === chk;
}
function opts(list, sel, ph) {
  return (ph !== undefined ? `<option value="">${esc(ph)}</option>` : '') + list.map(o => {
    const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
    return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// BAGIAN 3: KOMUNIKASI SERVER (fetch → GAS Web App /exec → doPost → apiCall)
// ════════════════════════════════════════════════════════
const PLACEHOLDER_URL = /GANTI_DENGAN|XXXX/;
/** Alamat API: js/config.js (untuk semua pengguna), atau yang disimpan lewat layar "Hubungkan server" di perangkat ini. */
function apiUrl() {
  const c = (window.APP_CONFIG && window.APP_CONFIG.GAS_URL) || '';
  let u = c && !PLACEHOLDER_URL.test(c) ? c : '';
  if (!u) { try { u = localStorage.getItem('ci_api') || ''; } catch (e) { } }
  return /^https:\/\/script\.google\.com\/.+\/exec$|^http:\/\/localhost[:\/]/.test(u) ? u : '';
}
/** POST JSON sebagai text/plain (tanpa CORS preflight — syarat GAS). */
async function callApi(url, body, timeoutMs) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const tm = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 90000) : null;
  let res, txt;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', signal: ctl ? ctl.signal : undefined });
    txt = await res.text();
  } catch (e) {
    const abort = e && e.name === 'AbortError';
    throw { network: true, message: abort ? 'Server terlalu lama merespons. Coba lagi.' : (navigator.onLine === false ? 'Perangkat sedang offline.' : 'Tidak dapat menghubungi server. Periksa koneksi, atau pastikan deployment Apps Script diatur "Siapa saja".') };
  } finally { if (tm) clearTimeout(tm); }
  try { return JSON.parse(txt); }
  catch (e) { throw { network: true, message: 'Server tidak mengembalikan data JSON (status ' + res.status + '). Pastikan URL /exec benar dan deployment versi terbaru.' }; }
}
function rpc(action, payload) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const write = !/^(sync|get|bootstrap|ping)/.test(action);
    App.busy++; if (write) App.writing++; updateStatus();
    const done = () => { App.busy--; if (write) App.writing--; App.lastLat = Math.round(performance.now() - t0); updateStatus(); };
    const url = apiUrl();
    if (!url) { done(); reject({ network: true, noUrl: true, message: 'Alamat server belum diatur.' }); return; }
    callApi(url, { action, token: App.token || null, payload: payload || {} }).then(res => {
      done(); App.online = true;
      if (!res) return reject({ message: 'Respons server kosong.' });
      if (res.success) { if (res.ver && write) App.serverVer = res.ver; resolve(res.data); }
      else { if (res.code === 'AUTH' && App.user) onAuthLost(res.message); reject(res); }
    }, err => { done(); App.online = false; updateStatus(); reject(err); });
  });
}

/** Panggilan tulis dengan umpan balik tombol + gabung delta. */
async function act(action, payload, opt) {
  opt = opt || {};
  const btn = opt.btn; let html;
  if (btn) { html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + esc(opt.busy || 'Menyimpan…'); }
  try {
    const d = await rpc(action, payload);
    if (d && d.delta) mergeDelta(d.delta, { now: true });
    if (opt.ok) toast(typeof opt.ok === 'function' ? opt.ok(d) : opt.ok, 'ok');
    return d;
  } catch (e) {
    if (!opt.quiet) showErr(e, opt.form);
    throw e;
  } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
}

function showErr(e, form) {
  const msg = (e && e.message) || 'Terjadi kesalahan.';
  if (form && e && e.field) {
    $$('.ferr', form).forEach(x => x.remove()); $$('.bad', form).forEach(x => x.classList.remove('bad'));
    const f = form.querySelector(`[name="${e.field}"]`);
    if (f) { f.classList.add('bad'); f.insertAdjacentHTML('afterend', `<div class="ferr">${esc(msg)}</div>`); f.focus(); }
  }
  toast(e && e.network ? 'Koneksi gagal: ' + msg + ' — data lokal aman, coba lagi.' : msg, 'err');
}

function onAuthLost(msg) {
  App.token = null; try { sessionStorage.removeItem('ci_tok'); } catch (e) { }
  toast(msg || 'Sesi berakhir.', 'err');
  showLogin({});
}

// ── Gabung delta & indeks ──
function mergeDelta(d, o) {
  const S = App.S; if (!S) return;
  Object.keys(d).forEach(tn => {
    const m = TMAP[tn]; if (!m) return;
    const key = m[0], id = m[1];
    if (tn === 'Mutasi_Wadah') {
      const ids = new Set(d[tn].map(x => x.mutasi_id));
      S.mutasi = S.mutasi.filter(x => !x._opt && !ids.has(x.mutasi_id)).concat(d[tn]);
      S.mutasi.sort((a, b) => a.waktu < b.waktu ? -1 : a.waktu > b.waktu ? 1 : 0);
      if (S.mutasi.length > 800) S.mutasi = S.mutasi.slice(-800);
      return;
    }
    if (tn === 'Pengambilan') S.pengambilan = S.pengambilan.filter(x => !x._opt);
    if (tn === 'Opname_Detail') S.opname_detail = S.opname_detail.filter(x => !(x._opt && d[tn].some(r => r.opname_id === x.opname_id && r.wadah_id === x.wadah_id)));
    const arr = S[key] = S[key] || [];
    const pos = new Map(arr.map((r, i) => [String(r[id]), i]));
    d[tn].forEach(r => { const i = pos.get(String(r[id])); if (i === undefined) { pos.set(String(r[id]), arr.length); arr.push(r); } else arr[i] = r; });
  });
  S.wadah = S.wadah.filter(w => !w.arsip);
  reindex(); markAll(); rerender(o);
}

function replaceState(state) {
  const keepMut = App.S ? App.S.mutasi.filter(m => m._opt) : [];
  App.S = state; App.S.mutasi = (state.mutasi || []).concat(keepMut);
  reindex(); markAll();
}

function reindex() {
  const S = App.S, I = {};
  const by = (arr, k) => { const m = new Map(); (arr || []).forEach(r => m.set(String(r[k]), r)); return m; };
  I.bahan = by(S.bahan, 'bahan_id'); I.wadah = by(S.wadah, 'wadah_id'); I.batch = by(S.batch, 'batch_id');
  I.lokasi = by(S.lokasi, 'lokasi_id'); I.supplier = by(S.supplier, 'supplier_id'); I.usersById = by(S.users, 'user_id');
  I.poItem = by(S.po_item, 'po_item_id'); I.po = by(S.po_header, 'po_no'); I.sds = by(S.sds, 'sds_id');
  I.wByB = new Map(); S.wadah.forEach(w => { if (!I.wByB.has(w.bahan_id)) I.wByB.set(w.bahan_id, []); I.wByB.get(w.bahan_id).push(w); });
  I.sdsByB = new Map(); S.sds.forEach(s => { if (!I.sdsByB.has(s.bahan_id)) I.sdsByB.set(s.bahan_id, []); I.sdsByB.get(s.bahan_id).push(s); });
  I.poOpen = new Map(); S.po_item.filter(i => i.status_item === 'Terbuka' || i.status_item === 'Sebagian')
    .forEach(i => I.poOpen.set(i.bahan_id, (I.poOpen.get(i.bahan_id) || 0) + Math.max(0, num(i.qty_pesan_dasar) - num(i.qty_diterima_dasar))));
  App.idx = I;
  I.stat = new Map(); S.bahan.forEach(b => I.stat.set(b.bahan_id, bahanStat(b)));
  App.S.settings = App.S.settings || {};
}

const setB = k => String((App.S.settings || {})[k] || '').toUpperCase() === 'TRUE';
const setN = k => num((App.S.settings || {})[k]);

/** Statistik turunan per bahan — dihitung lokal (instan). */
function bahanStat(b) {
  const I = App.idx, t = today();
  const ws = I.wByB.get(b.bahan_id) || [];
  let ef = 0, terbuka = 0, segel = 0, exp30 = 0, expd = 0, kar = 0, aktifN = 0;
  ws.forEach(w => {
    const st = dispStatus(w);
    if (st === 'Karantina') kar++;
    if (st === 'Kedaluwarsa') expd++;
    if (AKTIF.indexOf(st) >= 0) {
      aktifN++; ef += num(w.qty_sisa_dasar) - num(w.qty_cadangan_dasar);
      if (st === 'Terbuka') terbuka++; else segel++;
      if (daysLeft(w) <= 30) exp30++;
    }
  });
  const poOpen = I.poOpen.get(b.bahan_id) || 0;
  const ps = ef + poOpen;
  const rop = num(b.reorder_point), ss = num(b.safety_stock);
  let info = null; try { info = b.rop_info ? JSON.parse(b.rop_info) : null; } catch (e) { info = null; }
  const sdsSt = sdsStatus(b.bahan_id);
  // Saran pesan (5.5)
  let q = 0;
  if (rop > 0 && ps <= rop + TOL) {
    const mu = info ? num(info.mu) : 0;
    const T = rop + mu * (setN('review_period_weeks') || 4);
    q = Math.max(0, T - ps);
    const pack = num(b.ukuran_kemasan_standar);
    if (pack > 0) q = Math.ceil(q / pack - 1e-9) * pack;
    const shelf = num(b.umur_simpan_tipikal_hari);
    if (shelf > 0 && mu > 0) {
      const lead = num(b.lead_time_hari) || setN('default_lead_time_days') || 14;
      const qmax = mu * Math.max(0, (shelf - lead) / 7);
      q = Math.min(q, Math.max(qmax, pack || 0));
      if (pack > 0) q = Math.max(pack, Math.floor(q / pack + 1e-9) * pack);
    }
  }
  return { ef: r4(ef), terbuka, segel, aktifN, exp30, expd, kar, poOpen: r4(poOpen), ps: r4(ps), rop, ss, low: rop > 0 && ps <= rop + TOL, info, sdsSt, q: r4(q), manualNeeded: b.reorder_mode !== 'MANUAL' && info && !info.cukup };
}

function sdsStatus(bahan_id) {
  const b = App.idx.bahan.get(bahan_id);
  if (b && String(b.butuh_sds) !== 'true' && b.butuh_sds !== true) return 'N/A';
  const rows = (App.idx.sdsByB.get(bahan_id) || []).filter(s => s.status !== 'Digantikan');
  const t = today();
  if (rows.some(s => s.status === 'Aktif' && String(s.tanggal_kedaluwarsa) >= t)) return 'Aktif';
  return rows.length ? 'Kedaluwarsa' : 'Tidak ada';
}
function activeSds(bahan_id, supplier_id) {
  const t = today();
  const act = (App.idx.sdsByB.get(bahan_id) || []).filter(s => s.status === 'Aktif' && String(s.tanggal_kedaluwarsa) >= t);
  return act.find(s => s.supplier_id && s.supplier_id === supplier_id) || act.find(s => !s.supplier_id) || act[0] || null;
}

/** Status tampilan (wadah yang melewati tanggal efektif tampil Kedaluwarsa walau job belum jalan). */
function dispStatus(w) {
  if (AKTIF.indexOf(w.status) >= 0 && String(w.tgl_kedaluwarsa_efektif) < today()) return 'Kedaluwarsa';
  return w.status;
}
function daysLeft(w) { const e = String(w.tgl_kedaluwarsa_efektif || '9999-12-31'); return e.startsWith('9999') ? 99999 : daysBetween(today(), e); }
function avail(w) { return r4(num(w.qty_sisa_dasar) - num(w.qty_cadangan_dasar)); }
function usable(w) { return AKTIF.indexOf(dispStatus(w)) >= 0 && avail(w) > TOL && !blockSds(w); }
function blockSds(w) {
  const b = App.idx.bahan.get(w.bahan_id);
  if (!b || !(b.butuh_sds === true || b.butuh_sds === 'true')) return false;
  return setB('block_on_expired_sds') && sdsStatus(w.bahan_id) !== 'Aktif';
}

/** FEFO lokal (urutan identik dengan server, 5.3). */
function fefo(bahan_id) {
  return (App.idx.wByB.get(bahan_id) || []).filter(usable).sort((a, b) => {
    const ea = String(a.tgl_kedaluwarsa_efektif), eb = String(b.tgl_kedaluwarsa_efektif);
    if (ea !== eb) return ea < eb ? -1 : 1;
    const oa = a.status === 'Terbuka' ? 0 : 1, ob = b.status === 'Terbuka' ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const sa = num(a.qty_sisa_dasar), sb = num(b.qty_sisa_dasar);
    if (Math.abs(sa - sb) > TOL) return sa - sb;
    return String(a.tgl_terima) < String(b.tgl_terima) ? -1 : String(a.tgl_terima) > String(b.tgl_terima) ? 1 : 0;
  });
}

/** Konversi ke satuan dasar (identik dengan server, 4.3). */
function toBase(b, qty, sat) {
  qty = num(qty);
  if (!(qty > 0)) return { err: 'Jumlah harus lebih dari 0.' };
  const base = b.satuan_dasar;
  if (sat === base) return { v: r4(qty) };
  const K = App.S.konversi;
  const r = K.find(k => k.bahan_id === b.bahan_id && k.dari_satuan === sat) || K.find(k => k.bahan_id === '*' && k.dari_satuan === sat);
  if (!r) return { err: `Konversi "${sat}" → "${base}" untuk ${b.nama_standar} belum ada.` };
  let v = qty * num(r.faktor);
  if (r.ke_satuan === base) return { v: r4(v), rule: r };
  const d = num(b.densitas_g_per_mL);
  if (r.ke_satuan === 'g' && base === 'mL') return d > 0 ? { v: r4(v / d), rule: r, dens: d } : { err: `Densitas ${b.nama_standar} belum diisi.` };
  if (r.ke_satuan === 'mL' && base === 'g') return d > 0 ? { v: r4(v * d), rule: r, dens: d } : { err: `Densitas ${b.nama_standar} belum diisi.` };
  return { err: `Satuan "${sat}" tidak dapat dikonversi ke "${base}".` };
}
function unitsFor(b) {
  if (!b) return [];
  const set = new Set([b.satuan_dasar]);
  App.S.konversi.forEach(k => {
    if (k.bahan_id !== '*' && k.bahan_id !== b.bahan_id) return;
    if (k.ke_satuan === b.satuan_dasar || (num(b.densitas_g_per_mL) > 0 && ((k.ke_satuan === 'g' && b.satuan_dasar === 'mL') || (k.ke_satuan === 'mL' && b.satuan_dasar === 'g')))) set.add(k.dari_satuan);
  });
  return Array.from(set);
}

// ════════════════════════════════════════════════════════
// BAGIAN 4: KOMPONEN UI (badge, toast, modal, konfirmasi)
// ════════════════════════════════════════════════════════

const STY = {
  Tersedia: ['s-ok', 'bi-check-square'], Terbuka: ['s-op', 'bi-droplet-half'], Karantina: ['s-qr', 'bi-sign-stop'],
  Kedaluwarsa: ['s-ex', 'bi-exclamation-triangle'], Habis: ['s-hb', 'bi-dash-square'], Retur: ['s-hb', 'bi-arrow-return-left'],
  Dibuang: ['s-hb', 'bi-trash3'], Hilang: ['s-ex', 'bi-question-square'], DRAFT: ['s-hb', 'bi-hourglass'], Dibatalkan: ['s-hb', 'bi-x-square'],
  Segera: ['s-sk', 'bi-clock-history'], Aktif: ['s-ok', 'bi-check-square'], Nonaktif: ['s-hb', 'bi-slash-square'], Digantikan: ['s-hb', 'bi-arrow-repeat'],
  'Tidak ada': ['s-ex', 'bi-x-octagon'], 'N/A': ['s-hb', 'bi-dash'], Terbuka_PO: ['s-op', 'bi-circle'], Sebagian: ['s-sk', 'bi-circle-half'], Selesai: ['s-ok', 'bi-check-square'],
  Batal: ['s-hb', 'bi-x-square'], Berjalan: ['s-op', 'bi-play-fill'], Diajukan: ['s-sk', 'bi-hourglass-split'], Disetujui: ['s-ok', 'bi-check2'], Ditolak: ['s-ex', 'bi-x'],
  Cocok: ['s-ok', 'bi-check-square'], 'Dalam toleransi': ['s-op', 'bi-check2'], 'Di atas toleransi': ['s-ex', 'bi-exclamation-triangle'],
  'Tidak ditemukan': ['s-sk', 'bi-search'], 'Tidak terdaftar': ['s-qr', 'bi-plus-square'], Terkirim: ['s-ok', 'bi-send-check'], Gagal: ['s-ex', 'bi-x-octagon'], Antre: ['s-sk', 'bi-hourglass']
};
function bdg(text, key, extraCls) {
  const s = STY[key || text] || ['s-hb', 'bi-dot'];
  return `<span class="bdg ${s[0]} ${extraCls || ''}"><i class="bi ${s[1]}" aria-hidden="true"></i>${esc(text)}</span>`;
}
function stBadge(w) { const s = dispStatus(w); return bdg(s); }
function expCell(w) {
  const e = w.tgl_kedaluwarsa_efektif; if (!e || String(e).startsWith('9999')) return '<span class="mono muted">Tanpa exp</span>';
  const d = daysLeft(w);
  const cls = d < 0 ? 'err-t b' : d <= 30 ? 'err-t' : d <= 90 ? '' : 'muted';
  const sub = d < 0 ? `lewat ${-d} hari` : `${d} hari tersisa`;
  return `<span class="mono ${cls}">${dTxt(e)}</span><span class="sub">${sub}${w.tgl_dibuka ? ' · buka ' + dTxt(w.tgl_dibuka) : ''}</span>`;
}
function ghsTags(s) { return String(s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean).map(g => `<span class="tag ghs-tag" title="${esc(EN.ghs[g] || g)}">${esc(g)}</span>`).join(' '); }
function lokName(id) { const l = App.idx.lokasi.get(id); return l ? l.nama : (id || '—'); }
function bahanName(id) { const b = App.idx.bahan.get(id); return b ? b.nama_standar : (id || '—'); }
function empty(msg, icon) { return `<div class="empty"><i class="bi ${icon || 'bi-inbox'}"></i>${esc(msg)}</div>`; }

function toast(msg, type) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  const ic = type === 'ok' ? 'bi-check2-square' : type === 'err' ? 'bi-x-octagon' : type === 'warn' ? 'bi-exclamation-triangle' : 'bi-info-square';
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = `<i class="bi ${ic}"></i><div>${esc(msg)}</div><button class="x" aria-label="Tutup">&times;</button>`;
  el.querySelector('.x').onclick = () => el.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 8000 : 4200);
  while (box.children.length > 4) box.firstChild.remove();
}

function modal(o) {
  const root = $('#modalRoot');
  const mask = document.createElement('div');
  mask.className = 'modal-mask' + (o.drawer ? ' drawer-mask' : '');
  mask.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''} ${o.drawer ? 'drawer' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <div class="modal-h"><h2>${esc(o.title)}</h2><button type="button" class="ibtn" data-act="mclose" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="modal-b">${o.body || ''}</div>${o.foot ? `<div class="modal-f">${o.foot}</div>` : ''}</div>`;
  const h = { el: mask, body: mask.querySelector('.modal-b'), foot: mask.querySelector('.modal-f'), close };
  function close() { mask.remove(); App.modals = App.modals.filter(x => x !== h); if (o.onClose) o.onClose(); }
  mask.addEventListener('mousedown', e => { if (e.target === mask) close(); });
  root.appendChild(mask); App.modals.push(h);
  if (o.onMount) o.onMount(h);
  setTimeout(() => { const f = mask.querySelector('[autofocus]') || mask.querySelector('.modal-b input:not([type=hidden]):not([readonly]),.modal-b select,.modal-b textarea'); if (f) f.focus(); }, 40);
  return h;
}
function topModal() { return App.modals[App.modals.length - 1]; }

/** Dialog konfirmasi; opsi input teks (alasan) & pilihan. Mengembalikan Promise<nilai|null>. */
function ask(o) {
  return new Promise(resolve => {
    let done = false;
    const inp = o.input ? `<div class="field mt12"><label>${esc(o.input.label)}${o.input.required ? ' <span class="req">*</span>' : ''}</label>
      ${o.input.options ? `<select class="sel" name="v">${opts(o.input.options, o.input.value || '', 'Pilih…')}</select>` :
        o.input.area ? `<textarea class="ta" name="v" placeholder="${esc(o.input.ph || '')}">${esc(o.input.value || '')}</textarea>` :
          `<input class="inp" name="v" type="${o.input.type || 'text'}" value="${esc(o.input.value || '')}" placeholder="${esc(o.input.ph || '')}">`}</div>` : '';
    const h = modal({
      title: o.title,
      body: `<div class="note ${o.tone || (o.danger ? 'err' : '')}"><i class="bi ${o.icon || (o.danger ? 'bi-exclamation-octagon' : 'bi-info-square')}"></i><div>${o.html || esc(o.msg || '')}</div></div>${inp}`,
      foot: `<button type="button" class="btn" data-act="mclose">${esc(o.cancel || 'Batal')}</button><button type="button" class="btn ${o.danger ? 'btn-d' : 'btn-p'}" data-ok="1">${esc(o.ok || 'Lanjutkan')}</button>`,
      onClose: () => { if (!done) resolve(null); }
    });
    h.el.querySelector('[data-ok]').onclick = () => {
      let v = true;
      if (o.input) {
        const f = h.el.querySelector('[name=v]'); v = String(f.value || '').trim();
        if (o.input.required && !v) { f.classList.add('bad'); f.focus(); return; }
      }
      done = true; h.close(); resolve(v);
    };
  });
}

/** Ambil nilai form (checkbox → boolean, angka tetap string kecuali data-num). */
function formVals(form) {
  const o = {};
  $$('[name]', form).forEach(el => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else if (el.multiple) o[el.name] = Array.from(el.selectedOptions).map(x => x.value);
    else o[el.name] = el.value.trim();
  });
  return o;
}

/** Ekspor CSV aman (cegah injeksi rumus, 8.4). */
function toCSV(rows, cols) {
  const safe = v => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\uFEFF' + [cols.map(c => safe(c.t || c.k)).join(',')].concat(rows.map(r => cols.map(c => safe(c.f ? c.f(r) : r[c.k])).join(','))).join('\n');
}
function download(content, name, mime) {
  try {
    const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } catch (e) {
    modal({ title: 'Salin data ekspor', body: `<p class="help">Unduhan diblokir browser. Salin teks berikut:</p><textarea class="ta mono" style="height:50vh">${esc(content)}</textarea>` });
  }
  rpc('eksporCatat', { entitas: 'Ekspor', nama: name }).catch(() => { });
}
function exportRows(name, rows, cols) { download(toCSV(rows, cols), name + '_' + today() + '.csv'); toast('Ekspor ' + rows.length + ' baris.', 'ok'); }

// ════════════════════════════════════════════════════════
// BAGIAN 5: ROUTER SPA, RENDER, STATUS
// ════════════════════════════════════════════════════════

const RENDER = {};   // view → fungsi render(el)
const ACT = {};      // data-act klik
const IN = {};       // data-in input
const CH = {};       // data-ch change
const SUB = {};      // data-sub form submit

function go(view, o) {
  o = o || {};
  const v = VIEWS.find(x => x.id === view);
  if (!v || (v.admin && App.user.peran !== 'Admin')) return;
  App.view = view;
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + view));
  if (o.prep) o.prep();
  renderTabs();
  render(view);
  if (!o.keepScroll) window.scrollTo(0, 0);
  closeDrop();
  try { sessionStorage.setItem('ci_view', view); } catch (e) { }
}
function pageHead(v) {
  const par = (v.parent || v.mparent) ? VIEWS.find(x => x.id === (v.parent || v.mparent)) : null;
  return (par ? `<div class="crumb ${v.mparent ? 'm-only' : ''}"><a href="javascript:void(0)" data-act="go" data-v="${par.id}"><i class="bi bi-arrow-left"></i> ${esc(par.label)}</a><span>/</span><span>${esc(v.label)}</span></div>` : '') +
    `<div class="page-title"><span class="pi" style="background:${v.color}"><i class="bi ${v.icon}"></i></span><div><h1 class="h-lg">${esc(v.title || v.label)}</h1>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}</div></div>`;
}
function render(view) {
  const el = document.getElementById('v-' + view);
  if (!el || !RENDER[view]) return;
  Object.keys(App.charts).forEach(k => { if (k.startsWith(view + ':')) { try { App.charts[k].destroy(); } catch (e) { } delete App.charts[k]; } });
  try {
    RENDER[view](el);
    const v = VIEWS.find(x => x.id === view);
    if (v && v.title) el.insertAdjacentHTML('afterbegin', pageHead(v));
  }
  catch (e) { console.error(e); el.innerHTML = `<div class="note err"><i class="bi bi-bug"></i><div>Gagal menampilkan halaman: ${esc(e.message)}</div></div>`; }
  App.dirty.delete(view);
  renderBell();
}
function markAll() { VIEWS.forEach(v => App.dirty.add(v.id)); }
/** Render ulang tampilan aktif; ditunda bila pengguna sedang mengetik (hindari kehilangan fokus). */
function rerender(o) {
  if (!App.view) return;
  const ae = document.activeElement;
  const typing = ae && $('#main').contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if (typing && !(o && o.now)) {
    if (!App.pendingRender) {
      App.pendingRender = true;
      ae.addEventListener('blur', () => setTimeout(() => { App.pendingRender = false; if (!App.modals.length) render(App.view); }, 50), { once: true });
    }
    renderBell(); return;
  }
  render(App.view);
}

function renderTabs() {
  const cur = VIEWS.find(x => x.id === App.view) || {};
  const active = cur.parent || cur.mparent || cur.id;
  const admin = App.user && App.user.peran === 'Admin';
  const item = v => `<button class="snav ${App.view === v.id ? 'on' : ''}" data-act="go" data-v="${v.id}" title="${esc(v.label)}" aria-current="${App.view === v.id}">
    <span class="si" style="--c:${v.color}"><i class="bi ${v.icon}"></i></span><span class="side-lbl">${esc(v.label)}</span></button>`;
  const nav = $('#sideNav');
  if (nav) nav.innerHTML = VIEWS.filter(v => v.main && v.id !== 'lainnya').map(item).join('') +
    `<div class="sgrp"><span class="side-lbl">Lainnya</span></div>` + VIEWS.filter(v => v.parent === 'lainnya' && (!v.admin || admin)).map(item).join('');
  $$('.mbar [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === active));
}

function updateStatus() {
  const chip = $('#syncChip'); if (!chip) return;
  const pend = App.outbox.length;
  chip.className = 'sync-chip hide-m ' + (!App.online ? 'off' : App.writing ? 'busy' : pend ? 'pend' : '');
  $('#syncTxt').textContent = !App.online ? 'Offline · ' + pend + ' menunggu' : App.writing ? 'Menyimpan…' : pend ? pend + ' menunggu kirim' : App.busy ? 'Memperbarui…' : 'Tersimpan';
}

/** Rail kiri: ringkasan terminal (desktop lebar). */
function renderRail() {
  const S = App.S; if (!S || !$('#rail')) return;
  const I = App.idx;
  const aktif = S.wadah.filter(w => AKTIF.indexOf(dispStatus(w)) >= 0);
  const fl = aktif.filter(w => { const b = I.bahan.get(w.bahan_id); return b && /GHS02/.test(b.kelas_bahaya || ''); });
  const exp14 = aktif.filter(w => daysLeft(w) <= 14);
  const kar = S.wadah.filter(w => w.status === 'Karantina').length;
  const lokN = S.lokasi.filter(l => l.status === 'Aktif').length;
  $('#rail').innerHTML = `
    <div><div class="caps muted">Lab</div><div class="row between"><span class="b">${esc(S.settings.lab_name || 'Laboratorium')}</span><span class="mono cob t-sm">${lokN} LOK</span></div></div>
    <div class="blk"><div class="caps">Wadah aktif</div><div class="big">${aktif.length} WADAH</div><div class="caps ok-t">${S.bahan.filter(b => b.status === 'Aktif').length} bahan terdaftar</div></div>
    <div class="blk"><div class="caps">Pelarut mudah menyala</div><div class="big">${fl.length} WADAH</div><div class="caps muted">GHS02 · simpan di LMT</div></div>
    <div class="blk" style="cursor:pointer" data-act="go" data-v="stok" data-mode="exp"><div class="caps">FEFO queue alert</div><div class="big ${exp14.length ? 'err-t' : ''}">${exp14.length} ITEM &lt; 14H</div><div class="caps ${exp14.length ? 'err-t' : 'muted'}">${exp14.length ? 'Kedaluwarsa segera' : 'Aman'}</div></div>
    <div class="blk hatch" style="cursor:pointer" data-act="go" data-v="stok" data-mode="kar"><div class="caps">Karantina</div><div class="big" style="color:var(--qr-fg)">${kar} WADAH</div><div class="caps muted">Terkunci dari FEFO</div></div>
    <div class="op"><div class="caps">Operator terminal</div><div class="mono t-sm">${esc(App.user.nama)}</div><div class="caps muted">${esc(App.user.peran)}</div></div>`;
}

/** Hitung peringatan untuk lonceng & dashboard. */
function alerts() {
  const S = App.S, I = App.idx, out = [];
  S.bahan.filter(b => b.status === 'Aktif').forEach(b => {
    const st = I.stat.get(b.bahan_id);
    if (st.low) out.push({ t: 'STOK_RENDAH', m: `${b.nama_standar}: posisi stok ${fmtQ(st.ps, b.satuan_dasar)} ≤ ROP ${fmtQ(st.rop, b.satuan_dasar)}`, go: ['stok', b.bahan_id] });
    if (st.sdsSt === 'Tidak ada' || st.sdsSt === 'Kedaluwarsa') out.push({ t: 'SDS', m: `${b.nama_standar}: SDS ${st.sdsSt.toLowerCase()}`, go: ['sds'] });
  });
  S.wadah.forEach(w => {
    const st = dispStatus(w), d = daysLeft(w);
    if (st === 'Kedaluwarsa') out.push({ t: 'KEDALUWARSA', m: `${w.wadah_id} · ${bahanName(w.bahan_id)} kedaluwarsa ${dTxt(w.tgl_kedaluwarsa_efektif)}`, w: w.wadah_id });
    else if (AKTIF.indexOf(st) >= 0 && d <= 7) out.push({ t: 'EXP_7', m: `${w.wadah_id} · ${bahanName(w.bahan_id)} kedaluwarsa ${d} hari lagi`, w: w.wadah_id });
  });
  S.pengambilan.filter(p => p.status === 'Diajukan' && String(p.penyetuju) === App.user.user_id)
    .forEach(p => out.push({ t: 'PERSETUJUAN', m: `${p.ambil_id} menunggu persetujuan Anda`, go: ['ambil'] }));
  if (S.notif_gagal >= 3) out.push({ t: 'EMAIL', m: 'Pengiriman email notifikasi gagal berulang — periksa Pengaturan.', go: ['pengaturan'] });
  return out;
}
function renderBell() {
  const n = alerts().length;
  const c = $('#bellCnt'); if (!c) return;
  c.textContent = n > 99 ? '99+' : n; c.classList.toggle('hidden', !n);
}

// ════════════════════════════════════════════════════════
// BAGIAN 6: DASHBOARD [W-01]
// ════════════════════════════════════════════════════════

function opnameDue() {
  const S = App.S, dueDays = setN('opname_due_days') || 35, t = today();
  const last = S.opname_last || {};
  return S.lokasi.filter(l => l.status === 'Aktif' && S.wadah.some(w => w.lokasi_id === l.lokasi_id && AKHIR.indexOf(w.status) < 0)).map(l => {
    const d = [last[l.lokasi_id] || '', last['*'] || ''].sort().pop();
    const days = d ? daysBetween(d, t) : null;
    return { l, last: d, days, due: days === null || days > dueDays };
  }).filter(x => x.due).sort((a, b) => (b.days === null ? 1e9 : b.days) - (a.days === null ? 1e9 : a.days));
}

function fefoGlobal() {
  return App.S.wadah.filter(w => usable(w)).sort((a, b) => {
    const ea = String(a.tgl_kedaluwarsa_efektif), eb = String(b.tgl_kedaluwarsa_efektif);
    if (ea !== eb) return ea < eb ? -1 : 1;
    return (a.status === 'Terbuka' ? 0 : 1) - (b.status === 'Terbuka' ? 0 : 1);
  });
}

/** Teks hari yang mudah dibaca: "3 hari lagi" / "hari ini" / "lewat 2 hari". */
function hariTxt(d) { return d < 0 ? 'lewat ' + (-d) + ' hari' : d === 0 ? 'hari ini' : d + ' hari lagi'; }
const JENIS_TXT = { TERIMA: ['menerima', 'bi-box-arrow-in-down', '#16A34A'], AMBIL: ['mengambil', 'bi-eyedropper', '#2563EB'], KOREKSI_SISA: ['mengoreksi isi', 'bi-pencil', '#D97706'],
  OPNAME_ADJ: ['menyesuaikan hasil cek fisik', 'bi-clipboard-check', '#D97706'], REVERSAL: ['membatalkan pengambilan', 'bi-arrow-counterclockwise', '#D97706'], DISPOSAL: ['membuang', 'bi-trash3', '#64748B'],
  RETUR: ['mengembalikan ke pemasok', 'bi-truck', '#64748B'], UBAH_STATUS: ['mengubah status', 'bi-tag', '#7C3AED'], PINDAH_LOKASI: ['memindahkan', 'bi-arrows-move', '#0891B2'], PERPANJANG_EXPIRY: ['memperpanjang kedaluwarsa', 'bi-calendar-plus', '#16A34A'] };

RENDER.dashboard = el => {
  const S = App.S, I = App.idx;
  const bAkt = S.bahan.filter(b => b.status === 'Aktif');
  const low = bAkt.filter(b => I.stat.get(b.bahan_id).low);
  const aktW = S.wadah.filter(w => AKTIF.indexOf(dispStatus(w)) >= 0);
  const exp30 = aktW.filter(w => daysLeft(w) <= 30).sort((a, b) => daysLeft(a) - daysLeft(b));
  const expd = S.wadah.filter(w => dispStatus(w) === 'Kedaluwarsa');
  const kar = S.wadah.filter(w => w.status === 'Karantina');
  const due = opnameDue();
  const kimia = bAkt.filter(b => b.butuh_sds === true || b.butuh_sds === 'true');
  const noSds = kimia.filter(b => I.stat.get(b.bahan_id).sdsSt !== 'Aktif');
  const me = App.user.user_id;
  const myApprove = {}; S.pengambilan.filter(p => p.status === 'Diajukan' && String(p.penyetuju) === me).forEach(p => myApprove[p.grup_id] = 1);
  const nAppr = Object.keys(myApprove).length;

  const h = new Date().getHours();
  const salam = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hello = `<div class="row wrap between mb8"><div><h1 class="h-xl">${salam}, ${esc(String(App.user.nama || '').split(' ')[0])} 👋</h1>
    <p class="muted" style="margin:4px 0 0">${esc(S.settings.lab_name || 'Laboratorium')} · ${esc(tgl)}</p></div>
    <div class="row"><span class="bdg s-ok"><i class="bi bi-boxes"></i> ${aktW.length} botol aktif</span><span class="bdg s-op"><i class="bi bi-flask"></i> ${bAkt.length} jenis bahan</span></div></div>`;

  const stat = (n, label, sub, icon, cls, attrs) => `<button class="stat ${n ? cls : 'c-green zero'}" ${attrs}>
    <span class="si"><i class="bi ${n ? icon : 'bi-check-lg'}"></i></span><span class="sv">${n}</span><span class="sl">${label}</span><span class="ss">${n ? sub : 'Aman, tidak ada'}</span></button>`;
  const stats = `<div class="grid g4 stats">
    ${stat(low.length, 'Stok menipis', 'Perlu dipesan ulang', 'bi-graph-down-arrow', 'c-orange', 'data-act="go" data-v="stok" data-mode="low"')}
    ${stat(exp30.length, 'Segera kedaluwarsa', 'Dalam 30 hari — pakai duluan', 'bi-hourglass-split', 'c-amber', 'data-act="go" data-v="stok" data-mode="exp"')}
    ${stat(expd.length, 'Sudah kedaluwarsa', 'Jangan dipakai, segera tangani', 'bi-x-octagon', 'c-red', 'data-act="go" data-v="stok" data-mode="kar"')}
    ${stat(kar.length, 'Dikarantina', 'Ditahan, tidak bisa diambil', 'bi-lock', 'c-purple', 'data-act="go" data-v="stok" data-mode="kar"')}</div>`;

  const quick = `<h2 class="h-md mt16 mb8">Mau melakukan apa?</h2><div class="grid g3">
    <button class="qa q1" data-act="go" data-v="ambil"><span class="qi"><i class="bi bi-eyedropper"></i></span><span><b>Ambil bahan</b><span>Pakai bahan untuk analisis</span></span></button>
    <button class="qa q2" data-act="go" data-v="terima"><span class="qi"><i class="bi bi-box-arrow-in-down"></i></span><span><b>Terima barang</b><span>Bahan baru datang</span></span></button>
    <button class="qa q4" data-act="go" data-v="stok"><span class="qi"><i class="bi bi-search"></i></span><span><b>Cek stok</b><span>Cari bahan &amp; jumlahnya</span></span></button></div>`;

  // Perlu perhatian — bahasa sehari-hari
  const att = [];
  if (nAppr) att.push(['bi-person-check', 'op', `${nAppr} permintaan ambil menunggu persetujuan Anda`, 'data-act="go" data-v="ambil"']);
  expd.slice(0, 3).forEach(w => att.push(['bi-x-octagon', 'ex', `<b>${esc(bahanName(w.bahan_id))}</b> sudah kedaluwarsa — pisahkan dari rak`, `data-act="wadah" data-id="${esc(w.wadah_id)}"`]));
  low.slice(0, 3).forEach(b => { const s = I.stat.get(b.bahan_id); att.push(['bi-cart-plus', 'sk', `<b>${esc(b.nama_standar)}</b> tinggal ${fmtQ(s.ps, b.satuan_dasar)}${s.q ? ` — sebaiknya pesan ${fmtQ(s.q, b.satuan_dasar)}` : ' — waktunya pesan lagi'}`, 'data-act="go" data-v="stok" data-mode="low"']); });
  if (noSds.length) att.push(['bi-file-earmark-medical', 'ex', `${noSds.length} bahan kimia belum punya lembar keselamatan (SDS) yang berlaku`, 'data-act="go" data-v="sds"']);
  if (due.length) att.push(['bi-clipboard-check', 'sk', `${due.length} lokasi sudah waktunya dicek fisik (opname) — mis. <b>${esc(due[0].l.nama)}</b>`, `data-act="opnameNew" data-lok="${esc(due[0].l.lokasi_id)}"`]);
  const attPanel = `<div class="panel"><div class="panel-h"><span class="ttl"><i class="bi bi-bell"></i> Perlu perhatian</span>${att.length ? `<span class="bdg s-ex">${att.length}</span>` : ''}</div>
    ${att.length ? att.map(x => `<div class="act-item" style="cursor:pointer" ${x[3]} role="button" tabindex="0"><span class="ai s-${x[1]}"><i class="bi ${x[0]}"></i></span><div class="grow">${x[2]}</div><i class="bi bi-chevron-right muted"></i></div>`).join('')
      : `<div class="empty"><i class="bi bi-emoji-smile" style="color:var(--ok-fg)"></i>Semua aman. Tidak ada yang perlu ditangani.</div>`}</div>`;

  // Pakai duluan (FEFO)
  const fl = fefoGlobal().slice(0, 5);
  const fefoPanel = `<div class="panel mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-sort-down-alt"></i> Pakai duluan</span><span class="t-sm muted">Botol yang paling cepat kedaluwarsa</span></div>
    ${fl.map(w => { const b = I.bahan.get(w.bahan_id) || {}; const d = daysLeft(w);
      return `<div class="act-item"><span class="ai ${d <= 30 ? 's-sk' : 's-ok'}"><i class="bi bi-droplet-half"></i></span>
        <div class="grow" style="cursor:pointer" data-act="wadah" data-id="${esc(w.wadah_id)}"><b>${esc(b.nama_standar)}</b> ${w.status === 'Terbuka' ? '<span class="bdg s-op">Sudah dibuka</span>' : ''}
          <div class="t-sm muted">Sisa ${fmtQ(w.qty_sisa_dasar, b.satuan_dasar)} · ${esc(lokName(w.lokasi_id))} · <span class="${d <= 30 ? 'err-t b' : ''}">kedaluwarsa ${hariTxt(d)}</span></div></div>
        <button class="btn btn-sm btn-p" data-act="ambilWadah" data-id="${esc(w.wadah_id)}">Ambil</button></div>`; }).join('') || empty('Belum ada botol aktif.', 'bi-inbox')}
    <div class="panel-f"><span class="t-sm muted">Aturan lab: habiskan botol yang sudah dibuka &amp; paling dekat kedaluwarsa</span><a href="javascript:void(0)" data-act="go" data-v="stok" data-mode="exp">Lihat semua →</a></div></div>`;

  // Aktivitas terakhir
  const mut = S.mutasi.slice().sort((x, y) => String(y.waktu) < String(x.waktu) ? -1 : String(y.waktu) > String(x.waktu) ? 1 : 0).slice(0, 6);
  const actPanel = `<div class="panel"><div class="panel-h"><span class="ttl"><i class="bi bi-clock-history"></i> Aktivitas terakhir</span></div>
    ${mut.map(m => { const b = I.bahan.get(m.bahan_id) || {}; const d = num(m.qty_delta_dasar); const j = JENIS_TXT[m.jenis] || [String(m.jenis).toLowerCase(), 'bi-dot', '#64748B'];
      return `<div class="act-item ${m._opt ? 'hatch' : ''}"><span class="ai" style="background:${j[2]}1f;color:${j[2]}"><i class="bi ${j[1]}"></i></span><div class="grow">
        <div><b>${esc(String(userName(m.pengguna)).split(' ')[0])}</b> ${j[0]} ${d ? `<b>${fmtQ(Math.abs(d), b.satuan_dasar)}</b> ` : ''}${esc(b.nama_standar || '')}</div>
        <div class="t-sm muted">${m._opt ? 'Sedang dikirim…' : esc(String(m.waktu).substr(0, 16).replace('T', ' '))}</div></div></div>`; }).join('') || empty('Belum ada aktivitas.')}
    <div class="panel-f"><span></span><a href="javascript:void(0)" data-act="go" data-v="audit">Riwayat lengkap →</a></div></div>`;

  el.innerHTML = `${hello}${stats}${quick}<div class="grid g-main mt16"><div>${attPanel}${fefoPanel}</div><div>${actPanel}</div></div>`;
};

/** Halaman "Lainnya": ubin besar berwarna untuk fitur sekunder. */
RENDER.lainnya = el => {
  const admin = App.user.peran === 'Admin';
  const S = App.S;
  const info = {
    opname: S.opname.filter(o => o.status === 'Berjalan').length ? S.opname.filter(o => o.status === 'Berjalan').length + ' sesi sedang berjalan' : opnameDue().length + ' lokasi perlu dicek',
    sds: S.bahan.filter(b => b.status === 'Aktif' && (b.butuh_sds === true || b.butuh_sds === 'true') && App.idx.stat.get(b.bahan_id).sdsSt !== 'Aktif').length + ' bahan perlu SDS',
    master: S.bahan.length + ' bahan · ' + S.lokasi.length + ' lokasi · ' + S.supplier.length + ' pemasok',
    audit: 'Unduh laporan ke Excel (CSV)', po: S.po_header.filter(p => p.status === 'Terbuka' || p.status === 'Sebagian').length + ' PO/reservasi masih berjalan', pengaturan: S.users.length + ' pengguna terdaftar'
  };
  el.innerHTML = `<div class="grid g3">${VIEWS.filter(v => (v.parent === 'lainnya' || v.mparent === 'lainnya') && (!v.admin || admin)).map(v =>
    `<button class="tile" data-act="go" data-v="${v.id}"><span class="ti" style="background:${v.color}"><i class="bi ${v.icon}"></i></span><h3>${esc(v.label)}</h3><span class="muted">${esc(v.sub)}</span><span class="t-sm b" style="color:${v.color}">${esc(info[v.id] || '')}</span></button>`).join('')}</div>`;
};

function drawTrend(key, canvas, b, st) {
  if (!canvas) return;
  if (!window.Chart) { canvas.parentNode.innerHTML = empty('Pustaka grafik tidak termuat (periksa koneksi ke cdnjs). Angka di atas tetap akurat.', 'bi-graph-up'); return; }
  const info = st.info, n = (info.series || []).length;
  const labels = Array.from({ length: n }, (_, i) => i === n - 1 ? `W-${String(i + 1).padStart(2, '0')} [NOW]` : `W-${String(i + 1).padStart(2, '0')}`);
  const cs = getComputedStyle(document.documentElement);
  const c = v => cs.getPropertyValue(v).trim();
  const ds = [
    { label: `${b.nama_standar} (stok efektif)`, data: info.stock || [], borderColor: c('--cobalt'), backgroundColor: c('--cobalt'), borderWidth: 2.5, pointRadius: 3, tension: 0 },
    { label: 'Pemakaian mingguan', data: info.series, borderColor: c('--muted'), borderDash: [4, 3], borderWidth: 1.5, pointRadius: 2, tension: 0 }
  ];
  if (st.rop) ds.push({ label: 'ROP', data: Array(n).fill(st.rop), borderColor: c('--err'), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 });
  if (st.ss) ds.push({ label: 'Safety stock', data: Array(n).fill(st.ss), borderColor: c('--sk-fg'), borderDash: [2, 3], borderWidth: 1.5, pointRadius: 0 });
  App.charts[key] = new Chart(canvas, {
    type: 'line', data: { labels, datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { color: c('--text'), font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 18, boxHeight: 2 } },
        tooltip: { callbacks: { label: x => `${x.dataset.label}: ${fmtQ(x.parsed.y, b.satuan_dasar)}` } } },
      scales: {
        x: { grid: { color: c('--rule') }, ticks: { color: c('--muted'), font: { family: 'JetBrains Mono', size: 10 } } },
        y: { beginAtZero: true, grid: { color: c('--rule') }, ticks: { color: c('--muted'), font: { family: 'JetBrains Mono', size: 10 }, callback: v => fmtN(v, 0) } }
      }
    }
  });
}

ACT.dashFefo = el => { App.ui.dash.fefoFilter = el.dataset.f; render('dashboard'); };
CH.dashTrend = el => { App.ui.dash.trendBahan = el.value; render('dashboard'); };

// ════════════════════════════════════════════════════════
// BAGIAN 7: PENERIMAAN [W-02/W-03] — wizard 5 langkah, draf lokal
// ════════════════════════════════════════════════════════

function rcvNew() {
  return { step: 1, mode: 'PO', po_no: '', po_item_id: '', supplier_id: '', tanpa_po_alasan: '', bahan_id: '', qty: '', satuan: '',
    no_surat_jalan: '', tanggal_terima: today(), alasan_selisih: '', catatan: '', konfirmasi_lebih: false, nomor_batch: '', tgl_produksi: '',
    tgl_kedaluwarsa: '', tanpa_kedaluwarsa: false, jumlah_wadah: 1, lokasi_id: '', wadah: [{ qty: '', kondisi: 'Baik' }], request_id: uid(), result: null, t: Date.now() };
}
App.fotos = {}; // foto terkompresi (memori, tidak ke localStorage)
const saveRcvDraft = debounce(() => { const r = Object.assign({}, App.rcv); if (!r.result) ls('ci_rcv_draft', r); }, 400);

/** Hitung & validasi seluruh data penerimaan (dipakai tampilan & tombol simpan). */
function rcvCalc() {
  const r = App.rcv, I = App.idx, t = today();
  const c = { errs: [], warn: [] };
  const E = (step, msg) => c.errs.push({ step, msg });
  c.item = r.po_item_id ? I.poItem.get(r.po_item_id) : null;
  c.po = c.item ? I.po.get(c.item.po_no) : (r.po_no ? I.po.get(r.po_no) : null);
  c.salah = r.alasan_selisih === 'Salah barang';
  c.bahan = I.bahan.get(r.bahan_id) || (c.item && !c.salah ? I.bahan.get(c.item.bahan_id) : null);
  c.supplier_id = r.mode === 'PO' ? (c.po ? c.po.supplier_id : '') : r.supplier_id;
  c.sup = I.supplier.get(c.supplier_id);
  if (r.mode === 'PO') { if (!c.item) E(1, 'Pilih nomor PO dan item yang diterima.'); }
  else { if (!r.tanpa_po_alasan) E(1, 'Alasan penerimaan tanpa PO wajib.'); if (!c.sup) E(1, 'Supplier wajib dipilih.'); }
  if (!isDate(r.tanggal_terima) || r.tanggal_terima > t) E(1, 'Tanggal terima tidak boleh di masa depan.');
  if (!c.bahan) E(2, 'Bahan belum dipilih.');
  if (c.bahan) {
    const unit = r.satuan || c.bahan.satuan_dasar;
    const cv = toBase(c.bahan, r.qty, unit); c.conv = cv;
    if (cv.err) E(2, cv.err); else c.base = cv.v;
    if (c.item && !c.salah && c.base) {
      c.sisaPO = r4(num(c.item.qty_pesan_dasar) - num(c.item.qty_diterima_dasar));
      c.selisih = r4(c.base - c.sisaPO);
      c.pct = c.selisih / num(c.item.qty_pesan_dasar) * 100;
      if (Math.abs(c.selisih) > TOL && !r.alasan_selisih) E(2, 'Jumlah berbeda dari sisa PO — alasan selisih wajib.');
      c.overTol = c.selisih > 0 && c.pct > (setN('overdelivery_tolerance_pct') || 5);
      if (c.overTol && !r.konfirmasi_lebih) E(2, `Lebih kirim ${fmtN(c.pct, 1)}% melebihi toleransi — centang konfirmasi.`);
    }
  }
  if (!String(r.nomor_batch).trim()) E(3, 'Nomor batch wajib diisi.');
  if (!r.tanpa_kedaluwarsa && !isDate(r.tgl_kedaluwarsa)) E(3, 'Tanggal kedaluwarsa wajib (atau pilih "Tidak ada kedaluwarsa").');
  const lok = I.lokasi.get(r.lokasi_id); if (!lok || lok.status !== 'Aktif') E(3, 'Lokasi rak target wajib dipilih.');
  c.exp = r.tanpa_kedaluwarsa ? '9999-12-31' : r.tgl_kedaluwarsa;
  // Batch yang sudah ada (K-16)
  if (c.bahan && r.nomor_batch) c.batchAda = App.S.batch.find(b => b.bahan_id === c.bahan.bahan_id && b.supplier_id === c.supplier_id && String(b.nomor_batch).toUpperCase() === String(r.nomor_batch).trim().toUpperCase());
  // Wadah
  let tot = 0;
  r.wadah.forEach((w, i) => {
    const q = num(w.qty); tot += q;
    if (!(q > 0)) E(3, `Isi awal wadah #${i + 1} harus > 0.`);
    if (w.kondisi !== 'Baik' && !App.fotos[i]) E(4, `Foto wajib untuk wadah #${i + 1} (${w.kondisi}).`);
  });
  c.totWadah = r4(tot);
  if (c.base && Math.abs(tot - c.base) > Math.max(0.01, c.base * 1e-5)) E(3, `Total isi wadah (${fmtN(tot)}) ≠ jumlah diterima (${fmtN(c.base)} ${c.bahan.satuan_dasar}).`);
  // Prediksi status per wadah
  c.sds = c.bahan ? activeSds(c.bahan.bahan_id, c.supplier_id) : null;
  c.needSds = c.bahan && (c.bahan.butuh_sds === true || c.bahan.butuh_sds === 'true');
  const expBatch = c.batchAda ? c.batchAda.tgl_kedaluwarsa : c.exp;
  c.pred = r.wadah.map(w => {
    const rs = [];
    if (w.kondisi !== 'Baik') rs.push('Kondisi: ' + w.kondisi);
    if (c.needSds && !c.sds) rs.push('SDS menunggu');
    if (expBatch && expBatch < t) rs.push('Kedaluwarsa saat diterima');
    if (c.salah) rs.push('Salah barang');
    return { st: rs.length ? 'Karantina' : 'Tersedia', rs };
  });
  if (c.needSds && !c.sds) c.warn.push('SDS aktif belum ada — semua wadah akan berstatus Karantina sampai SDS diunggah & diverifikasi (D-3).');
  if (expBatch && expBatch < t) c.warn.push('Tanggal kedaluwarsa sudah lewat — wadah otomatis Karantina, disarankan Retur (K-07).');
  return c;
}

RENDER.terima = el => {
  if (!App.rcv) App.rcv = ls('ci_rcv_draft') || rcvNew();
  const r = App.rcv, c = rcvCalc(), I = App.idx;
  if (r.result) return renderRcvResult(el);
  const steps = ['Dari mana?', 'Bahan & jumlah', 'Botol & lokasi', 'Cek kondisi', 'Periksa & simpan'];
  const errStep = s => c.errs.some(e => e.step === s);
  const stepper = `<div class="stepper" role="tablist">${steps.map((s, i) => { const n = i + 1;
    return `<button class="step ${r.step === n ? 'on' : (n < r.step && !errStep(n) ? 'done' : '')}" data-act="rcvStep" data-s="${n}" aria-current="${r.step === n}"><span class="sn">${n < r.step && !errStep(n) ? '<i class="bi bi-check-lg"></i>' : n}</span><span class="sd">${s}</span></button>`; }).join('')}</div>`;
  const head = `<div class="row wrap between"><span class="t-sm muted"><i class="bi bi-cloud-check"></i> Isian tersimpan otomatis di perangkat ini (${new Date(r.t || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})</span></div>`;
  let body = '';
  if (r.step === 1) body = rcvStep1(c);
  if (r.step === 2) body = rcvStep2(c);
  if (r.step === 3) body = rcvStep3(c);
  if (r.step === 4) body = rcvStep4(c);
  if (r.step === 5) body = rcvStep5(c);
  const nav = `<div class="row between mt12"><button class="btn btn-lg" data-act="rcvStep" data-s="${Math.max(1, r.step - 1)}" ${r.step === 1 ? 'disabled' : ''}><i class="bi bi-arrow-left"></i> Kembali</button>
    ${r.step < 5 ? `<button class="btn btn-p btn-lg" data-act="rcvStep" data-s="${r.step + 1}">Lanjut <i class="bi bi-arrow-right"></i></button>` : ''}</div>`;
  const commit = r.step < 5 ? '' : `<div class="commit"><div class="cs"><span class="sq" style="background:${c.errs.length ? 'var(--err)' : 'var(--ok-fg)'}"></span><span>${c.errs.length ? c.errs.length + ' isian masih perlu dilengkapi' : 'Semua isian sudah lengkap'}</span></div>
    <span class="t-sm muted">Total: <b>${c.base ? fmtQ(c.base, c.bahan.satuan_dasar) : '—'}</b> dalam ${r.wadah.length} botol</span>
    <div class="act"><button class="btn btn-g" data-act="rcvReset">Batal</button>
    <button class="btn btn-p btn-lg" data-act="rcvSave" id="btnRcvSave" ${c.errs.length ? 'aria-disabled="true"' : ''}><i class="bi bi-check2-circle"></i> Simpan penerimaan</button></div></div>`;
  el.innerHTML = `${head}<div class="mt12">${stepper}</div><div class="grid g-main mt12"><div>${body}${nav}</div><div>${rcvLabelPanel(c)}</div></div>${commit}`;
};

function rcvStep1(c) {
  const r = App.rcv, S = App.S, I = App.idx;
  const pos = S.po_header.filter(p => p.status === 'Terbuka' || p.status === 'Sebagian').sort((a, b) => a.tanggal_po < b.tanggal_po ? 1 : -1);
  const items = r.po_no ? S.po_item.filter(i => i.po_no === r.po_no) : [];
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-file-earmark-text"></i> Barang ini dari mana?</span><span class="idx">REF: US-01 / US-24</span></div><div class="panel-b">
    <div class="grid g2"><div class="optbox ${r.mode === 'PO' ? 'on' : ''}" data-act="rcvMode" data-m="PO" role="radio" aria-checked="${r.mode === 'PO'}" tabindex="0"><i class="bi bi-receipt"></i><div><b>Dengan PO / Reservasi</b><div class="t-sm muted">Cocokkan dengan pesanan atau reservasi gudang</div></div></div>
    <div class="optbox ${r.mode === 'TANPA' ? 'on' : ''}" data-act="rcvMode" data-m="TANPA" role="radio" aria-checked="${r.mode === 'TANPA'}" tabindex="0"><i class="bi bi-inbox"></i><div><b>Tanpa PO</b><div class="t-sm muted">Sampel, pembelian darurat, hibah</div></div></div></div>
    ${r.mode === 'PO' ? `<div class="fgrid c3 mt12"><div class="field"><label>Nomor PO / reservasi <span class="req">*</span></label><select class="sel mono" name="po_no" data-ch="rcvField">${opts(pos.map(p => ({ v: p.po_no, t: (p.jenis === 'Reservasi' ? 'Reservasi ' : 'PO ') + p.po_no + ' · ' + (I.supplier.get(p.supplier_id) || {}).nama })), r.po_no, 'Pilih PO atau reservasi…')}</select></div>
      <div class="field"><label>Pemasok</label><div class="well-v">${esc(c.po ? (I.supplier.get(c.po.supplier_id) || {}).nama : '—')}</div></div>
      <div class="field"><label>Tanggal</label><div class="well-v">${esc(c.po ? dTxt(c.po.tanggal_po) : '—')}</div></div></div>
      ${r.po_no ? `<div class="tbl-wrap soft mt12"><table class="tbl"><thead><tr><th></th><th>Item</th><th class="num">Dipesan</th><th class="num">Diterima</th><th class="num">Sisa</th><th>Status</th></tr></thead><tbody>
        ${items.map(it => { const b = I.bahan.get(it.bahan_id) || {}; const dis = it.status_item === 'Selesai' || it.status_item === 'Batal';
          return `<tr class="${r.po_item_id === it.po_item_id ? 'sel' : ''}"><td><label class="chk"><input type="radio" name="poi" ${r.po_item_id === it.po_item_id ? 'checked' : ''} ${dis ? 'disabled' : ''} data-ch="rcvPoItem" value="${esc(it.po_item_id)}"><span class="sr">Pilih</span></label></td>
            <td><b>${esc(b.nama_standar)}</b><span class="sub">${esc(it.po_item_id)} · CAS ${esc(b.cas_number || '—')}</span></td><td class="num">${fmtN(it.qty_pesan)} ${esc(it.satuan_pesan)}<span class="sub">${fmtQ(it.qty_pesan_dasar, b.satuan_dasar)}</span></td>
            <td class="num">${fmtQ(it.qty_diterima_dasar, b.satuan_dasar)}</td><td class="num b">${fmtQ(Math.max(0, num(it.qty_pesan_dasar) - num(it.qty_diterima_dasar)), b.satuan_dasar)}</td><td>${bdg(it.status_item, it.status_item === 'Terbuka' ? 'Terbuka_PO' : it.status_item)}</td></tr>`; }).join('')}</tbody></table></div>` : `<p class="help mt8">${pos.length ? 'Pilih PO untuk melihat item.' : 'Belum ada PO terbuka. Buat di Master Data → Purchase Order, atau gunakan "Tanpa PO".'}</p>`}`
    : `<div class="fgrid c3 mt12"><div class="field"><label>Alasan tanpa PO <span class="req">*</span></label><select class="sel" name="tanpa_po_alasan" data-ch="rcvField">${opts(EN.tanpa_po, r.tanpa_po_alasan, 'Pilih…')}</select></div>
      <div class="field"><label>Supplier <span class="req">*</span></label><select class="sel" name="supplier_id" data-ch="rcvField">${opts(S.supplier.filter(s => s.status === 'Aktif').map(s => ({ v: s.supplier_id, t: s.nama })), r.supplier_id, 'Pilih supplier…')}</select></div>
      <div class="field"><label>Bahan <span class="req">*</span></label><select class="sel" name="bahan_id" data-ch="rcvField">${opts(S.bahan.filter(b => b.status === 'Aktif').map(b => ({ v: b.bahan_id, t: b.nama_standar + (b.cas_number ? ' · ' + b.cas_number : '') })), r.bahan_id, 'Pilih bahan…')}</select></div></div>`}
    <div class="fgrid c3 mt12"><div class="field"><label>No. surat jalan</label><input class="inp mono" name="no_surat_jalan" value="${esc(r.no_surat_jalan)}" data-in="rcvField"></div>
      <div class="field"><label>Tanggal terima <span class="req">*</span></label><input class="inp mono" type="date" name="tanggal_terima" max="${today()}" value="${esc(r.tanggal_terima)}" data-ch="rcvField"><span class="help">Boleh mundur, tidak boleh masa depan</span></div>
      <div class="field"><label>Penerima</label><div class="well-v">${esc(App.user.nama)} (otomatis)</div></div></div>
  </div></div>`;
}

function rcvStep2(c) {
  const r = App.rcv, b = c.bahan, I = App.idx;
  if (!b) return `<div class="note warn"><i class="bi bi-exclamation-triangle"></i><div>Pilih sumber dan bahan di langkah 1.</div></div>`;
  const unit = r.satuan || b.satuan_dasar;
  const units = unitsFor(b);
  const it = c.item;
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-flask"></i> Bahan &amp; jumlah yang datang</span><span class="idx">REF: US-02 / US-04</span></div><div class="panel-b">
    <div class="row between wrap"><div><div class="h-md">${esc(b.nama_standar)}</div><div class="t-sm mono muted">CAS: ${esc(b.cas_number || '—')} • INDEX: ${esc(b.bahan_id)} • <span class="cob">GRADE: ${esc(b.grade || '—')}</span></div></div>
      ${it ? `<span class="bdg ${it.bahan_id === b.bahan_id ? 's-ok' : 's-ex'}">${it.bahan_id === b.bahan_id ? '✓ PO sesuai spek' : '✗ beda dengan PO'}</span>` : bdg('Tanpa PO', 'Segera')}</div>
    ${it ? `<div class="grid g4 flush mt12" style="border:1px solid var(--rule)">
      <div class="p8" style="text-align:center"><div class="lbl">Jumlah dipesan</div><div class="h-md mono">${fmtQ(it.qty_pesan_dasar, b.satuan_dasar)}</div><div class="t-sm muted">(${fmtN(it.qty_pesan)} ${esc(it.satuan_pesan)})</div></div>
      <div class="p8" style="text-align:center;border-left:1px solid var(--rule)"><div class="lbl">Diterima sebelumnya</div><div class="h-md mono">${fmtQ(it.qty_diterima_dasar, b.satuan_dasar)}</div></div>
      <div class="p8" style="text-align:center;border-left:1px solid var(--rule)"><div class="lbl">Sisa pesanan</div><div class="h-md mono cob">${fmtQ(c.sisaPO !== undefined ? c.sisaPO : num(it.qty_pesan_dasar) - num(it.qty_diterima_dasar), b.satuan_dasar)}</div></div>
      <div class="p8" style="text-align:center;border-left:1px solid var(--rule)"><div class="lbl ok-t">Batas lebih kirim</div><div class="h-md mono ok-t">± ${fmtN(setN('overdelivery_tolerance_pct'))} %</div><div class="t-sm muted">Maks: ${fmtQ(num(it.qty_pesan_dasar) * (1 + setN('overdelivery_tolerance_pct') / 100), b.satuan_dasar)}</div></div></div>` : ''}
    <div class="panel mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-calculator"></i> Jumlah yang diterima</span><span class="idx">${num(b.densitas_g_per_mL) ? 'DENSITAS: ' + b.densitas_g_per_mL + ' g/mL' : 'SATUAN DASAR: ' + esc(b.satuan_dasar)}</span></div><div class="panel-b">
      <div class="fgrid c3"><div class="field"><label>Jumlah <span class="req">*</span></label><div class="ingrp"><input class="inp mono" name="qty" inputmode="decimal" value="${esc(r.qty)}" data-in="rcvField" placeholder="0"><select class="sel suf2" name="satuan" data-ch="rcvField" aria-label="Satuan">${opts(units, unit)}</select></div></div>
        <div class="field"><label class="cob">Hasil konversi (${esc(b.satuan_dasar)})</label><div id="rcvConv">${rcvConvHtml(c)}</div></div>
        <div class="field"><label>Selisih dari pesanan</label><div id="rcvDev">${rcvDevHtml(c)}</div></div></div>
      <div class="fgrid c2 mt12"><div class="field"><label>Alasan selisih ${c.selisih && Math.abs(c.selisih) > TOL ? '<span class="req">*</span>' : ''}</label><select class="sel" name="alasan_selisih" data-ch="rcvField">${opts(EN.alasan_selisih, r.alasan_selisih, it ? '— tidak ada selisih —' : '— (khusus PO) —')}</select>
        ${c.salah ? `<span class="help err-t">Salah barang: pilih bahan sesuai fisik. Wadah Karantina, tidak mengurangi sisa PO, lalu diproses Retur (K-04).</span>` : ''}</div>
        ${c.salah ? `<div class="field"><label>Bahan sesuai fisik</label><select class="sel" name="bahan_id" data-ch="rcvField">${opts(App.S.bahan.filter(x => x.status === 'Aktif').map(x => ({ v: x.bahan_id, t: x.nama_standar })), r.bahan_id, 'Pilih…')}</select></div>` : `<div class="field"><label>Catatan</label><input class="inp" name="catatan" value="${esc(r.catatan)}" data-in="rcvField"></div>`}</div>
      <div id="rcvOver">${c.overTol ? `<label class="chk mt8 err-t"><input type="checkbox" name="konfirmasi_lebih" ${r.konfirmasi_lebih ? 'checked' : ''} data-ch="rcvField"> Saya konfirmasi lebih kirim ${fmtN(c.pct, 1)}% (di atas toleransi)</label>` : ''}</div>
    </div></div></div></div>`;
}
function rcvConvHtml(c) {
  if (!c.bahan) return '<div class="well-v">—</div>';
  if (c.conv && c.conv.err) return `<div class="well-v" style="color:var(--err)">${esc(c.conv.err)}</div><a class="t-sm" href="javascript:void(0)" data-act="bahanForm" data-id="${esc(c.bahan.bahan_id)}">Lengkapi master bahan →</a>`;
  return `<div class="well-v okv b">${c.base ? fmtQ(c.base, c.bahan.satuan_dasar) : '—'}${c.base && c.bahan.satuan_dasar === 'mL' ? ` <span class="t-sm" style="margin-left:6px">(${fmtN(c.base / 1000, 3)} L)</span>` : ''}</div>`;
}
function rcvDevHtml(c) {
  if (!c.item || c.salah) return '<div class="well-v">—</div>';
  if (c.selisih === undefined) return '<div class="well-v">—</div>';
  const cls = Math.abs(c.selisih) <= TOL ? 'okv' : c.overTol ? '' : '';
  return `<div class="well-v ${cls}" style="${c.overTol || c.selisih < -TOL ? 'color:var(--err)' : ''}">${c.selisih > 0 ? '+' : ''}${fmtQ(c.selisih, c.bahan.satuan_dasar)} (${c.selisih > 0 ? '+' : ''}${fmtN(c.pct, 2)}%)</div>`;
}

function rcvStep3(c) {
  const r = App.rcv, S = App.S;
  if (!c.bahan) return `<div class="note warn"><i class="bi bi-exclamation-triangle"></i><div>Lengkapi langkah 1–2.</div></div>`;
  const u = c.bahan.satuan_dasar;
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-grid-3x3"></i> Botol, batch &amp; tempat simpan</span><span class="idx">US-01 // SERIALISASI FISIK</span></div><div class="panel-b">
    <div class="fgrid c4"><div class="field"><label>No. batch fisik (uppercase) <span class="req">*</span></label><input class="inp mono b" name="nomor_batch" value="${esc(r.nomor_batch)}" data-in="rcvField" style="text-transform:uppercase" autocomplete="off"></div>
      <div class="field"><label>Tgl kedaluwarsa vendor <span class="req">*</span></label><input class="inp mono" type="date" name="tgl_kedaluwarsa" value="${esc(r.tgl_kedaluwarsa)}" data-ch="rcvField" ${r.tanpa_kedaluwarsa ? 'disabled' : ''}>
        <label class="chk t-sm"><input type="checkbox" name="tanpa_kedaluwarsa" ${r.tanpa_kedaluwarsa ? 'checked' : ''} data-ch="rcvField"> Tidak ada kedaluwarsa</label></div>
      <div class="field"><label>Jumlah kemasan / botol <span class="req">*</span></label><input class="inp mono" type="number" min="1" max="200" name="jumlah_wadah" value="${r.wadah.length}" data-ch="rcvJml"></div>
      <div class="field"><label>Lokasi rak target <span class="req">*</span></label><select class="sel" name="lokasi_id" data-ch="rcvField">${opts(S.lokasi.filter(l => l.status === 'Aktif').map(l => ({ v: l.lokasi_id, t: l.nama })), r.lokasi_id, 'Pilih lokasi…')}</select></div></div>
    <div class="fgrid c4 mt8"><div class="field"><label>Tgl produksi</label><input class="inp mono" type="date" name="tgl_produksi" max="${today()}" value="${esc(r.tgl_produksi)}" data-ch="rcvField"></div></div>
    <div id="rcvBatchNote">${rcvBatchNote(c)}</div>
    <div class="row between mt12"><span class="lbl">Pratinjau serialisasi wadah (${r.wadah.length} unit)</span><button class="btn btn-sm" data-act="rcvSplit"><i class="bi bi-distribute-horizontal"></i> Bagi rata ${c.base ? fmtQ(c.base, u) : ''}</button></div>
    <div class="tbl-wrap mt8"><table class="tbl"><thead><tr><th>No</th><th>ID wadah</th><th class="num">Isi awal (${esc(u)})</th><th>Prediksi status</th></tr></thead><tbody>
      ${r.wadah.map((w, i) => `<tr><td class="mono">${String(i + 1).padStart(2, '0')}</td><td class="id muted">WDH-${today().substr(0, 4)}-•••••</td>
        <td class="num"><input class="inp mono" style="width:130px;text-align:right" inputmode="decimal" value="${esc(w.qty)}" data-in="rcvW" data-i="${i}" aria-label="Isi awal wadah ${i + 1}"></td><td>${bdg(c.pred[i].st)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="2">Total</td><td class="num" id="rcvTot">${fmtQ(c.totWadah, u)}</td><td class="t-sm">${c.base ? (Math.abs(c.totWadah - c.base) <= 0.01 ? '<span class="ok-t">✓ sama dengan jumlah diterima</span>' : '<span class="err-t">≠ ' + fmtQ(c.base, u) + '</span>') : ''}</td></tr></tfoot></table></div>
  </div></div>`;
}
function rcvBatchNote(c) {
  if (!c.batchAda) return '';
  const beda = !App.rcv.tanpa_kedaluwarsa && App.rcv.tgl_kedaluwarsa && App.rcv.tgl_kedaluwarsa !== c.batchAda.tgl_kedaluwarsa;
  return `<div class="note ${beda ? 'err' : 'warn'} mt12"><i class="bi bi-layers"></i><div>Batch <b class="mono">${esc(c.batchAda.nomor_batch)}</b> (${esc(c.batchAda.batch_id)}) sudah ada untuk bahan &amp; supplier ini. Wadah baru akan ditambahkan ke batch tersebut (K-16).${beda ? ` <b>Peringatan: kedaluwarsa berbeda (${dTxt(c.batchAda.tgl_kedaluwarsa)}). Konfirmasi diminta saat simpan.</b>` : ''}</div></div>`;
}

function rcvStep4(c) {
  const r = App.rcv;
  if (!c.bahan) return `<div class="note warn"><i class="bi bi-exclamation-triangle"></i><div>Lengkapi langkah sebelumnya.</div></div>`;
  const u = c.bahan.satuan_dasar;
  const sdsBox = !c.needSds ? `<div class="note"><i class="bi bi-info-square"></i><div>Consumable / bahan tanpa kewajiban SDS.</div></div>` :
    c.sds ? `<div class="note ok"><i class="bi bi-shield-check"></i><div><b>${esc(c.sds.sds_id)}</b> · ${esc(c.sds.revisi || '')} — Aktif s.d. <b class="mono">${dTxt(c.sds.tanggal_kedaluwarsa)}</b> ${c.sds.link ? `<a href="javascript:void(0)" data-act="sdsView" data-id="${esc(c.sds.sds_id)}">Tinjau SDS</a>` : ''}</div></div>` :
      `<div class="note q"><i class="bi bi-sign-stop"></i><div><b>SDS aktif belum ada.</b> Penerimaan tetap dapat disimpan, tetapi semua wadah berstatus <b>Karantina</b> dan tidak dapat diambil sampai SDS diunggah (D-3).<div class="mt8"><button class="btn btn-sm" data-act="sdsUpload" data-b="${esc(c.bahan.bahan_id)}" data-s="${esc(c.supplier_id || '')}"><i class="bi bi-upload"></i> Unggah SDS sekarang</button></div></div></div>`;
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-eye"></i> Cek kondisi kemasan</span><span class="idx">US-03 // FOTO WAJIB BILA TIDAK BAIK</span></div><div class="panel-b">
    <div class="row wrap"><span class="lbl">Terapkan ke semua:</span><select class="sel" style="width:auto" data-ch="rcvAllKondisi" aria-label="Kondisi semua wadah">${opts(EN.kondisi, '')}</select></div>
    <div class="tbl-wrap mt8"><table class="tbl"><thead><tr><th>No</th><th class="num">Vol awal (${esc(u)})</th><th>Cek kondisi kemasan</th><th>Bukti dokumentasi</th><th>Status penyimpanan</th></tr></thead><tbody>
    ${r.wadah.map((w, i) => { const f = App.fotos[i]; const p = c.pred[i];
      return `<tr class="${p.st === 'Karantina' && w.kondisi !== 'Baik' ? 'warn' : ''}"><td class="mono">${String(i + 1).padStart(2, '0')}</td><td class="num">${fmtN(w.qty)}</td>
        <td><select class="sel ${w.kondisi !== 'Baik' ? 'bad' : ''}" style="min-width:150px" data-ch="rcvKond" data-i="${i}" aria-label="Kondisi wadah ${i + 1}">${opts(EN.kondisi, w.kondisi)}</select></td>
        <td>${f ? `<span class="row"><img src="${f.thumb}" alt="foto" style="width:36px;height:36px;object-fit:cover;border:1px solid var(--rule)"><span class="mono t-sm">${esc(f.name)} <span class="bdg s-ex">${fmtN(f.size / 1024, 0)}KB</span></span><button class="btn btn-sm btn-g" data-act="rcvFotoDel" data-i="${i}">Hapus</button></span>` :
          (w.kondisi !== 'Baik' ? `<label class="btn btn-sm btn-d"><i class="bi bi-camera"></i> Ambil/unggah foto<input type="file" accept="image/*" capture="environment" class="sr" data-ch="rcvFoto" data-i="${i}"></label>` : '<span class="muted">—</span>')}</td>
        <td>${bdg(p.st)}${p.rs.length ? `<span class="sub">${esc(p.rs.join('; '))}</span>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>
    ${c.pred.some(p => p.st === 'Karantina') ? `<div class="note q mt8"><i class="bi bi-bell"></i><div>${c.pred.filter(p => p.st === 'Karantina').length} dari ${r.wadah.length} wadah dialihkan ke isolasi Karantina.</div></div>` : ''}
  </div></div>
  <div class="panel frame mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-shield-check"></i> Lembar keselamatan (SDS)</span><span class="idx">D-3 / AC-14.2</span></div><div class="panel-b">${sdsBox}${c.warn.filter(w => !/SDS/.test(w)).map(w => `<div class="note warn mt8"><i class="bi bi-exclamation-triangle"></i><div>${esc(w)}</div></div>`).join('')}</div></div>`;
}

function rcvStep5(c) {
  const r = App.rcv, I = App.idx;
  const b = c.bahan, u = b ? b.satuan_dasar : '';
  const kv = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-list-check"></i> Periksa sebelum simpan</span><span class="idx">PRA-KOMIT</span></div><div class="panel-b">
    ${c.errs.length ? `<div class="note err"><i class="bi bi-x-octagon"></i><div><b>${c.errs.length} isian belum valid:</b><ul style="margin:4px 0 0;padding-left:18px">${c.errs.map(e => `<li><a href="javascript:void(0)" data-act="rcvStep" data-s="${e.step}">Langkah ${e.step}</a>: ${esc(e.msg)}</li>`).join('')}</ul></div></div>` : `<div class="note ok"><i class="bi bi-check2-square"></i><div>Semua isian valid. Siap disimpan.</div></div>`}
    <div class="kv mt12">${kv('Sumber', r.mode === 'PO' ? esc((c.item || {}).po_no || '—') : 'Tanpa PO · ' + esc(r.tanpa_po_alasan))}${kv('Supplier', esc(c.sup ? c.sup.nama : '—'))}${kv('Bahan', esc(b ? b.nama_standar : '—'))}
      ${kv('Jumlah', c.base ? fmtN(r.qty) + ' ' + esc(r.satuan || u) + ' = ' + fmtQ(c.base, u) : '—')}${kv('Selisih PO', c.selisih !== undefined ? fmtQ(c.selisih, u) + (r.alasan_selisih ? ' · ' + esc(r.alasan_selisih) : '') : '—')}
      ${kv('Batch', esc(String(r.nomor_batch).toUpperCase() || '—') + (c.batchAda ? ' (tambah ke ' + esc(c.batchAda.batch_id) + ')' : ' (baru)'))}${kv('Kedaluwarsa', dTxt(c.exp))}${kv('Lokasi', esc(lokName(r.lokasi_id)))}
      ${kv('Wadah', r.wadah.length + ' · ' + c.pred.filter(p => p.st === 'Tersedia').length + ' Tersedia / ' + c.pred.filter(p => p.st === 'Karantina').length + ' Karantina')}${kv('Tanggal terima', esc(r.tanggal_terima))}${kv('Surat jalan', esc(r.no_surat_jalan || '—'))}${kv('SDS', c.sds ? esc(c.sds.sds_id) : (c.needSds ? '<span class="err-t">menunggu</span>' : 'N/A'))}</div>
    <p class="help mt12">Simpan akan membuat: ${c.batchAda ? '0' : '1'} batch, ${r.wadah.length} wadah ber-ID unik, ${r.wadah.length} baris ledger TERIMA, 1 baris audit. Penyimpanan bersifat atomik (draf → aktif di langkah akhir).</p>
  </div></div>`;
}

/** Panel kanan: generator label termal (pratinjau langsung). */
function rcvLabelPanel(c) {
  const r = App.rcv, b = c.bahan;
  const sample = (i, karantina) => labelHtml({
    wadah_id: `WDH-${today().substr(0, 4)}-•••••`, bahan: b ? b.nama_standar : 'Nama bahan', cas: b ? b.cas_number : '', qty: r.wadah[i] ? fmtQ(r.wadah[i].qty || 0, b ? b.satuan_dasar : '') : '',
    batch: String(r.nomor_batch || 'BATCH').toUpperCase(), exp: dTxt(c.exp), lokasi: lokName(r.lokasi_id), ghs: b ? b.kelas_bahaya : '', nfpa: b ? b.nfpa : '', karantina
  });
  const qi = c.pred.findIndex(p => p.st === 'Karantina');
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-printer"></i> Contoh label botol</span><span class="idx">STANDARD ${esc(App.S.settings.label_size || '50x30')} mm</span></div><div class="panel-b">
    <div class="row between"><span class="lbl">Pratinjau</span><span class="caps ok-t">Siap setelah simpan</span></div>
    <div class="mt8">${sample(0, c.pred[0] && c.pred[0].st === 'Karantina')}</div>
    ${qi > 0 ? `<div class="mt12"><div class="caps" style="color:var(--err)">Status: isolasi karantina (wadah #${qi + 1})</div><div class="mt8">${sample(qi, true)}</div></div>` : ''}
    <p class="help mt12">Label bisa dicetak setelah disimpan.</p></div></div>`;
}

function renderRcvResult(el) {
  const res = App.rcv.result, I = App.idx;
  const ws = res.wadah_ids.map(id => I.wadah.get(id)).filter(Boolean);
  el.innerHTML = `<div class="note ok"><i class="bi bi-check2-square"></i><div><b>Berhasil disimpan.</b> ${res.wadah_ids.length} botol masuk stok${res.karantina ? ` (${res.karantina} ditahan dulu untuk diperiksa)` : ''}. Tempel label di tiap botol.</div></div>
    <div class="grid g-main mt12"><div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-printer"></i> Label botol siap dicetak</span><span class="idx">${ws.length} LABEL</span></div>
      <div class="panel-b"><div class="grid g2" id="rcvLabels">${ws.map(w => labelHtml(labelData(w))).join('')}</div></div>
      <div class="panel-f"><button class="btn" data-act="labelPdf" data-ids="${esc(res.wadah_ids.join(','))}"><i class="bi bi-filetype-pdf"></i> Cetak ${ws.length} label (PDF)</button><button class="btn btn-c" data-act="labelPrint" data-ids="${esc(res.wadah_ids.join(','))}"><i class="bi bi-printer"></i> Kirim ke printer</button></div></div>
    <div>      <button class="btn btn-p btn-lg btn-blk mt12" data-act="rcvNewBtn"><i class="bi bi-plus-square"></i> Penerimaan baru</button>
      <button class="btn btn-blk mt8" data-act="go" data-v="stok">Lihat di stok</button></div></div>`;
}

// ── Aksi penerimaan ──
IN.rcvField = el => {
  const r = App.rcv; r[el.name] = el.type === 'checkbox' ? el.checked : el.value; r.t = Date.now();
  saveRcvDraft();
  // Perbarui bagian terhitung tanpa render ulang penuh (fokus tetap)
  const c = rcvCalc();
  const cv = $('#rcvConv'); if (cv) cv.innerHTML = rcvConvHtml(c);
  const dv = $('#rcvDev'); if (dv) dv.innerHTML = rcvDevHtml(c);
  const bn = $('#rcvBatchNote'); if (bn) bn.innerHTML = rcvBatchNote(c);
  const ov = $('#rcvOver'); if (ov && (!!ov.innerHTML.trim()) !== !!c.overTol) ov.innerHTML = c.overTol ? `<label class="chk mt8 err-t"><input type="checkbox" name="konfirmasi_lebih" ${r.konfirmasi_lebih ? 'checked' : ''} data-ch="rcvField"> Saya konfirmasi lebih kirim ${fmtN(c.pct, 1)}% (di atas toleransi)</label>` : '';
  updateRcvCommit(c);
};
CH.rcvField = el => { IN.rcvField(el); if (el.name === 'qty' || el.name === 'no_surat_jalan' || el.name === 'catatan' || el.name === 'nomor_batch') return;
  if (el.name === 'po_no') { App.rcv.po_item_id = ''; App.rcv.bahan_id = ''; }
  if (el.name === 'bahan_id' || el.name === 'po_no') App.rcv.satuan = '';
  render('terima'); };
CH.rcvPoItem = el => { const r = App.rcv; r.po_item_id = el.value; const it = App.idx.poItem.get(el.value); if (it) { r.bahan_id = it.bahan_id; r.satuan = it.satuan_pesan; r.qty = String(Math.max(0, num(it.qty_pesan) * (1 - num(it.qty_diterima_dasar) / (num(it.qty_pesan_dasar) || 1)))); } saveRcvDraft(); render('terima'); };
function updateRcvCommit(c) {
  const b = $('#btnRcvSave'); if (b) b.setAttribute('aria-disabled', c.errs.length ? 'true' : 'false');
  const cs = $('.commit .cs'); if (cs) cs.innerHTML = `<span class="sq" style="background:${c.errs.length ? 'var(--err)' : 'var(--ok-fg)'}"></span><span class="caps">${c.errs.length ? 'Status transaksi: ' + c.errs.length + ' isian belum valid' : 'Status transaksi: validasi selesai'}</span>`;
}
ACT.rcvMode = el => { const r = App.rcv; r.mode = el.dataset.m; r.po_no = ''; r.po_item_id = ''; r.bahan_id = ''; r.satuan = ''; r.alasan_selisih = ''; saveRcvDraft(); render('terima'); };
ACT.rcvStep = el => { App.rcv.step = +el.dataset.s; saveRcvDraft(); render('terima'); };
CH.rcvJml = el => {
  const n = Math.max(1, Math.min(200, parseInt(el.value, 10) || 1)); const r = App.rcv;
  while (r.wadah.length < n) r.wadah.push({ qty: '', kondisi: 'Baik' });
  r.wadah.length = n; Object.keys(App.fotos).forEach(k => { if (+k >= n) delete App.fotos[k]; });
  ACT.rcvSplit(null, true); saveRcvDraft(); render('terima');
};
ACT.rcvSplit = (el, silent) => {
  const r = App.rcv, c = rcvCalc(); if (!c.base) { if (!silent) toast('Isi jumlah & satuan di langkah 2 dahulu.', 'warn'); return; }
  const n = r.wadah.length, each = Math.floor(c.base / n * 10000) / 10000;
  r.wadah.forEach((w, i) => w.qty = String(i === n - 1 ? r4(c.base - each * (n - 1)) : each));
  saveRcvDraft(); if (!silent) render('terima');
};
IN.rcvW = el => { const r = App.rcv; r.wadah[+el.dataset.i].qty = el.value; saveRcvDraft(); const c = rcvCalc(); const t = $('#rcvTot'); if (t) t.textContent = fmtQ(c.totWadah, c.bahan ? c.bahan.satuan_dasar : ''); updateRcvCommit(c); };
CH.rcvKond = el => { App.rcv.wadah[+el.dataset.i].kondisi = el.value; saveRcvDraft(); render('terima'); };
CH.rcvAllKondisi = el => { App.rcv.wadah.forEach(w => w.kondisi = el.value); saveRcvDraft(); render('terima'); };
CH.rcvFoto = async el => { const f = el.files[0]; if (!f) return; try { App.fotos[+el.dataset.i] = await compressImage(f); render('terima'); } catch (e) { toast('Foto gagal diproses: ' + e.message, 'err'); } };
ACT.rcvFotoDel = el => { delete App.fotos[+el.dataset.i]; render('terima'); };
ACT.rcvDraft = () => { App.rcv.t = Date.now(); ls('ci_rcv_draft', App.rcv); toast('Draf tersimpan di perangkat ini (foto tidak ikut disimpan).', 'ok'); };
ACT.rcvReset = async () => { if (await ask({ title: 'Batalkan penerimaan', msg: 'Hapus semua isian penerimaan ini? Stok tidak berubah.', danger: true, ok: 'Ya, batalkan' })) { App.rcv = rcvNew(); App.fotos = {}; ls('ci_rcv_draft', null); render('terima'); } };
ACT.rcvNewBtn = () => { App.rcv = rcvNew(); App.fotos = {}; ls('ci_rcv_draft', null); render('terima'); };

/** Kompres foto di browser (sisi terpanjang ±1600 px, JPEG). */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const data = cv.toDataURL('image/jpeg', 0.8);
      const t = document.createElement('canvas'); t.width = 72; t.height = 72; t.getContext('2d').drawImage(img, 0, 0, 72, 72);
      URL.revokeObjectURL(url);
      resolve({ b64: data.split(',')[1], mime: 'image/jpeg', name: (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', size: Math.round(data.length * 0.75), thumb: t.toDataURL('image/jpeg', 0.6) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Format gambar tidak didukung.')); };
    img.src = url;
  });
}

ACT.rcvSave = async (el, ev, flags) => {
  const r = App.rcv, c = rcvCalc();
  if (c.errs.length) { r.step = c.errs[0].step; render('terima'); toast(c.errs[0].msg, 'err'); return; }
  const p = Object.assign({
    request_id: r.request_id, mode: r.mode, po_item_id: r.po_item_id, tanpa_po_alasan: r.tanpa_po_alasan, supplier_id: c.supplier_id,
    bahan_id: c.bahan.bahan_id, tanggal_terima: r.tanggal_terima, no_surat_jalan: r.no_surat_jalan, qty: num(r.qty), satuan: r.satuan || c.bahan.satuan_dasar,
    alasan_selisih: r.alasan_selisih, catatan: r.catatan, konfirmasi_lebih: !!r.konfirmasi_lebih, nomor_batch: String(r.nomor_batch).trim().toUpperCase(),
    tgl_produksi: r.tgl_produksi, tgl_kedaluwarsa: r.tgl_kedaluwarsa, tanpa_kedaluwarsa: !!r.tanpa_kedaluwarsa, lokasi_id: r.lokasi_id,
    wadah: r.wadah.map((w, i) => ({ qty_awal_dasar: num(w.qty), kondisi: w.kondisi, foto: App.fotos[i] ? { b64: App.fotos[i].b64, mime: App.fotos[i].mime, name: App.fotos[i].name } : null })),
    tambah_ke_batch: !!c.batchAda
  }, flags || {});
  const btn = $('#btnRcvSave');
  try {
    const d = await act('simpanPenerimaan', p, { btn, busy: 'Menyimpan & membuat ledger…', quiet: true });
    r.result = d; App.fotos = {}; ls('ci_rcv_draft', null); render('terima');
    toast(`Penerimaan ${d.terima_id} tersimpan: ${d.wadah_ids.length} wadah.`, 'ok');
  } catch (e) {
    if (e.code === 'BATCH_ADA') { if (await ask({ title: 'Batch sudah ada', msg: e.message, ok: 'Ya, tambahkan wadah' })) ACT.rcvSave(el, ev, Object.assign({}, flags, { tambah_ke_batch: true })); return; }
    if (e.code === 'EXP_BEDA') { if (await ask({ title: 'Kedaluwarsa berbeda', msg: e.message, tone: 'warn', ok: 'Konfirmasi & simpan' })) ACT.rcvSave(el, ev, Object.assign({}, flags, { tambah_ke_batch: true, konfirmasi_exp_beda: true })); return; }
    if (e.code === 'DUPLIKAT') { toast('Penerimaan ini sudah tersimpan sebelumnya.', 'warn'); App.rcv = rcvNew(); ls('ci_rcv_draft', null); syncNow(true); return; }
    showErr(e);
  }
};

// ════════════════════════════════════════════════════════
// BAGIAN 8: PENGAMBILAN FEFO [W-04/W-05] — optimistic + outbox
// ════════════════════════════════════════════════════════

function ambNew(bahan_id, pinned) {
  return { bahan_id: bahan_id || '', pinned: pinned || [], qty: '', satuan: '', tujuan: 'Analisis rutin', referensi: '', catatan_tujuan: '',
    penyetuju_id: (App.user || {}).user_id, metode: 'Estimasi', sisa_aktual: '', alasan_override: '', sds_ack: false, request_id: uid(), t0: Date.now() };
}

function ambPlan() {
  const a = App.amb, I = App.idx;
  const b = I.bahan.get(a.bahan_id); if (!b) return null;
  const cand = fefo(b.bahan_id);
  const unit = a.satuan || b.satuan_dasar;
  const conv = a.qty === '' ? { v: 0 } : toBase(b, a.qty, unit);
  const pinnedW = a.pinned.map(id => I.wadah.get(id)).filter(Boolean);
  const order = pinnedW.concat(cand.filter(w => a.pinned.indexOf(w.wadah_id) < 0));
  let need = conv.v || 0; const lines = [];
  for (const w of order) {
    if (need <= TOL) break;
    if (!usable(w)) continue;
    const take = r4(Math.min(need, avail(w)));
    lines.push({ w, qty: take, s0: num(w.qty_sisa_dasar), s1: r4(num(w.qty_sisa_dasar) - take) });
    need = r4(need - take);
  }
  const totalAvail = r4(cand.reduce((s, w) => s + avail(w), 0));
  const override = lines.some((l, i) => !cand[i] || l.w.wadah_id !== cand[i].wadah_id);
  const pinnedBad = pinnedW.filter(w => !usable(w));
  return { b, cand, conv, unit, lines, short: need > TOL ? need : 0, totalAvail, override, pinnedBad, sdsSt: (b.butuh_sds === true || b.butuh_sds === 'true') ? sdsStatus(b.bahan_id) : 'Aktif' };
}

function ambErrors(p) {
  const a = App.amb, e = [];
  if (!p) { e.push('Pilih bahan.'); return e; }
  if (p.conv.err) e.push(p.conv.err);
  if (!(p.conv.v > 0)) e.push('Isi jumlah yang dibutuhkan.');
  if (p.short) e.push(`Stok tidak cukup (kurang ${fmtQ(p.short, p.b.satuan_dasar)}).`);
  if (p.pinnedBad.length) e.push(`Botol ${p.pinnedBad.map(w => w.wadah_id).join(', ')} tidak bisa diambil (${dispStatus(p.pinnedBad[0])}).`);
  if (p.override && !a.alasan_override) e.push('Pilih alasan memakai botol lain.');
  if (p.sdsSt !== 'Aktif' && !a.sds_ack) e.push('Centang konfirmasi lembar keselamatan (SDS).');
  if (!a.penyetuju_id) e.push('Pilih siapa yang menyetujui.');
  if (a.tujuan === 'Lainnya' && !a.catatan_tujuan) e.push('Jelaskan keperluannya.');
  const last = p.lines[p.lines.length - 1];
  if (last && a.metode !== 'Habis' && a.sisa_aktual !== '' && (num(a.sisa_aktual) < 0 || num(a.sisa_aktual) > last.s0)) e.push('Sisa sebenarnya harus antara 0 dan isi botol sebelum diambil.');
  return e;
}

RENDER.ambil = el => {
  if (!App.amb) App.amb = ambNew();
  const a = App.amb, I = App.idx, S = App.S, p = ambPlan();
  const errs = ambErrors(p);
  const dua = S.settings.approval_mode === 'DUA_LANGKAH';
  const pend = S.pengambilan.filter(x => x.status === 'Diajukan');
  const groups = {}; pend.forEach(x => (groups[x.grup_id] = groups[x.grup_id] || []).push(x));
  const pendPanel = Object.keys(groups).length ? `<div class="panel mb8" style="border:2px solid var(--sk-bd)"><div class="panel-h"><span class="ttl"><i class="bi bi-hourglass-split" style="color:var(--sk-fg)"></i> Menunggu persetujuan (${Object.keys(groups).length})</span></div>
    ${Object.keys(groups).map(g => { const rs = groups[g], b = I.bahan.get(rs[0].bahan_id) || {}; const me = App.user.user_id;
      const canDecide = String(rs[0].penyetuju) === me || App.user.peran === 'Admin'; const canCancel = String(rs[0].pengambil) === me || App.user.peran === 'Admin';
      return `<div class="act-item"><span class="ai s-sk"><i class="bi bi-person"></i></span><div class="grow"><b>${esc(userName(rs[0].pengambil))}</b> ingin mengambil <b>${fmtQ(rs.reduce((s, r) => s + num(r.qty_diambil_dasar), 0), b.satuan_dasar)} ${esc(b.nama_standar)}</b>
        <div class="t-sm muted">Untuk: ${esc(rs[0].tujuan)} · disetujui oleh ${esc(userName(rs[0].penyetuju))}</div></div>
        <div class="row wrap">${canDecide ? `<button class="btn btn-sm btn-p" data-act="ambDecide" data-g="${esc(g)}" data-k="Disetujui"><i class="bi bi-check-lg"></i> Setujui</button><button class="btn btn-sm btn-d" data-act="ambDecide" data-g="${esc(g)}" data-k="Ditolak">Tolak</button>` : ''}${canCancel ? `<button class="btn btn-sm" data-act="ambDecide" data-g="${esc(g)}" data-k="Dibatalkan">Batalkan</button>` : ''}</div></div>`; }).join('')}</div>` : '';

  const stepH = (n, t, done) => `<div class="panel-h"><span class="ttl"><span class="step-n ${done ? 'done' : ''}">${done ? '<i class="bi bi-check-lg"></i>' : n}</span> ${t}</span></div>`;

  // Langkah 1 — pilih bahan
  const b = p ? p.b : null;
  const allW = b ? (I.wByB.get(b.bahan_id) || []) : [];
  const bahanOpts = S.bahan.filter(x => x.status === 'Aktif').map(x => { const s = I.stat.get(x.bahan_id); return { v: x.bahan_id, t: `${x.nama_standar} (stok ${fmtQ(s.ef, x.satuan_dasar)})` }; });
  const s1 = `<div class="panel">${stepH(1, 'Bahan apa yang diambil?', !!b)}<div class="panel-b">
    <div class="field"><label>Pilih dari daftar</label><select class="sel" data-ch="ambBahan" aria-label="Pilih bahan">${opts(bahanOpts, a.bahan_id, 'Ketuk untuk memilih bahan…')}</select></div>
    ${b && b.kelas_bahaya ? `<div class="note err mt12"><i class="bi bi-exclamation-triangle"></i><div><b>Hati-hati:</b> ${String(b.kelas_bahaya).split(',').map(g => esc(EN.ghs[g.trim()] || g)).join(', ')}${b.suhu_simpan ? ` · simpan ${esc(b.suhu_simpan)}` : ''}. Gunakan APD sesuai SDS.</div></div>` : ''}
  </div></div>`;

  // Langkah 2 — botol
  const cand = p ? p.cand : [];
  const nonUsable = allW.filter(w => !usable(w) && AKHIR.indexOf(w.status) < 0);
  const btl = (w, i) => { const bt = I.batch.get(w.batch_id) || {}; const pinned = a.pinned.indexOf(w.wadah_id) >= 0; const d = daysLeft(w);
    return `<div class="fefo ${i === 0 && !a.pinned.length ? 'top' : ''} ${pinned ? 'pick' : ''}" data-act="ambPick" data-id="${esc(w.wadah_id)}" role="button" tabindex="0">
      <div class="row between top"><div class="row top"><span class="qrb"><i class="bi bi-droplet-half"></i></span><div>
        <div class="row wrap">${i === 0 ? '<span class="bdg s-ok"><i class="bi bi-star-fill"></i> Disarankan</span>' : ''}${w.status === 'Terbuka' ? '<span class="bdg s-op">Sudah dibuka</span>' : '<span class="bdg s-hb">Masih tersegel</span>'}${pinned ? '<span class="bdg s-ink">Dipilih</span>' : ''}</div>
        <div class="mt8"><b>${esc(lokName(w.lokasi_id))}</b></div>
        <div class="t-sm muted">Sisa <b>${fmtQ(avail(w), b.satuan_dasar)}</b> · kedaluwarsa <span class="${d <= 30 ? 'err-t b' : ''}">${dTxt(w.tgl_kedaluwarsa_efektif)} (${hariTxt(d)})</span></div>
        <div class="t-sm muted">Kode botol <span class="mono">${esc(w.wadah_id)}</span>${bt.nomor_batch ? ' · batch ' + esc(bt.nomor_batch) : ''}</div></div></div></div></div>`; };
  const others = cand.slice(1, 8);
  const offPick = a.pinned.some(id => !cand[0] || id !== cand[0].wadah_id);
  const s2 = !b ? '' : `<div class="panel mt12">${stepH(2, 'Botol yang dipakai', cand.length > 0)}<div class="panel-b">
    ${!cand.length ? `<div class="note err"><i class="bi bi-x-octagon"></i><div>Tidak ada botol yang bisa diambil untuk bahan ini${nonUsable.length ? ` (${nonUsable.length} botol sedang ditahan/kedaluwarsa)` : ''}.</div></div>` :
      `<p class="t-sm muted" style="margin:0 0 10px">Sistem menyarankan botol yang sudah dibuka atau paling cepat kedaluwarsa, agar tidak ada bahan terbuang.</p>${btl(cand[0], 0)}
      ${others.length ? `<details class="adv mt12" ${offPick ? 'open' : ''}><summary>Pakai botol lain (${others.length})</summary><div class="mt8">${others.map((w, i) => btl(w, i + 1)).join('')}</div></details>` : ''}`}
    ${offPick ? `<button class="btn btn-sm btn-g mt8" data-act="ambUnpin"><i class="bi bi-arrow-counterclockwise"></i> Kembali ke saran sistem</button>` : ''}
  </div></div>`;

  // Langkah 3 — jumlah
  const u = b ? b.satuan_dasar : '';
  const last = p && p.lines.length ? p.lines[p.lines.length - 1] : null;
  const advOpen = a.metode !== 'Estimasi' || a.sisa_aktual !== '';
  const s3 = !b || !cand.length ? '' : `<div class="panel mt12">${stepH(3, 'Berapa banyak?', p.conv.v > 0 && !p.short)}<div class="panel-b">
    <div class="field"><div class="ingrp"><input class="inp big" id="ambQty" inputmode="decimal" value="${esc(a.qty)}" data-in="ambQty" placeholder="0" aria-label="Jumlah"><select class="sel suf2" style="height:60px;font-size:16px" data-ch="ambUnit" aria-label="Satuan">${opts(unitsFor(b), a.satuan || u)}</select></div>
      <span class="help" id="ambEq">${ambEqTxt(p)}</span></div>
    <div id="ambSplitNote" class="mt8">${ambSplitNote(p)}</div>
    <div id="ambPlanBox">${ambPlanTable(p)}</div>
    <details class="adv mt12" ${advOpen ? 'open' : ''}><summary>Isi botol tidak sesuai / botol jadi kosong?</summary><div class="mt8">
      ${[['Estimasi', 'Biarkan sistem menghitung sisa'], ['Ditimbang', 'Saya menimbang sisanya'], ['Habis', 'Botol sudah kosong']].map(m => `<label class="optbox ${a.metode === m[0] ? 'on' : ''}" style="margin-bottom:6px"><span class="chk"><input type="radio" name="metode" value="${m[0]}" ${a.metode === m[0] ? 'checked' : ''} data-ch="ambMetode"></span>${m[1]}</label>`).join('')}
      ${a.metode !== 'Habis' ? `<div class="field mt8"><label>Sisa sebenarnya di botol (${esc(u)}) — opsional</label><input class="inp mono" inputmode="decimal" value="${esc(a.sisa_aktual)}" data-in="ambSisa" placeholder="${last ? fmtN(last.s1) : ''}"><span class="help">Isi hanya bila berbeda dari perkiraan sistem. Selisihnya dicatat terpisah, angka pengambilan tetap.</span></div>` : ''}
    </div></details>
    <div id="ambWarn">${ambWarn(p)}</div>
  </div></div>`;

  // Langkah 4 — keperluan & persetujuan
  const users = S.users.filter(x => x.status === 'Aktif');
  const allowSelf = setB('allow_self_approval') || users.length === 1;
  const s4 = !b || !cand.length ? '' : `<div class="panel mt12">${stepH(4, 'Untuk keperluan apa?', !!a.tujuan && !!a.penyetuju_id)}<div class="panel-b">
    <div class="fgrid c2"><div class="field"><label>Keperluan <span class="req">*</span></label><select class="sel" data-ch="ambField" name="tujuan">${opts(EN.tujuan, a.tujuan)}</select></div>
      <div class="field"><label>Disetujui oleh <span class="req">*</span></label><select class="sel" data-ch="ambField" name="penyetuju_id">${opts(users.filter(x => allowSelf || x.user_id !== App.user.user_id).map(x => ({ v: x.user_id, t: x.nama + (x.user_id === App.user.user_id ? ' (saya sendiri)' : '') })), a.penyetuju_id, 'Pilih…')}</select>
        ${a.penyetuju_id === App.user.user_id && users.length > 1 ? '<span class="help">Persetujuan sendiri tetap dicatat.</span>' : ''}</div></div>
    ${a.tujuan === 'Lainnya' ? `<div class="field mt12"><label>Jelaskan keperluannya <span class="req">*</span></label><input class="inp" name="catatan_tujuan" value="${esc(a.catatan_tujuan)}" data-in="ambField"></div>` : ''}
    <div class="field mt12"><label>No. sampel / proyek <span class="muted">(opsional)</span></label><input class="inp mono" name="referensi" value="${esc(a.referensi)}" data-in="ambField" placeholder="mis. SMP-0123"></div>
  </div></div>`;

  const commit = !b || !cand.length ? '' : `<div class="commit"><div class="grow"><div class="b">Ringkasan</div><div class="t-sm muted" id="ambSummary">${ambSummary(p, dua)}</div>
      <div id="ambErr" class="mt8">${errs.length && a.qty !== '' ? `<div class="note err"><i class="bi bi-info-circle"></i><div>${errs.map(esc).join('<br>')}</div></div>` : ''}</div></div>
    <div class="act"><button class="btn btn-lg" data-act="ambReset">Batal</button><button class="btn btn-p btn-lg" id="btnAmb" data-act="ambCommit" ${errs.length ? 'aria-disabled="true"' : ''}><i class="bi bi-check2-circle"></i> ${dua ? 'Ajukan' : 'Simpan pengambilan'}</button></div></div>`;

  el.innerHTML = `${pendPanel}${s1}${s2}${s3}${s4}${commit}`;
};

function ambEqTxt(p) {
  if (!p || !(p.conv.v > 0)) return '';
  const b = p.b, d = num(b.densitas_g_per_mL);
  if (b.satuan_dasar === 'mL' && d) return `≈ ${fmtN(p.conv.v * d, 1)} gram`;
  if (b.satuan_dasar === 'g' && d) return `≈ ${fmtN(p.conv.v / d, 1)} mL`;
  return `= ${fmtQ(p.conv.v, b.satuan_dasar)}`;
}
function ambSplitNote(p) {
  if (!p || p.lines.length < 2) return '';
  return `<div class="note"><i class="bi bi-info-circle"></i><div>Satu botol tidak cukup, jadi diambil dari <b>${p.lines.length} botol</b> sekaligus. Semua tercatat dalam satu kali simpan.</div></div>`;
}
function ambPlanTable(p) {
  if (!p || !p.lines.length) return '';
  const u = p.b.satuan_dasar;
  return `<div class="mt8">${p.lines.map(l => { const habis = l.s1 <= TOL; const baru = l.w.status === 'Tersedia' && !habis;
    return `<div class="act-item" style="padding:10px 0"><span class="ai ${habis ? 's-hb' : 's-op'}"><i class="bi ${habis ? 'bi-recycle' : 'bi-droplet-half'}"></i></span><div class="grow">
      Ambil <b class="cob">${fmtQ(l.qty, u)}</b> dari botol di <b>${esc(lokName(l.w.lokasi_id))}</b>
      <div class="t-sm muted">Sisa setelahnya: <b class="${habis ? 'err-t' : ''}">${habis ? 'kosong' : fmtQ(l.s1, u)}</b>${baru ? ' · botol baru dibuka' : ''}</div></div>
      ${baru ? `<button class="btn btn-sm" data-act="labelPrint" data-ids="${esc(l.w.wadah_id)}"><i class="bi bi-printer"></i> Label</button>` : ''}</div>`; }).join('')}
    ${p.short ? `<div class="note err"><i class="bi bi-exclamation-triangle"></i><div>Stok kurang <b>${fmtQ(p.short, u)}</b>.</div></div>` : ''}</div>`;
}
function ambWarn(p) {
  if (!p) return '';
  const a = App.amb; let h = '';
  if (p.override && p.lines.length) h += `<div class="note warn mt12"><i class="bi bi-exclamation-triangle"></i><div><b>Anda memakai botol yang bukan saran sistem.</b> Mohon pilih alasannya:
    <select class="sel mt8" data-ch="ambField" name="alasan_override">${opts(EN.alasan_override, a.alasan_override, 'Pilih alasan…')}</select></div></div>`;
  if (p.sdsSt !== 'Aktif' && p.sdsSt !== 'N/A') h += `<div class="note err mt12"><i class="bi bi-file-earmark-x"></i><div><b>Lembar keselamatan (SDS) bahan ini ${esc(p.sdsSt.toLowerCase())}.</b> ${setB('block_on_expired_sds') ? 'Pengambilan tidak diizinkan sampai SDS diperbarui.' : `<label class="chk"><input type="checkbox" ${a.sds_ack ? 'checked' : ''} data-ch="ambAck"> Saya paham risikonya dan tetap aman</label>`}
    <div><a href="javascript:void(0)" data-act="sdsUpload" data-b="${esc(p.b.bahan_id)}">Unggah SDS terbaru</a></div></div></div>`;
  return h;
}
function ambSummary(p, dua) {
  if (!p || !p.lines.length) return 'Isi jumlah yang dibutuhkan.';
  const tot = p.lines.reduce((s, l) => s + l.qty, 0);
  return `${esc(App.user.nama)} mengambil <b>${fmtQ(tot, p.b.satuan_dasar)} ${esc(p.b.nama_standar)}</b> dari ${p.lines.length} botol.${dua ? ' Stok dipesan dulu, dipotong setelah disetujui.' : ''}`;
}
/** Perbarui bagian dinamis tanpa render ulang penuh (input tetap fokus). */
function ambRefresh() {
  const p = ambPlan(), errs = ambErrors(p), dua = App.S.settings.approval_mode === 'DUA_LANGKAH';
  const set = (id, h) => { const x = document.getElementById(id); if (x) x.innerHTML = h; };
  set('ambEq', ambEqTxt(p)); set('ambSplitNote', ambSplitNote(p)); set('ambPlanBox', ambPlanTable(p)); set('ambWarn', ambWarn(p)); set('ambSummary', ambSummary(p, dua));
  set('ambErr', errs.length && App.amb.qty !== '' ? `<div class="note err"><i class="bi bi-info-circle"></i><div>${errs.map(esc).join('<br>')}</div></div>` : '');
  const b = $('#btnAmb'); if (b) b.setAttribute('aria-disabled', errs.length ? 'true' : 'false');
}
let ambTimerId = null;
function startAmbTimer() {
  clearInterval(ambTimerId);
  ambTimerId = setInterval(() => { const t = $('#ambTimer'); if (!t || App.view !== 'ambil') { clearInterval(ambTimerId); return; } t.textContent = ((Date.now() - App.amb.t0) / 1000).toFixed(1) + 's'; }, 200);
}

IN.ambQty = el => { App.amb.qty = el.value; ambRefresh(); };
CH.ambUnit = el => { App.amb.satuan = el.value; ambRefresh(); };
IN.ambSisa = el => { App.amb.sisa_aktual = el.value; ambRefresh(); };
IN.ambField = el => { App.amb[el.name] = el.value; ambRefresh(); };
CH.ambField = el => { App.amb[el.name] = el.value; if (el.name === 'tujuan' || el.name === 'penyetuju_id') render('ambil'); else ambRefresh(); };
CH.ambMetode = el => { App.amb.metode = el.value; if (el.value === 'Habis') App.amb.sisa_aktual = ''; render('ambil'); };
CH.ambAck = el => { App.amb.sds_ack = el.checked; ambRefresh(); };
CH.ambBahan = el => { const q = App.amb.qty; App.amb = ambNew(el.value); App.amb.qty = q; render('ambil'); };
ACT.ambPick = el => {
  const id = el.dataset.id, a = App.amb;
  a.pinned = a.pinned.indexOf(id) >= 0 ? a.pinned.filter(x => x !== id) : [id];
  render('ambil');
};
ACT.ambUnpin = () => { App.amb.pinned = []; App.amb.alasan_override = ''; render('ambil'); };
ACT.ambReset = () => { App.amb = ambNew(); render('ambil'); };
function ambSelectWadah(code) {
  code = String(code || '').trim().toUpperCase();
  const w = App.idx.wadah.get(code);
  if (!w) { toast(`ID "${code}" tidak dikenal.`, 'err'); return; }
  const q = App.amb && App.amb.bahan_id === w.bahan_id ? App.amb.qty : '';
  App.amb = ambNew(w.bahan_id, [w.wadah_id]); App.amb.qty = q;
  if (!usable(w)) toast(`${w.wadah_id} berstatus ${dispStatus(w)} — tidak dapat diambil.`, 'err');
  go('ambil', { keepScroll: true });
  setTimeout(() => { const qi = $('#ambQty'); if (qi) qi.focus(); }, 40);
}
ACT.ambilWadah = el => ambSelectWadah(el.dataset.id);
ACT.ambilBahan = el => { App.amb = ambNew(el.dataset.b); go('ambil'); };

ACT.ambCommit = async () => {
  const a = App.amb, p = ambPlan(), errs = ambErrors(p);
  if (errs.length) { toast(errs[0], 'err'); ambRefresh(); return; }
  const dua = App.S.settings.approval_mode === 'DUA_LANGKAH';
  const lastI = p.lines.length - 1;
  const payload = {
    request_id: a.request_id, qty_input: num(a.qty), satuan_input: a.satuan || p.b.satuan_dasar, tujuan: a.tujuan, referensi: a.referensi,
    catatan_tujuan: a.catatan_tujuan, penyetuju_id: a.penyetuju_id, alasan_override: p.override ? a.alasan_override : '', sds_ack: !!a.sds_ack,
    expected: {},
    lines: p.lines.map((l, i) => ({ wadah_id: l.w.wadah_id, qty_dasar: l.qty, metode_sisa: i === lastI ? a.metode : (l.s1 <= TOL ? 'Habis' : 'Estimasi'),
      sisa_aktual: i === lastI && a.metode !== 'Habis' && a.sisa_aktual !== '' ? num(a.sisa_aktual) : null }))
  };
  p.lines.forEach(l => payload.expected[l.w.wadah_id] = num(l.w.qty_sisa_dasar));
  // 1) Optimistic UI: perbarui state lokal seketika
  const rb = applyOptimisticAmbil(payload, p.b, dua);
  App.rollbacks[a.request_id] = { fn: rb, amb: Object.assign({}, a) };
  // 2) Antrekan ke outbox (persisten) & kirim di latar
  outboxPush({ id: a.request_id, action: 'simpanPengambilan', payload, label: `Ambil ${fmtQ(p.conv.v, p.b.satuan_dasar)} ${p.b.nama_standar}`, t: Date.now() });
  toast(`${dua ? 'Diajukan' : 'Tercatat'}: ${fmtQ(p.conv.v, p.b.satuan_dasar)} ${p.b.nama_standar} (${((Date.now() - a.t0) / 1000).toFixed(1)} dtk). Sinkron di latar…`, 'ok');
  App.amb = ambNew();
  render('ambil');
  flushOutbox();
};

function applyOptimisticAmbil(payload, b, dua) {
  const I = App.idx, S = App.S, snaps = [];
  const t = today(), now = nowTxt();
  payload.lines.forEach((l, i) => {
    const w = I.wadah.get(l.wadah_id); if (!w) return;
    snaps.push(Object.assign({}, w));
    if (dua) { w.qty_cadangan_dasar = r4(num(w.qty_cadangan_dasar) + l.qty_dasar); }
    else {
      const s0 = num(w.qty_sisa_dasar); let s1 = r4(s0 - l.qty_dasar);
      if (l.metode_sisa === 'Habis') s1 = 0; else if (l.sisa_aktual !== null && l.sisa_aktual !== undefined) s1 = r4(l.sisa_aktual);
      w.qty_sisa_dasar = Math.max(0, s1);
      if (!w.tgl_dibuka) { w.tgl_dibuka = t; const m = num(b.masa_pakai_setelah_dibuka_hari); if (m > 0 && !w.tgl_perpanjangan && addDays(t, m) < w.tgl_kedaluwarsa_efektif) w.tgl_kedaluwarsa_efektif = addDays(t, m); }
      w.status = w.qty_sisa_dasar <= TOL ? 'Habis' : 'Terbuka';
      S.mutasi.push({ mutasi_id: 'OPT-' + payload.request_id + '-' + i, _opt: true, waktu: now, wadah_id: w.wadah_id, bahan_id: w.bahan_id, jenis: 'AMBIL', qty_delta_dasar: r4(w.qty_sisa_dasar - s0), sisa_sebelum: s0, sisa_sesudah: w.qty_sisa_dasar, pengguna: App.user.user_id, ref_id: 'menyinkronkan…', alasan: '' });
    }
    S.pengambilan.push({ ambil_id: 'OPT-' + i, _opt: true, grup_id: 'OPT-' + payload.request_id.substr(0, 6), wadah_id: w.wadah_id, bahan_id: w.bahan_id, waktu: now, pengambil: App.user.user_id, penyetuju: payload.penyetuju_id, status: dua ? 'Diajukan' : 'Disetujui', qty_diambil_dasar: l.qty_dasar, tujuan: payload.tujuan });
  });
  reindex(); markAll();
  return () => {
    snaps.forEach(sn => { const w = App.idx.wadah.get(sn.wadah_id); if (w) Object.assign(w, sn); });
    App.S.mutasi = App.S.mutasi.filter(m => !(m._opt && m.mutasi_id.indexOf(payload.request_id) >= 0));
    App.S.pengambilan = App.S.pengambilan.filter(x => !x._opt);
    reindex(); markAll(); rerender({ now: true });
  };
}

ACT.ambDecide = async el => {
  const k = el.dataset.k;
  let alasan = '';
  if (k !== 'Disetujui') { alasan = await ask({ title: k === 'Ditolak' ? 'Tolak pengajuan' : 'Batalkan pengajuan', msg: 'Cadangan stok akan dilepas.', danger: true, ok: k, input: { label: 'Alasan', required: true } }); if (!alasan) return; }
  await act('putuskanPengambilan', { grup_id: el.dataset.g, keputusan: k, alasan }, { btn: el, ok: `Pengajuan ${el.dataset.g}: ${k}.` }).catch(() => { });
};

// ── Outbox (antrean tulis persisten, aman diulang karena request_id) ──
function outboxKey() { return 'ci_outbox_' + (App.user ? App.user.user_id : ''); }
function outboxPush(it) { App.outbox.push(it); ls(outboxKey(), App.outbox.map(x => ({ id: x.id, action: x.action, payload: x.payload, label: x.label, t: x.t }))); updateStatus(); }
function outboxSave() { ls(outboxKey(), App.outbox.map(x => ({ id: x.id, action: x.action, payload: x.payload, label: x.label, t: x.t }))); updateStatus(); }
let flushing = false;
async function flushOutbox() {
  if (flushing || !App.outbox.length) return;
  flushing = true;
  try {
    while (App.outbox.length) {
      const it = App.outbox[0];
      try {
        const d = await rpc(it.action, it.payload);
        App.outbox.shift(); outboxSave(); delete App.rollbacks[it.id];
        if (d && d.delta) mergeDelta(d.delta);
        if (d && d.override) toast(`${it.label}: override FEFO tercatat.`, 'warn');
      } catch (e) {
        if (e.network) { setTimeout(flushOutbox, 15000); break; }   // offline → coba lagi nanti
        App.outbox.shift(); outboxSave();
        if (e.code === 'DUPLIKAT') { delete App.rollbacks[it.id]; await syncNow(true); continue; }
        const rb = App.rollbacks[it.id]; delete App.rollbacks[it.id];
        if (rb) rb.fn(); else await syncNow(true);
        outboxFailed(it, e, rb);
      }
    }
  } finally { flushing = false; updateStatus(); }
}
function outboxFailed(it, e, rb) {
  const h = modal({
    title: 'Transaksi ditolak server', body: `<div class="note err"><i class="bi bi-x-octagon"></i><div><b>${esc(it.label)}</b><br>${esc(e.message)}</div></div><p class="help mt8">Perubahan lokal sudah dibatalkan. Tidak ada stok yang berubah di database.</p>`,
    foot: `<button class="btn" data-act="mclose">Tutup</button>${rb && it.action === 'simpanPengambilan' ? '<button class="btn btn-p" data-retry="1">Perbaiki &amp; ulangi</button>' : ''}`
  });
  const r = h.el.querySelector('[data-retry]');
  if (r) r.onclick = () => { h.close(); App.amb = Object.assign(rb.amb, { request_id: uid(), t0: Date.now() }); go('ambil'); };
}

// ════════════════════════════════════════════════════════
// BAGIAN 9: CARI & DAFTAR STOK [W-06/W-07]
// ════════════════════════════════════════════════════════

function stokFilterBahan() {
  const U = App.ui.stok, I = App.idx, S = App.S, q = normName(U.q), qr = String(U.q || '').trim().toUpperCase();
  return S.bahan.filter(b => {
    if (b.status !== 'Aktif' && !q) return false;
    const ws = I.wByB.get(b.bahan_id) || [];
    if (q) {
      const hay = normName([b.nama_standar, b.nama_alias, b.cas_number, b.bahan_id, b.grade].join(' '));
      if (hay.indexOf(q) < 0 && String(b.cas_number) !== U.q.trim() && !ws.some(w => w.wadah_id.indexOf(qr) >= 0 || String((I.batch.get(w.batch_id) || {}).nomor_batch).toUpperCase().indexOf(qr) >= 0)) return false;
    }
    if (U.kat !== 'SEMUA' && b.kategori !== U.kat) return false;
    if (U.lok && !ws.some(w => w.lokasi_id === U.lok && AKHIR.indexOf(w.status) < 0)) return false;
    if (U.st !== 'SEMUA') {
      const m = { TERSEDIA: w => dispStatus(w) === 'Tersedia', TERBUKA: w => dispStatus(w) === 'Terbuka', '<14H': w => AKTIF.indexOf(dispStatus(w)) >= 0 && daysLeft(w) <= 14, EXPIRED: w => dispStatus(w) === 'Kedaluwarsa', KARANTINA: w => w.status === 'Karantina' }[U.st];
      if (!ws.some(m)) return false;
    }
    if (U.sds !== 'SEMUA') { const s = I.stat.get(b.bahan_id).sdsSt; if (U.sds === 'AKTIF' && s !== 'Aktif') return false; if (U.sds === 'ALERT' && (s === 'Aktif' || s === 'N/A')) return false; }
    return true;
  }).sort((a, b) => {
    const sa = I.stat.get(a.bahan_id), sb = I.stat.get(b.bahan_id);
    const pa = (sa.low ? 4 : 0) + (sa.expd ? 2 : 0) + (sa.exp30 ? 1 : 0), pb = (sb.low ? 4 : 0) + (sb.expd ? 2 : 0) + (sb.exp30 ? 1 : 0);
    return pb - pa || a.nama_standar.localeCompare(b.nama_standar);
  });
}

RENDER.stok = el => {
  const U = App.ui.stok, S = App.S, I = App.idx;
  const kar = S.wadah.filter(w => w.status === 'Karantina' || dispStatus(w) === 'Kedaluwarsa').length;
  const low = S.bahan.filter(b => b.status === 'Aktif' && I.stat.get(b.bahan_id).low).length;
  const exp = S.wadah.filter(w => AKTIF.indexOf(dispStatus(w)) >= 0 && daysLeft(w) <= 90).length;
  const tabs = `<div class="subtabs" role="tablist">${[['katalog', 'Semua bahan', ''], ['exp', 'Segera kedaluwarsa', exp], ['low', 'Stok menipis', low], ['kar', 'Ditahan & kedaluwarsa', kar], ['arsip', 'Botol lama (arsip)', S.arsip_count]].map(t =>
    `<button class="subtab ${U.mode === t[0] ? 'on' : ''}" data-act="stokMode" data-m="${t[0]}">${t[1]}${t[2] !== '' ? `<span class="n">(${t[2]})</span>` : ''}</button>`).join('')}</div>`;
  const head = '';
  let body = '';
  if (U.mode === 'katalog') body = stokKatalog();
  else if (U.mode === 'exp') body = stokExp();
  else if (U.mode === 'low') body = stokLow();
  else if (U.mode === 'kar') body = stokKar();
  else body = stokArsip();
  el.innerHTML = head + tabs + body;
  if (U.mode === 'arsip' && !App.ui.stok.arsipRows) ACT.arsipCari();
};

function stokKatalog() {
  const U = App.ui.stok, S = App.S, I = App.idx;
  const list = stokFilterBahan();
  if (!U.sel || !I.bahan.get(U.sel)) U.sel = list[0] ? list[0].bahan_id : null;
  const aktW = S.wadah.filter(w => AKTIF.indexOf(dispStatus(w)) >= 0);
  const vol = u => aktW.filter(w => (I.bahan.get(w.bahan_id) || {}).satuan_dasar === u).reduce((s, w) => s + num(w.qty_sisa_dasar), 0);
  const lowB = S.bahan.filter(b => b.status === 'Aktif' && I.stat.get(b.bahan_id).low);
  const kimia = S.bahan.filter(b => b.status === 'Aktif' && (b.butuh_sds === true || b.butuh_sds === 'true'));
  const sdsOk = kimia.filter(b => I.stat.get(b.bahan_id).sdsSt === 'Aktif').length;
  const chip = (grp, v, label) => `<button class="chip ${U[grp] === v ? 'on' : ''}" data-act="stokChip" data-g="${grp}" data-v="${esc(v)}">${esc(label || v)}</button>`;
  const filters = `<div class="panel frame"><div class="panel-b">
    <div class="row wrap"><div class="ingrp grow" style="min-width:220px"><span class="suf" style="border-left:1px solid var(--rule);border-right:0"><i class="bi bi-funnel"></i></span><input class="inp" id="stokQ" placeholder="Ketik nama bahan, kode botol, atau nomor batch…" value="${esc(U.q)}" data-in="stokQ" aria-label="Cari stok"></div>
      <button class="btn" data-act="stokExport" title="Unduh ke Excel"><i class="bi bi-download"></i><span class="hide-m">Unduh</span></button><button class="btn" data-act="stokPrint" title="Cetak daftar stok"><i class="bi bi-printer"></i><span class="hide-m">Cetak</span></button></div>
    <details class="adv mt8" ${U.kat !== 'SEMUA' || U.st !== 'SEMUA' || U.lok || U.sds !== 'SEMUA' ? 'open' : ''}><summary><i class="bi bi-funnel"></i> Saring (kategori, status, lokasi)</summary><div class="row wrap mt8" style="gap:14px"><div class="row"><span class="lbl">Kategori:</span><div class="chips">${chip('kat', 'SEMUA', 'Semua')}${EN.kategori.map(k => chip('kat', k, k)).join('')}</div></div>
      <div class="row"><span class="lbl">Status:</span><div class="chips">${[['SEMUA', 'Semua'], ['TERSEDIA', 'Tersegel'], ['TERBUKA', 'Sudah dibuka'], ['<14H', 'Kedaluwarsa < 14 hari'], ['EXPIRED', 'Kedaluwarsa'], ['KARANTINA', 'Ditahan']].map(v => chip('st', v[0], v[1])).join('')}</div></div>
      <div class="row"><span class="lbl">Lokasi:</span><select class="sel" style="width:auto" data-ch="stokLok" aria-label="Filter lokasi">${opts(S.lokasi.map(l => ({ v: l.lokasi_id, t: l.nama })), U.lok, 'Semua lokasi')}</select></div>
      <div class="row"><span class="lbl">Lembar keselamatan:</span><div class="chips">${chip('sds', 'SEMUA', 'Semua')}${chip('sds', 'AKTIF', `Aktif (${sdsOk})`)}${chip('sds', 'ALERT', `Perlu diperbarui (${kimia.length - sdsOk})`)}</div></div></div></details></div></div>`;
  const metrics = `<div class="grid g4 mt12">
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">Registry inventory</span><span class="caps muted">METRIC-01</span></div><div class="row between mt8"><span class="h-xl">${S.bahan.filter(b => b.status === 'Aktif').length}<span class="t-lg"> bahan</span></span><span class="t-sm muted" style="text-align:right">${S.bahan.filter(b => b.status === 'Aktif' && b.jenis_item === 'Bahan Kimia').length} kimia (CAS)<br>${S.bahan.filter(b => b.status === 'Aktif' && b.jenis_item === 'Consumable').length} consumable</span></div></div></div>
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">Wadah aktif (containers)</span><span class="caps muted">METRIC-02</span></div><div class="row between mt8"><span class="h-xl">${aktW.length}<span class="t-lg"> botol/pack</span></span><span class="t-sm muted mono" style="text-align:right">${fmtN(vol('mL') / 1000, 1)} L cairan<br>${fmtN(vol('g') / 1000, 1)} kg padatan</span></div></div></div>
    <div class="panel ${lowB.length ? 'focus' : ''}" style="${lowB.length ? 'border-color:var(--err)' : ''}"><div class="panel-b"><div class="lbl err-t"><i class="bi bi-exclamation-triangle"></i> Defisit reorder point (≤ ROP)</div><div class="row between mt8"><span class="h-xl err-t">${lowB.length}<span class="t-lg"> bahan</span></span><span class="t-sm err-t" style="text-align:right">${lowB.slice(0, 2).map(b => esc(b.nama_standar)).join('<br>')}</span></div><a class="t-sm" href="javascript:void(0)" data-act="stokMode" data-m="low">Proses segera →</a></div></div>
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">SDS &amp; GHS compliance</span><span class="caps muted">K3</span></div><div class="row between mt8"><span class="h-xl ok-t">${fmtN(kimia.length ? sdsOk / kimia.length * 100 : 100, 1)}%</span><span class="t-sm" style="text-align:right">${sdsOk} SDS valid<br><span class="err-t">${kimia.length - sdsOk} perlu update</span></span></div></div></div></div>`;
  return filters + `<div class="grid g-split mt12"><div class="panel frame" style="align-self:start"><div class="panel-h"><span class="ttl"><i class="bi bi-flask"></i> Daftar bahan</span><span class="idx">SORT: PRIORITY ALERT</span></div>
    <div id="stokList" style="max-height:72vh;overflow:auto">${stokListHtml(list)}</div><div class="panel-f t-sm"><span>${list.length} bahan</span></div></div>
    <div id="stokDetail">${stokDetailHtml(U.sel)}</div></div>`;
}

function stokListHtml(list) {
  const U = App.ui.stok, I = App.idx;
  if (!list.length) return empty('Tidak ada bahan cocok dengan filter.', 'bi-search');
  return list.slice(0, 60 * U.page).map(b => {
    const s = I.stat.get(b.bahan_id), pct = s.rop > 0 ? Math.min(100, s.ef / (s.rop * 2) * 100) : 100, ropPct = s.rop > 0 ? 50 : null;
    const flag = s.low ? '<span class="kpi-tag s-ex">Menipis</span>' : s.expd ? '<span class="kpi-tag s-ex">Kedaluwarsa</span>' : s.exp30 ? '<span class="kpi-tag s-sk">Segera kedaluwarsa</span>' : '<span class="kpi-tag s-ok">Aman</span>';
    return `<div class="cat-item ${U.sel === b.bahan_id ? 'on' : ''}" data-act="stokSel" data-id="${esc(b.bahan_id)}" role="button" tabindex="0">
      <div class="row between top"><span class="t-sm muted">${esc(b.kategori)}</span>${flag}</div>
      <div class="b t-lg" style="font-family:var(--f-head)">${esc(b.nama_standar)}${b.status !== 'Aktif' ? ' <span class="bdg s-hb">Nonaktif</span>' : ''}</div>
            ${s.rop > 0 ? `<div class="row between t-sm mt8"><span>Stok</span><b class="mono ${s.low ? 'err-t' : ''}">${fmtQ(s.ef, b.satuan_dasar)}</b></div><div class="meter"><i class="${s.low ? 'low' : ''}" style="width:${pct}%"></i><b style="left:${ropPct}%"></b></div><div class="row between t-sm"><span class="muted">Pesan lagi di ${fmtQ(s.rop, b.satuan_dasar)}</span></div>`
        : `<div class="row between t-sm mt8"><span>Stok</span><b>${fmtQ(s.ef, b.satuan_dasar)}</b></div>`}
      <div class="row between t-sm mt8"><span>${s.terbuka ? `<span class="sq" style="background:var(--op-fg);width:8px;height:8px"></span> ${s.terbuka} dibuka` : ''} ${s.segel ? `<span class="sq" style="background:var(--ok-fg);width:8px;height:8px"></span> ${s.segel} tersegel` : ''}</span><span>${s.sdsSt === 'Aktif' ? '' : s.sdsSt === 'N/A' ? '' : '<span class="err-t"><i class="bi bi-x-octagon"></i> SDS ' + esc(s.sdsSt) + '</span>'}</span></div></div>`;
  }).join('') + (list.length > 60 * U.page ? `<button class="more" data-act="stokMore">Muat lebih banyak…</button>` : '');
}

function nfpaDiamond(nfpa) {
  const p = String(nfpa || '').split('-');
  return `<div class="diamond" role="img" aria-label="NFPA 704: kesehatan ${p[0] || '-'}, mudah terbakar ${p[1] || '-'}, reaktivitas ${p[2] || '-'}, khusus ${p[3] || '-'}"><div class="q f"><span>${esc(p[1] || '–')}</span></div><div class="q h"><span>${esc(p[0] || '–')}</span></div><div class="q i"><span>${esc(p[2] || '–')}</span></div><div class="q s"><span style="font-size:12px">${esc(p[3] || '–')}</span></div></div>`;
}

function stokDetailHtml(id) {
  const I = App.idx, S = App.S, b = I.bahan.get(id);
  if (!b) return `<div class="panel">${empty('Pilih bahan di katalog.', 'bi-arrow-left-square')}</div>`;
  const s = I.stat.get(b.bahan_id), u = b.satuan_dasar;
  const sds = activeSds(b.bahan_id), sdsAll = (I.sdsByB.get(b.bahan_id) || []);
  const allW = (I.wByB.get(b.bahan_id) || []);
  const habisN = allW.filter(w => AKHIR.indexOf(w.status) >= 0).length;
  const ws = allW.filter(w => App.ui.stok.showHabis || AKHIR.indexOf(w.status) < 0);
  const fe = fefo(b.bahan_id); const rank = new Map(fe.map((w, i) => [w.wadah_id, i + 1]));
  ws.sort((a, c) => (rank.get(a.wadah_id) || 999) - (rank.get(c.wadah_id) || 999) || String(a.tgl_kedaluwarsa_efektif).localeCompare(String(c.tgl_kedaluwarsa_efektif)));
  const locs = Array.from(new Set(ws.filter(w => AKHIR.indexOf(w.status) < 0).map(w => lokName(w.lokasi_id))));
  const mut = S.mutasi.filter(m => m.bahan_id === b.bahan_id).slice(-12).reverse();
  const info = s.info;
  const jenisCls = { TERIMA: 's-ok', AMBIL: 's-ex', KOREKSI_SISA: 's-sk', OPNAME_ADJ: 's-sk', REVERSAL: 's-op', DISPOSAL: 's-hb', RETUR: 's-hb', UBAH_STATUS: 's-qr', PINDAH_LOKASI: 's-hb', PERPANJANG_EXPIRY: 's-ok' };
  return `<div class="panel frame"><div class="panel-b"><div class="row wrap between top"><div><h2 class="h-lg">${esc(b.nama_standar)}</h2><div class="t-sm muted">${esc(b.grade || '')}${b.cas_number ? ' · CAS ' + esc(b.cas_number) : ''} · disimpan di ${esc(locs.join(', ') || '—')}</div></div>
      ${s.low ? '<span class="bdg s-ex"><i class="bi bi-cart-plus"></i> Perlu pesan lagi</span>' : '<span class="bdg s-ok"><i class="bi bi-check-lg"></i> Stok cukup</span>'}</div>
    <div class="grid g3 mt12"><div class="stat c-blue" style="min-height:0;cursor:default"><span class="ss">Total stok</span><span class="sv" style="font-size:24px">${fmtQ(s.ef, u)}</span></div>
      <div class="stat c-teal" style="min-height:0;cursor:default"><span class="ss">Botol aktif</span><span class="sv" style="font-size:24px">${s.aktifN}</span></div>
      <div class="stat ${s.low ? 'c-orange' : 'c-green'}" style="min-height:0;cursor:default"><span class="ss">Pesan lagi bila tersisa</span><span class="sv" style="font-size:24px">${s.rop ? fmtQ(s.rop, u) : '—'}</span></div></div></div>
    <div class="panel-b row wrap"><button class="btn btn-p" data-act="ambilBahan" data-b="${esc(b.bahan_id)}"><i class="bi bi-eyedropper"></i> Ambil bahan ini</button>
      <button class="btn" data-act="terimaBahan" data-b="${esc(b.bahan_id)}"><i class="bi bi-box-arrow-in-down"></i> Terima stok baru</button>
      ${sds && sds.link ? `<button class="btn btn-g" style="border-color:var(--cobalt)" data-act="sdsView" data-id="${esc(sds.sds_id)}"><i class="bi bi-filetype-pdf"></i> Buka SDS</button>` : (b.butuh_sds === true || b.butuh_sds === 'true') ? `<button class="btn btn-d" data-act="sdsUpload" data-b="${esc(b.bahan_id)}"><i class="bi bi-upload"></i> Unggah SDS</button>` : ''}
      <button class="btn" data-act="bahanForm" data-id="${esc(b.bahan_id)}"><i class="bi bi-pencil"></i> Ubah data bahan</button>
      <button class="btn" data-act="labelPrint" data-ids="${esc(ws.filter(w => AKHIR.indexOf(w.status) < 0).map(w => w.wadah_id).join(','))}"><i class="bi bi-printer"></i> Cetak label</button></div>
    <details class="adv" style="margin:0 16px 16px"><summary><i class="bi bi-shield-exclamation"></i> Info keselamatan &amp; penyimpanan</summary><div class="row wrap top mt8">${nfpaDiamond(b.nfpa)}
      <div style="min-width:180px;flex:1"><div class="lbl">Tanda bahaya</div>
        ${String(b.kelas_bahaya || '').split(',').filter(Boolean).map(g => `<div class="row"><span class="ghs-ico"><span>${esc(g.trim().replace('GHS', ''))}</span></span><span class="${/GHS0[256]/.test(g) ? 'err-t b' : ''}">${esc(g.trim())}: ${esc(EN.ghs[g.trim()] || '')}</span></div>`).join('') || '<p class="muted">Tidak ada kelas bahaya (consumable).</p>'}
      </div>
      <div class="grid g3 flush" style="flex:2;min-width:280px;border:1px solid var(--rule)">
        <div class="p8"><div class="lbl">Nomor dokumen SDS</div><div class="mono b">${esc(sds ? sds.sds_id : '—')}</div><div class="t-sm muted">${esc(sds ? (I.supplier.get(sds.supplier_id) || {}).nama || 'SDS umum' : '')}</div></div>
        <div class="p8" style="border-left:1px solid var(--rule)"><div class="lbl">Masa berlaku SDS</div><div class="mono b">${sds ? dTxt(sds.tanggal_kedaluwarsa) : '—'}</div><div class="t-sm">${s.sdsSt === 'Aktif' ? '<span class="ok-t">Status: AKTIF</span>' : s.sdsSt === 'N/A' ? 'Tidak wajib' : `<span class="err-t">Status: ${esc(s.sdsSt.toUpperCase())}</span>`}</div></div>
        <div class="p8" style="border-left:1px solid var(--rule)"><div class="lbl">Suhu simpan / lokasi</div><div class="mono b">${esc(b.suhu_simpan || '—')}</div><div class="t-sm cob">${esc(locs[0] || '')}</div></div>
        <div class="p8" style="border-top:1px solid var(--rule)"><div class="lbl">Bentuk / satuan</div><div class="mono b">${esc(b.bentuk_fisik)} · ${esc(u)}</div></div>
        <div class="p8" style="border-left:1px solid var(--rule);border-top:1px solid var(--rule)"><div class="lbl">Masa pakai setelah dibuka</div><div class="mono b">${b.masa_pakai_setelah_dibuka_hari ? esc(b.masa_pakai_setelah_dibuka_hari) + ' hari' : '—'}</div></div>
        <div class="p8" style="border-left:1px solid var(--rule);border-top:1px solid var(--rule)"><div class="lbl">Riwayat SDS</div><div class="mono b">${sdsAll.length} revisi</div></div></div></div></details></div>

  <div class="panel frame mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-list-ol"></i> Botol-botol (urutan pakai)</span><span class="t-sm muted">Paling atas dipakai duluan</span></div>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Kode botol</th><th>Batch</th><th>Lokasi</th><th class="num">Sisa / isi awal</th><th>Dibuka</th><th>Kedaluwarsa</th><th>Status</th><th></th></tr></thead><tbody>
    ${ws.map(w => { const bt = I.batch.get(w.batch_id) || {}; const r = rank.get(w.wadah_id); const pct = num(w.qty_awal_dasar) ? num(w.qty_sisa_dasar) / num(w.qty_awal_dasar) * 100 : 0;
      return `<tr class="${w.status === 'Karantina' ? 'qrow' : dispStatus(w) === 'Kedaluwarsa' ? 'warn' : ''}"><td class="id"><a href="javascript:void(0)" data-act="wadah" data-id="${esc(w.wadah_id)}">${esc(w.wadah_id)}</a>${r ? `<span class="sub">${r === 1 ? '<span class="bdg s-ok">Pakai duluan</span>' : 'Urutan ' + r}</span>` : ''}${w.perlu_dicari ? '<span class="sub err-t">Perlu dicari (opname)</span>' : ''}</td>
        <td class="mono nowrap">${esc(bt.nomor_batch || '—')}<span class="sub">${esc(w.batch_id)}</span></td><td><span class="ell" style="display:block;max-width:170px" title="${esc(lokName(w.lokasi_id))}">${esc(lokName(w.lokasi_id))}</span></td>
        <td class="num"><b class="${w.status === 'Terbuka' ? 'err-t' : ''}">${fmtN(w.qty_sisa_dasar)}</b> / ${fmtQ(w.qty_awal_dasar, u)}${num(w.qty_cadangan_dasar) ? `<span class="sub">dicadangkan ${fmtN(w.qty_cadangan_dasar)}</span>` : ''}<div class="meter" style="margin:4px 0 0"><i class="${pct < 30 ? 'low' : ''}" style="width:${pct}%"></i></div></td>
        <td class="mono nowrap">${w.tgl_dibuka ? `<span class="cob">${dTxt(w.tgl_dibuka)}</span>` : '<span class="muted">masih tersegel</span>'}</td><td>${expCell(w)}</td><td>${stBadge(w)}</td>
        <td><span class="row">${usable(w) ? `<button class="btn btn-sm ${w.status === 'Terbuka' ? 'btn-p' : ''}" data-act="ambilWadah" data-id="${esc(w.wadah_id)}">${w.status === 'Terbuka' ? 'Ambil' : 'Buka segel'}</button>` : ''}<button class="ibtn" data-act="labelPrint" data-ids="${esc(w.wadah_id)}" title="Cetak label" aria-label="Cetak label"><i class="bi bi-printer"></i></button><button class="ibtn" data-act="wadah" data-id="${esc(w.wadah_id)}" title="Detail" aria-label="Detail"><i class="bi bi-box-arrow-up-right"></i></button></span></td></tr>`; }).join('') || `<tr><td colspan="8">${empty('Belum ada wadah untuk bahan ini.')}</td></tr>`}
    </tbody></table></div>${habisN ? `<button class="more" data-act="stokHabis">${App.ui.stok.showHabis ? 'Sembunyikan' : 'Tampilkan'} ${habisN} botol yang sudah habis/dibuang</button>` : ''}</div>

  <details class="panel mt12"><summary class="panel-h" style="cursor:pointer;list-style:none"><span class="ttl"><i class="bi bi-journal-text"></i> Riwayat keluar-masuk (${mut.length} terakhir)</span><i class="bi bi-chevron-down muted"></i></summary>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Kode</th><th>Waktu</th><th>Botol</th><th>Kegiatan</th><th class="num">Jumlah</th><th class="num">Sisa</th><th>Oleh</th><th>Catatan</th></tr></thead><tbody>
    ${mut.map(m => `<tr class="${m._opt ? 'amber' : ''}"><td class="id">${esc(m._opt ? 'menyinkronkan…' : String(m.mutasi_id).substr(0, 12))}</td><td class="mono nowrap">${esc(String(m.waktu).substr(0, 16))}</td><td class="id"><a class="mono" href="javascript:void(0)" data-act="wadah" data-id="${esc(m.wadah_id)}">${esc(m.wadah_id)}</a></td>
      <td><span class="bdg ${jenisCls[m.jenis] || 's-hb'}">${esc((JENIS_TXT[m.jenis] || [m.jenis])[0])}</span></td><td class="num ${num(m.qty_delta_dasar) < 0 ? 'err-t' : 'ok-t'}">${num(m.qty_delta_dasar) > 0 ? '+' : ''}${fmtQ(m.qty_delta_dasar, u)}</td><td class="num b">${fmtQ(m.sisa_sesudah, u)}</td>
      <td>${esc(userName(m.pengguna))}</td><td class="t-sm">${esc(m.alasan || '')}${m.ref_id ? `<span class="sub">Ref: ${esc(m.ref_id)}</span>` : ''}</td></tr>`).join('') || `<tr><td colspan="8">${empty('Belum ada mutasi terbaru untuk bahan ini (riwayat lengkap ada di detail wadah).')}</td></tr>`}
    </tbody></table></div></details>

  <details class="panel mt12" ${s.low ? 'open' : ''}><summary class="panel-h" style="cursor:pointer;list-style:none"><span class="ttl"><i class="bi bi-calculator"></i> Kapan harus pesan lagi?</span>${s.low ? `<span class="bdg s-ex">Kurang ${fmtQ(s.rop - s.ps, u)}</span>` : '<span class="bdg s-ok">Masih aman</span>'}</summary>
    <div class="panel-b"><div class="strip" style="border-color:var(--ink2)"><span class="bdg s-op">${b.reorder_mode === 'MANUAL' ? 'Diisi manual' : 'Dihitung otomatis dari pemakaian'}</span><span class="muted" style="margin-left:auto">${info ? `Tingkat layanan: ${info.sl}% (Z = ${info.Z}) · Lead time: ${fmtN(info.Lw * 7, 0)} hari` : 'Belum dihitung'}</span></div>
    ${info && b.reorder_mode !== 'MANUAL' && !info.cukup ? `<div class="note warn mt8"><i class="bi bi-exclamation-triangle"></i><div>Data belum cukup (min. 8 minggu sejak transaksi pertama &amp; 3 minggu ada pemakaian). Isi ROP manual.</div></div>` : ''}
    <div class="grid g6 flush mt8" style="border:1px solid var(--rule)">
      ${[['Pemakaian rata-rata', info ? fmtN(info.mu) : '—', u + ' / minggu'], ['Naik-turun pemakaian', info ? fmtN(info.sigma) : '—', u + ' variabilitas'], ['Lama pengiriman', info ? fmtN(info.Lw * 7, 0) : fmtN(b.lead_time_hari || setN('default_lead_time_days'), 0), 'hari'], ['Tingkat aman', info ? info.Z : '—', (info ? info.sl : '') + '% SL target'], ['Stok cadangan', s.ss ? fmtN(s.ss) : '—', u + ' cadangan'], ['Batas pesan ulang', s.rop ? fmtN(s.rop) : '—', u + ' batas kritis']].map((x, i) =>
        `<div class="p8" style="${i ? 'border-left:1px solid var(--rule);' : ''}${i === 4 ? 'background:var(--op-bg)' : i === 5 ? 'background:var(--ex-bg)' : ''}"><div class="lbl">${x[0]}</div><div class="h-lg mono ${i === 5 ? 'err-t' : ''}">${x[1]}</div><div class="t-sm muted">${esc(x[2])}</div></div>`).join('')}</div>
    <div class="row wrap between mt12"><span class="t-sm">Stok sekarang ${fmtQ(s.ef, u)} + sedang dipesan ${fmtQ(s.poOpen, u)} = <b>${fmtQ(s.ps, u)}</b>${s.q ? ` · Saran pesan <b class="cob">${fmtQ(s.q, u)}</b>${num(b.ukuran_kemasan_standar) ? ' (' + fmtN(s.q / num(b.ukuran_kemasan_standar), 0) + ' kemasan @' + fmtQ(b.ukuran_kemasan_standar, u) + ')' : ''}` : ''}</span>
      ${s.q ? `<button class="btn btn-c" data-act="poDraft" data-b="${esc(b.bahan_id)}"><i class="bi bi-cart-plus"></i> Buat pesanan sekarang</button>` : ''}</div></div></details>`;
}

function stokExp() {
  const U = App.ui.stok, I = App.idx;
  const tier = U.expTier;
  const rows = App.S.wadah.filter(w => { const st = dispStatus(w); if (tier === 'lewat') return st === 'Kedaluwarsa'; return AKTIF.indexOf(st) >= 0 && daysLeft(w) <= tier; })
    .sort((a, b) => String(a.tgl_kedaluwarsa_efektif).localeCompare(String(b.tgl_kedaluwarsa_efektif)));
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-hourglass-split"></i> Botol yang segera kedaluwarsa</span>
    <div class="chips">${[[90, '≤ 90 hari'], [30, '≤ 30 hari'], [7, '≤ 7 hari'], ['lewat', 'Sudah lewat']].map(t => `<button class="chip ${String(tier) === String(t[0]) ? 'on' : ''}" data-act="expTier" data-t="${t[0]}">${t[1]}</button>`).join('')}</div></div>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Wadah</th><th>Bahan</th><th>Batch</th><th>Lokasi</th><th class="num">Sisa</th><th>Exp efektif</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
    ${rows.map(w => { const b = I.bahan.get(w.bahan_id) || {}, bt = I.batch.get(w.batch_id) || {}; const st = dispStatus(w);
      return `<tr class="${st === 'Kedaluwarsa' ? 'warn' : daysLeft(w) <= 7 ? 'amber' : ''}"><td class="id"><a href="javascript:void(0)" data-act="wadah" data-id="${esc(w.wadah_id)}">${esc(w.wadah_id)}</a></td><td>${esc(b.nama_standar)}</td><td class="mono">${esc(bt.nomor_batch || '')}</td><td>${esc(lokName(w.lokasi_id))}</td>
        <td class="num">${fmtQ(w.qty_sisa_dasar, b.satuan_dasar)}</td><td>${expCell(w)}</td><td>${st === 'Kedaluwarsa' ? bdg('Kedaluwarsa') : daysLeft(w) <= 30 ? bdg('Segera kedaluwarsa', 'Segera') : stBadge(w)}</td>
        <td class="row">${st === 'Kedaluwarsa' ? `<button class="btn btn-sm btn-d" data-act="wAksi" data-a="BUANG" data-id="${esc(w.wadah_id)}">Buang</button><button class="btn btn-sm" data-act="wAksi" data-a="PERPANJANG" data-id="${esc(w.wadah_id)}">Perpanjang</button>` : `<button class="btn btn-sm btn-p" data-act="ambilWadah" data-id="${esc(w.wadah_id)}">Ambil (FEFO)</button>`}</td></tr>`; }).join('') || `<tr><td colspan="8">${empty('Tidak ada wadah pada tingkat ini.', 'bi-check2-square')}</td></tr>`}
    </tbody></table></div><div class="panel-f"><span class="t-sm muted">${rows.length} wadah · diurutkan menurut tanggal efektif</span><button class="btn btn-sm" data-act="expExport">Ekspor CSV</button></div></div>`;
}

function stokLow() {
  const I = App.idx;
  const rows = App.S.bahan.filter(b => b.status === 'Aktif').map(b => ({ b, s: I.stat.get(b.bahan_id) })).filter(x => x.s.low || x.s.manualNeeded)
    .sort((a, c) => (c.s.low ? 1 : 0) - (a.s.low ? 1 : 0));
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-cart-plus"></i> Stok menipis &amp; saran jumlah pesan</span><span class="idx">Q = MAX(0, ROP + μw×review − PS)</span></div>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Stok efektif</th><th class="num">PO terbuka</th><th class="num">Posisi stok</th><th class="num">ROP</th><th class="num">Safety stock</th><th class="num">Saran pesan</th><th>Mode</th><th>Aksi</th></tr></thead><tbody>
    ${rows.map(({ b, s }) => `<tr class="${s.low ? 'warn' : ''}"><td><a href="javascript:void(0)" data-act="stokOpen" data-id="${esc(b.bahan_id)}"><b>${esc(b.nama_standar)}</b></a><span class="sub">${esc(b.bahan_id)} · ${esc(b.cas_number || '')}</span></td>
      <td class="num">${fmtQ(s.ef, b.satuan_dasar)}</td><td class="num">${fmtQ(s.poOpen, b.satuan_dasar)}</td><td class="num b ${s.low ? 'err-t' : ''}">${fmtQ(s.ps, b.satuan_dasar)}</td><td class="num">${s.rop ? fmtQ(s.rop, b.satuan_dasar) : '—'}</td><td class="num">${s.ss ? fmtQ(s.ss, b.satuan_dasar) : '—'}</td>
      <td class="num b cob">${s.q ? fmtQ(s.q, b.satuan_dasar) : '—'}</td><td>${s.manualNeeded ? bdg('Data belum cukup — isi manual', 'Segera') : esc(b.reorder_mode)}</td>
      <td class="row">${s.q ? `<button class="btn btn-sm btn-c" data-act="poDraft" data-b="${esc(b.bahan_id)}">Draft PO</button>` : ''}<button class="btn btn-sm" data-act="bahanForm" data-id="${esc(b.bahan_id)}">Edit ROP</button></td></tr>`).join('') || `<tr><td colspan="9">${empty('Tidak ada bahan di bawah reorder point.', 'bi-check2-square')}</td></tr>`}
    </tbody></table></div><div class="panel-f"><span class="t-sm muted">Posisi stok = stok efektif (Tersedia/Terbuka) + PO terbuka yang belum diterima.</span><button class="btn btn-sm" data-act="lowExport">Ekspor CSV</button></div></div>`;
}

function stokKar() {
  const I = App.idx;
  const rows = App.S.wadah.filter(w => w.status === 'Karantina' || dispStatus(w) === 'Kedaluwarsa');
  const sdsWait = rows.filter(w => w.status === 'Karantina' && w.alasan_karantina === 'SDS menunggu' && w.kondisi_awal === 'Baik' && activeSds(w.bahan_id, (I.batch.get(w.batch_id) || {}).supplier_id));
  return `${sdsWait.length ? `<div class="note ok mb8"><i class="bi bi-shield-check"></i><div><b>${sdsWait.length} wadah</b> hanya menunggu SDS dan kini SDS-nya sudah aktif. <button class="btn btn-sm btn-p" data-act="verifMassal" data-ids="${esc(sdsWait.map(w => w.wadah_id).join(','))}">Verifikasi sekaligus</button></div></div>` : ''}
  <div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-sign-stop"></i> Botol ditahan &amp; kedaluwarsa</span><span class="idx">STATUS TERKUNCI DARI FEFO</span></div>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Wadah</th><th>Bahan</th><th>Status &amp; alasan</th><th>Lokasi</th><th class="num">Sisa</th><th>Exp efektif</th><th>Tindakan</th></tr></thead><tbody>
    ${rows.map(w => { const b = I.bahan.get(w.bahan_id) || {}; const st = dispStatus(w);
      return `<tr class="${w.status === 'Karantina' ? 'qrow' : 'warn'}"><td class="id"><a href="javascript:void(0)" data-act="wadah" data-id="${esc(w.wadah_id)}">${esc(w.wadah_id)}</a>${w.link_foto ? '<span class="sub"><i class="bi bi-image"></i> foto</span>' : ''}</td><td>${esc(b.nama_standar)}</td>
        <td>${bdg(st)}<span class="sub" style="font-family:inherit">${esc(w.alasan_karantina || (st === 'Kedaluwarsa' ? 'Lewat tanggal efektif' : ''))}</span></td><td>${esc(lokName(w.lokasi_id))}</td><td class="num">${fmtQ(w.qty_sisa_dasar, b.satuan_dasar)}</td><td>${expCell(w)}</td>
        <td><span class="row wrap">${w.status === 'Karantina' ? `<button class="btn btn-sm btn-p" data-act="wAksi" data-a="VERIFIKASI" data-id="${esc(w.wadah_id)}">Release</button><button class="btn btn-sm" data-act="wAksi" data-a="RETUR" data-id="${esc(w.wadah_id)}">Retur</button>` : `<button class="btn btn-sm" data-act="wAksi" data-a="PERPANJANG" data-id="${esc(w.wadah_id)}">Perpanjang</button>`}
          <button class="btn btn-sm btn-d" data-act="wAksi" data-a="BUANG" data-id="${esc(w.wadah_id)}">Buang</button></span></td></tr>`; }).join('') || `<tr><td colspan="7">${empty('Tidak ada wadah karantina atau kedaluwarsa.', 'bi-check2-square')}</td></tr>`}
    </tbody></table></div></div>`;
}

function stokArsip() {
  const r = App.ui.stok.arsipRows, I = App.idx;
  return `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-archive"></i> Arsip wadah (status akhir &gt; ${setN('archive_after_days') || 90} hari)</span><span class="idx">${App.S.arsip_count} WADAH</span></div>
    <div class="panel-b row"><input class="inp" id="arsipQ" placeholder="Cari ID wadah / bahan / batch" value="${esc(App.ui.stok.arsipQ || '')}"><button class="btn" data-act="arsipCari"><i class="bi bi-search"></i> Cari</button></div>
    <div class="tbl-wrap soft" style="border:0;border-top:1px solid var(--rule)"><table class="tbl"><thead><tr><th>Wadah</th><th>Bahan</th><th>Status</th><th>Tgl status akhir</th><th>Lokasi terakhir</th><th></th></tr></thead><tbody>
    ${!r ? `<tr><td colspan="6">${empty('Memuat arsip dari server…', 'bi-hourglass')}</td></tr>` : r.map(w => `<tr><td class="id">${esc(w.wadah_id)}</td><td>${esc(bahanName(w.bahan_id))}</td><td>${bdg(w.status)}</td><td class="mono">${dTxt(w.tgl_status_akhir)}</td><td>${esc(lokName(w.lokasi_id))}</td><td><button class="btn btn-sm" data-act="wadahRiwayat" data-id="${esc(w.wadah_id)}">Riwayat</button></td></tr>`).join('') || `<tr><td colspan="6">${empty('Tidak ada hasil.')}</td></tr>`}
    </tbody></table></div></div>`;
}

const stokRefreshList = debounce(() => {
  const list = stokFilterBahan(), U = App.ui.stok;
  if (list.length && !list.some(b => b.bahan_id === U.sel)) { U.sel = list[0].bahan_id; const d = $('#stokDetail'); if (d) d.innerHTML = stokDetailHtml(U.sel); }
  const l = $('#stokList'); if (l) l.innerHTML = stokListHtml(list);
}, 150);
IN.stokQ = el => { App.ui.stok.q = el.value; App.ui.stok.page = 1; stokRefreshList(); };
ACT.stokMode = el => { App.ui.stok.mode = el.dataset.m; if (el.dataset.m === 'arsip') App.ui.stok.arsipRows = null; render('stok'); };
ACT.stokChip = el => { App.ui.stok[el.dataset.g] = el.dataset.v; App.ui.stok.page = 1; render('stok'); };
CH.stokLok = el => { App.ui.stok.lok = el.value; render('stok'); };
ACT.stokSel = el => { App.ui.stok.sel = el.dataset.id; $$('#stokList .cat-item').forEach(x => x.classList.toggle('on', x.dataset.id === el.dataset.id)); $('#stokDetail').innerHTML = stokDetailHtml(el.dataset.id); if (window.innerWidth < 1000) $('#stokDetail').scrollIntoView({ behavior: 'smooth' }); };
ACT.stokOpen = el => { App.ui.stok.mode = 'katalog'; App.ui.stok.sel = el.dataset.id; App.ui.stok.q = ''; go('stok'); };
ACT.stokHabis = () => { App.ui.stok.showHabis = !App.ui.stok.showHabis; $('#stokDetail').innerHTML = stokDetailHtml(App.ui.stok.sel); };
ACT.stokMore = () => { App.ui.stok.page++; stokRefreshList(); };
ACT.expTier = el => { App.ui.stok.expTier = el.dataset.t === 'lewat' ? 'lewat' : +el.dataset.t; render('stok'); };
ACT.terimaBahan = el => { App.rcv = rcvNew(); App.rcv.mode = 'TANPA'; App.rcv.bahan_id = el.dataset.b; const po = App.S.po_item.find(i => i.bahan_id === el.dataset.b && (i.status_item === 'Terbuka' || i.status_item === 'Sebagian')); if (po) { App.rcv.mode = 'PO'; App.rcv.po_no = po.po_no; App.rcv.po_item_id = po.po_item_id; App.rcv.satuan = po.satuan_pesan; } go('terima'); };
ACT.arsipCari = async () => { const q = $('#arsipQ') ? $('#arsipQ').value : ''; App.ui.stok.arsipQ = q; try { App.ui.stok.arsipRows = await rpc('getArsip', { q }); } catch (e) { App.ui.stok.arsipRows = []; showErr(e); } if (App.view === 'stok' && App.ui.stok.mode === 'arsip') render('stok'); };
ACT.verifMassal = async el => { await act('verifikasiMassal', { wadah_ids: el.dataset.ids.split(',') }, { btn: el, ok: d => `${d.diverifikasi} wadah diverifikasi & dirilis.` }).catch(() => { }); };
ACT.stokExport = () => {
  const I = App.idx, rows = [];
  stokFilterBahan().forEach(b => (I.wByB.get(b.bahan_id) || []).forEach(w => rows.push({ w, b, bt: I.batch.get(w.batch_id) || {} })));
  exportRows('stok_wadah', rows, [{ t: 'wadah_id', f: r => r.w.wadah_id }, { t: 'bahan_id', f: r => r.b.bahan_id }, { t: 'nama', f: r => r.b.nama_standar }, { t: 'cas', f: r => r.b.cas_number }, { t: 'batch', f: r => r.bt.nomor_batch },
    { t: 'lokasi', f: r => lokName(r.w.lokasi_id) }, { t: 'status', f: r => dispStatus(r.w) }, { t: 'sisa', f: r => r.w.qty_sisa_dasar }, { t: 'awal', f: r => r.w.qty_awal_dasar }, { t: 'satuan', f: r => r.b.satuan_dasar }, { t: 'exp_efektif', f: r => r.w.tgl_kedaluwarsa_efektif }]);
};
ACT.expExport = () => { const I = App.idx; const t = App.ui.stok.expTier; exportRows('kedaluwarsa', App.S.wadah.filter(w => t === 'lewat' ? dispStatus(w) === 'Kedaluwarsa' : AKTIF.indexOf(dispStatus(w)) >= 0 && daysLeft(w) <= t), [{ k: 'wadah_id' }, { t: 'bahan', f: w => bahanName(w.bahan_id) }, { t: 'lokasi', f: w => lokName(w.lokasi_id) }, { k: 'qty_sisa_dasar' }, { k: 'tgl_kedaluwarsa_efektif' }, { t: 'status', f: dispStatus }]); };
ACT.lowExport = () => { const I = App.idx; exportRows('stok_rendah', App.S.bahan.filter(b => b.status === 'Aktif' && I.stat.get(b.bahan_id).low), [{ k: 'bahan_id' }, { k: 'nama_standar' }, { k: 'satuan_dasar' }, { t: 'stok_efektif', f: b => I.stat.get(b.bahan_id).ef }, { t: 'posisi_stok', f: b => I.stat.get(b.bahan_id).ps }, { k: 'reorder_point' }, { k: 'safety_stock' }, { t: 'saran_pesan', f: b => I.stat.get(b.bahan_id).q }]); };
ACT.stokPrint = () => {
  const I = App.idx;
  const rows = stokFilterBahan().map(b => (I.wByB.get(b.bahan_id) || []).filter(w => AKHIR.indexOf(w.status) < 0).map(w => `<tr><td>${esc(w.wadah_id)}</td><td>${esc(b.nama_standar)}</td><td>${esc((I.batch.get(w.batch_id) || {}).nomor_batch || '')}</td><td>${esc(lokName(w.lokasi_id))}</td><td style="text-align:right">${fmtQ(w.qty_sisa_dasar, b.satuan_dasar)}</td><td style="width:90px;border-bottom:1px solid #000"></td><td>${esc(dispStatus(w))}</td></tr>`).join('')).join('');
  printHtml(`<h3 style="font-family:Space Grotesk">Lembar stok fisik — ${esc(App.S.settings.lab_name || '')} — ${today()}</h3><table style="width:100%;border-collapse:collapse;font:10px JetBrains Mono" border="1" cellpadding="4"><thead><tr><th>Wadah</th><th>Bahan</th><th>Batch</th><th>Lokasi</th><th>Sisa sistem</th><th>Fisik</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
};

// ════════════════════════════════════════════════════════
// BAGIAN 10: DETAIL WADAH (drawer) & AKSI WADAH
// ════════════════════════════════════════════════════════

function labelData(w) {
  const I = App.idx, b = I.bahan.get(w.bahan_id) || {}, bt = I.batch.get(w.batch_id) || {};
  return { wadah_id: w.wadah_id, bahan: b.nama_standar, cas: b.cas_number, qty: fmtQ(w.qty_awal_dasar, b.satuan_dasar), batch: bt.nomor_batch, exp: dTxt(w.tgl_kedaluwarsa_efektif), lokasi: lokName(w.lokasi_id), ghs: b.kelas_bahaya, nfpa: b.nfpa, karantina: w.status === 'Karantina' };
}
/** Kartu label botol (teks). */
function labelHtml(d) {
  return `<div class="lbl-card ${d.karantina ? 'qh' : ''}"><div class="lbl-hd"><span>CHEM•INV ${d.karantina ? '<span style="color:#B42318">QA-HOLD</span>' : 'LAB-OS'}</span><span>ID: ${esc(d.wadah_id)}</span></div>
    <div><div class="ln">${esc(d.bahan || '')}</div><div class="lm">CAS: <b>${esc(d.cas || '—')}</b> | Vol: ${esc(d.qty || '')}</div><div class="lm">Batch: <b>${esc(d.batch || '')}</b></div>
      <div class="lm" style="color:#B42318;font-weight:700">EXP: ${esc(d.exp || '')}</div><div class="lm" style="color:#1E5AA8">LOK: ${esc(d.lokasi || '')}</div>
      <div class="lm">${String(d.ghs || '').split(',').filter(Boolean).map(g => `<span style="display:inline-block;border:1px solid #B42318;color:#B42318;padding:0 2px;margin:1px">${esc(g.trim())}</span>`).join('')} ${d.nfpa ? 'NFPA ' + esc(d.nfpa) : ''}</div>
      ${d.karantina ? '<div class="lm hatch" style="color:#4C3490;font-weight:700;border:1px solid #C7B5EC;margin-top:2px;padding:1px 3px">DILARANG DIGUNAKAN DI BENCH</div>' : ''}</div></div>`;
}

function printHtml(html, labelSize) {
  const pa = $('#printArea');
  pa.innerHTML = html;
  if (labelSize) { const m = String(labelSize).match(/(\d+)\s*x\s*(\d+)/i); if (m) { pa.style.setProperty('--lw', m[1] + 'mm'); pa.style.setProperty('--lh', m[2] + 'mm'); } }
  document.body.classList.add('printing');
  setTimeout(() => { try { window.print(); } catch (e) { toast('Cetak tidak diizinkan di bingkai ini. Gunakan "PDF".', 'warn'); } setTimeout(() => { document.body.classList.remove('printing'); pa.innerHTML = ''; }, 500); }, 60);
}
ACT.labelPrint = el => {
  const ids = String(el.dataset.ids || '').split(',').filter(Boolean); if (!ids.length) { toast('Tidak ada wadah untuk dicetak.', 'warn'); return; }
  const ws = ids.map(id => App.idx.wadah.get(id)).filter(Boolean);
  const box = document.createElement('div'); box.innerHTML = `<div class="lbl-sheet">${ws.map(w => labelHtml(labelData(w))).join('')}</div>`;
  printHtml(box.innerHTML, App.S.settings.label_size);
  rpc('catatCetakLabel', { wadah_ids: ids, ulang: true }).catch(() => { });
};
ACT.labelPdf = async el => {
  const ids = String(el.dataset.ids || '').split(',').filter(Boolean);
  const ws = ids.map(id => App.idx.wadah.get(id)).filter(Boolean);
  const m = String(App.S.settings.label_size || '50x30').match(/(\d+)\s*x\s*(\d+)/) || [0, 50, 30];
  const cards = ws.map(w => { const d = labelData(w);
    return `<div style="width:${m[1]}mm;height:${m[2]}mm;border:1px solid #000;display:inline-block;margin:2mm;overflow:hidden;font-family:Arial;vertical-align:top;page-break-inside:avoid"><table style="width:100%;border-collapse:collapse"><tr><td colspan="2" style="font:bold 6pt monospace;border-bottom:1px solid #000">CHEM-INV &nbsp; ${esc(d.wadah_id)}${d.karantina ? ' &nbsp; QA-HOLD' : ''}</td></tr><tr><td colspan="2" style="font-size:6.5pt;vertical-align:top;padding:1mm"><b style="font-size:8.5pt">${esc(d.bahan)}</b><br>CAS ${esc(d.cas || '-')}<br>Batch ${esc(d.batch || '')}<br><b style="color:#B42318">EXP ${esc(d.exp)}</b><br>${esc(d.lokasi)}<br>${esc(d.ghs || '')}</td></tr></table></div>`; }).join('');
  try {
    const r = await act('buatLabelPdf', { html: `<html><body style="margin:0">${cards}</body></html>`, wadah_ids: ids }, { btn: el, busy: 'Membuat PDF…' });
    modal({ title: 'Label PDF', wide: true, body: `<iframe src="${esc(r.preview)}" style="width:100%;height:70vh;border:1px solid var(--rule)" title="Pratinjau label PDF"></iframe>`, foot: `<button class="btn" data-act="mclose"><i class="bi bi-x-lg"></i> Tutup</button><a class="btn btn-p" href="${esc(r.url)}" target="_blank" rel="noopener"><i class="bi bi-download"></i> Unduh / buka di Drive</a>` });
  } catch (e) { }
};

ACT.wadah = el => openWadah(el.dataset.id);
ACT.wadahRiwayat = el => openWadah(el.dataset.id, true);
function openWadah(id, arsip) {
  const I = App.idx; let w = I.wadah.get(id);
  const h = modal({ title: 'Wadah ' + id, drawer: true, wide: true, body: w ? wadahBody(w) : empty('Memuat…', 'bi-hourglass') });
  rpc('getRiwayatWadah', { wadah_id: id }).then(r => {
    if (!h.el.isConnected) return;
    if (!w && r.wadah) { w = r.wadah; h.body.innerHTML = wadahBody(w, true); }
    const box = $('#wRiwayat', h.body); if (box) box.innerHTML = riwayatHtml(w, r);
  }).catch(e => { const box = $('#wRiwayat', h.body); if (box) box.innerHTML = `<div class="note err"><i class="bi bi-x-octagon"></i><div>${esc(e.message)}</div></div>`; });
}
function wadahBody(w, ro) {
  const I = App.idx, b = I.bahan.get(w.bahan_id) || {}, bt = I.batch.get(w.batch_id) || {}, sp = I.supplier.get(bt.supplier_id) || {}, u = b.satuan_dasar;
  const st = dispStatus(w); const final = AKHIR.indexOf(w.status) >= 0;
  const kv = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const btn = (a, label, cls) => `<button class="btn btn-sm ${cls || ''}" data-act="wAksi" data-a="${a}" data-id="${esc(w.wadah_id)}">${label}</button>`;
  return `<div class="row between wrap"><div><div class="h-lg mono">${esc(w.wadah_id)}</div><div>${esc(b.nama_standar)} · <span class="mono muted">${esc(b.cas_number || '')}</span></div></div>${bdg(st)}</div>
    ${w.alasan_karantina ? `<div class="note q mt8"><i class="bi bi-sign-stop"></i><div>${esc(w.alasan_karantina)}</div></div>` : ''}
    <div class="grid g-half mt12"><div class="kv">${kv('Sisa / awal', `${fmtN(w.qty_sisa_dasar)} / ${fmtQ(w.qty_awal_dasar, u)}`)}${kv('Dicadangkan', fmtQ(w.qty_cadangan_dasar || 0, u))}${kv('Batch', esc(bt.nomor_batch || '') + ' <span class="muted">(' + esc(w.batch_id) + ')</span>')}${kv('Supplier', esc(sp.nama || '—'))}
      ${kv('Lokasi', esc(lokName(w.lokasi_id)))}${kv('Kondisi awal', esc(w.kondisi_awal))}${kv('Tgl terima', dTxt(w.tgl_terima))}${kv('Tgl dibuka', dTxt(w.tgl_dibuka))}${kv('Exp batch', dTxt(bt.tgl_kedaluwarsa))}${kv('Exp efektif', dTxt(w.tgl_kedaluwarsa_efektif) + (w.tgl_perpanjangan ? ' <span class="cob">(re-test)</span>' : ''))}
      ${kv('SDS', esc(w.sds_id || '—'))}${kv('Sumber', esc(w.sumber || ''))}${kv('Penerimaan', esc(w.terima_id || '—'))}${w.link_foto ? kv('Foto', `<a href="javascript:void(0)" data-act="fotoView" data-u="${esc(w.link_foto)}">Lihat foto</a>`) : ''}</div>
      <div>${labelHtml(labelData(w))}</div></div>
    ${ro || final ? '' : `<div class="row wrap mt12">${usable(w) ? `<button class="btn btn-sm btn-p" data-act="ambilWadah" data-id="${esc(w.wadah_id)}">Ambil</button>` : ''}${btn('PINDAH', '<i class="bi bi-arrows-move"></i> Pindah lokasi')}${btn('KOREKSI', '<i class="bi bi-pencil-square"></i> Koreksi sisa')}
      ${AKTIF.indexOf(w.status) >= 0 ? btn('KARANTINA', '<i class="bi bi-sign-stop"></i> Karantina') : ''}${w.status === 'Karantina' ? btn('VERIFIKASI', 'Verifikasi / release', 'btn-p') + btn('RETUR', 'Retur') : ''}
      ${['Kedaluwarsa', 'Tersedia', 'Terbuka'].indexOf(w.status) >= 0 && setB('allow_expiry_extension') ? btn('PERPANJANG', '<i class="bi bi-calendar-plus"></i> Perpanjang (re-test)') : ''}
      ${['Karantina', 'Kedaluwarsa', 'Tersedia', 'Terbuka'].indexOf(w.status) >= 0 ? btn('BUANG', '<i class="bi bi-trash3"></i> Buang', 'btn-d') : ''}
      <button class="btn btn-sm" data-act="labelPrint" data-ids="${esc(w.wadah_id)}"><i class="bi bi-printer"></i> Cetak ulang label</button></div>`}
    <div class="panel mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-clock-history"></i> Riwayat lengkap</span></div><div class="panel-b" id="wRiwayat">${empty('Memuat riwayat dari server…', 'bi-hourglass')}</div></div>`;
}
function riwayatHtml(w, r) {
  const u = (App.idx.bahan.get(w.bahan_id) || {}).satuan_dasar;
  const amb = {}; (r.pengambilan || []).forEach(p => amb[p.ambil_id] = p);
  if (!r.mutasi.length) return empty('Belum ada mutasi.');
  return `<div class="timeline">${r.mutasi.slice().reverse().map(m => { const p = amb[m.ref_id]; const canRev = m.jenis === 'AMBIL' && p && p.status === 'Disetujui' && !p.dibalik_oleh;
    return `<div class="tl"><div class="row between wrap"><span class="bdg ${m.jenis === 'AMBIL' ? 's-ex' : m.jenis === 'TERIMA' ? 's-ok' : 's-hb'}">${esc(m.jenis)}</span><span class="mono t-sm muted">${esc(m.waktu)}</span></div>
      <div class="mt8"><b class="mono ${num(m.qty_delta_dasar) < 0 ? 'err-t' : 'ok-t'}">${num(m.qty_delta_dasar) > 0 ? '+' : ''}${fmtQ(m.qty_delta_dasar, u)}</b> → sisa ${fmtQ(m.sisa_sesudah, u)} · ${esc(m.status_sebelum || '∅')} → ${esc(m.status_sesudah)}${m.lokasi_sebelum && m.lokasi_sebelum !== m.lokasi_sesudah ? ` · ${esc(lokName(m.lokasi_sebelum))} → ${esc(lokName(m.lokasi_sesudah))}` : ''}</div>
      <div class="t-sm muted">${esc(userName(m.pengguna))} · ${esc(m.alasan || '')} ${m.ref_id ? '· Ref ' + esc(m.ref_id) : ''}${p ? ` · ${esc(p.tujuan)}${p.referensi ? ' (' + esc(p.referensi) + ')' : ''}${p.self_approved === true || p.self_approved === 'true' ? ' · <span class="err-t">self-approved</span>' : ''}${p.override_fefo === true || p.override_fefo === 'true' ? ' · <span class="err-t">override FEFO: ' + esc(p.alasan_override) + '</span>' : ''}${p.dibalik_oleh ? ' · <b>DIBALIK</b>' : ''}` : ''}</div>
      ${canRev ? `<button class="btn btn-sm mt8" data-act="wBalik" data-id="${esc(p.ambil_id)}"><i class="bi bi-arrow-counterclockwise"></i> Balik transaksi ini</button>` : ''}</div>`; }).join('')}</div>`;
}
ACT.fotoView = el => modal({ title: 'Foto kondisi', wide: true, body: `<iframe src="${esc(String(el.dataset.u).replace(/\/view.*$/, '/preview'))}" style="width:100%;height:65vh;border:1px solid var(--rule)" title="Foto"></iframe>`, foot: `<button class="btn" data-act="mclose">Tutup</button><a class="btn btn-p" href="${esc(el.dataset.u)}" target="_blank" rel="noopener">Buka di Drive</a>` });

/** Form modal generik untuk aksi wadah. */
function formModal(o) {
  const fld = f => {
    if (f.type === 'html') return f.html;
    const req = f.required ? ' <span class="req">*</span>' : '';
    let inp;
    if (f.type === 'select') inp = `<select class="sel" name="${f.name}">${opts(f.options, f.value, f.ph === undefined ? 'Pilih…' : f.ph)}</select>`;
    else if (f.type === 'textarea') inp = `<textarea class="ta" name="${f.name}" placeholder="${esc(f.ph || '')}">${esc(f.value || '')}</textarea>`;
    else if (f.type === 'check') return `<label class="chk"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`;
    else if (f.type === 'file') inp = `<input class="inp" type="file" name="${f.name}" accept="${esc(f.accept || '')}" ${f.capture ? 'capture="environment"' : ''} style="padding:4px">`;
    else inp = `<input class="inp ${f.mono ? 'mono' : ''}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value === undefined ? '' : f.value)}" ${f.min !== undefined ? 'min="' + f.min + '"' : ''} ${f.max !== undefined ? 'max="' + f.max + '"' : ''} ${f.step ? 'step="' + f.step + '"' : ''} placeholder="${esc(f.ph || '')}" ${f.inputmode ? 'inputmode="' + f.inputmode + '"' : ''}>`;
    return `<div class="field ${f.full ? '' : ''}"><label>${esc(f.label)}${req}</label>${inp}${f.help ? `<span class="help">${f.help}</span>` : ''}</div>`;
  };
  const h = modal({
    title: o.title, wide: o.wide, body: `${o.intro || ''}<form class="fgrid ${o.cols ? 'c' + o.cols : ''}" novalidate>${o.fields.map(fld).join('')}</form>`,
    foot: `<button type="button" class="btn" data-act="mclose">Batal</button><button type="button" class="btn ${o.danger ? 'btn-d' : 'btn-p'}" data-ok="1">${o.submit || 'Simpan'}</button>`
  });
  const form = $('form', h.body);
  const go = async () => {
    const v = formVals(form);
    const miss = o.fields.filter(f => f.required && f.type !== 'file' && f.type !== 'html' && !v[f.name]);
    $$('.ferr', form).forEach(x => x.remove()); $$('.bad', form).forEach(x => x.classList.remove('bad'));
    if (miss.length) { miss.forEach(f => { const e = form.querySelector(`[name="${f.name}"]`); if (e) { e.classList.add('bad'); e.insertAdjacentHTML('afterend', '<div class="ferr">Wajib diisi.</div>'); } }); return; }
    const btn = h.el.querySelector('[data-ok]');
    try { await o.onSubmit(v, btn, form, h); } catch (e) { if (e && e.message) showErr(e, form); }
  };
  h.el.querySelector('[data-ok]').onclick = go;
  form.addEventListener('submit', e => { e.preventDefault(); go(); });
  if (o.onMount) o.onMount(h, form);
  return h;
}
async function fileB64(input) {
  const f = input && input.files && input.files[0]; if (!f) return null;
  if (/^image\//.test(f.type)) { const c = await compressImage(f); return { b64: c.b64, mime: c.mime, name: c.name }; }
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ b64: String(r.result).split(',')[1], mime: f.type, name: f.name, size: f.size }); r.onerror = () => rej(new Error('Gagal membaca berkas.')); r.readAsDataURL(f); });
}

ACT.wAksi = el => {
  const id = el.dataset.id, a = el.dataset.a, w = App.idx.wadah.get(id), b = App.idx.bahan.get(w.bahan_id) || {}, u = b.satuan_dasar;
  const closeAll = () => App.modals.slice().forEach(m => m.close());
  const run = async (action, payload, btn, h, ok) => { await act(action, payload, { btn, ok, form: $('form', h.body) }); closeAll(); };
  const intro = `<div class="note mb8"><i class="bi bi-box"></i><div><b class="mono">${esc(id)}</b> · ${esc(b.nama_standar)} · sisa ${fmtQ(w.qty_sisa_dasar, u)} · ${esc(dispStatus(w))}</div></div>`;
  if (a === 'PINDAH') formModal({ title: 'Pindah lokasi', intro, fields: [{ name: 'lokasi_id', label: 'Lokasi tujuan', type: 'select', required: true, options: App.S.lokasi.filter(l => l.status === 'Aktif' && l.lokasi_id !== w.lokasi_id).map(l => ({ v: l.lokasi_id, t: l.nama })) }, { name: 'alasan', label: 'Alasan', ph: 'Pemindahan lokasi' }],
    onSubmit: (v, btn, f, h) => run('pindahLokasi', { request_id: uid(), wadah_ids: [id], lokasi_id: v.lokasi_id, alasan: v.alasan }, btn, h, 'Lokasi dipindah.') });
  if (a === 'KOREKSI') formModal({ title: 'Koreksi sisa', intro, fields: [{ name: 'sisa_baru', label: `Sisa baru (${u})`, type: 'number', step: 'any', min: 0, required: true, mono: true, value: w.qty_sisa_dasar }, { name: 'alasan', label: 'Alasan', type: 'textarea', required: true }, { name: 'isi_awal_salah', label: 'Isi awal salah (izinkan melebihi isi awal & perbarui isi awal)', type: 'check' }],
    onSubmit: (v, btn, f, h) => run('koreksiSisa', { wadah_id: id, sisa_baru: num(v.sisa_baru), alasan: v.alasan, isi_awal_salah: v.isi_awal_salah }, btn, h, 'Sisa dikoreksi (KOREKSI_SISA).') });
  if (a === 'KARANTINA') formModal({ title: 'Karantina — temuan kerusakan (K-09)', intro, fields: [{ name: 'kondisi', label: 'Temuan', type: 'select', required: true, options: EN.kondisi.filter(k => k !== 'Baik') }, { name: 'alasan', label: 'Uraian temuan', type: 'textarea', required: true }, { name: 'foto', label: 'Foto temuan', type: 'file', accept: 'image/*', capture: true, required: true }, { name: 'catatan_keselamatan', label: 'Catatan tindakan keselamatan (wajib bila bocor)', type: 'textarea' }],
    onSubmit: async (v, btn, f, h) => { const foto = await fileB64($('[name=foto]', f)); if (!foto) { toast('Foto wajib dilampirkan.', 'err'); return; } await run('ubahStatusWadah', { wadah_id: id, aksi: 'KARANTINA', kondisi: v.kondisi, alasan: v.alasan, catatan_keselamatan: v.catatan_keselamatan, foto }, btn, h, 'Wadah dikarantina.'); } });
  if (a === 'VERIFIKASI') formModal({ title: 'Verifikasi & release karantina', intro, fields: [{ name: 'alasan', label: 'Hasil pemeriksaan ulang', type: 'textarea', required: true, ph: 'Kondisi diperiksa ulang: baik; SDS aktif tersedia' }], submit: 'Release ke Tersedia',
    onSubmit: (v, btn, f, h) => run('ubahStatusWadah', { wadah_id: id, aksi: 'VERIFIKASI', alasan: v.alasan }, btn, h, 'Verifikasi lulus — wadah dirilis.') });
  if (a === 'RETUR') formModal({ title: 'Retur ke supplier (K-10)', intro, fields: [{ name: 'no_dok_retur', label: 'No. dokumen retur', required: true, mono: true }, { name: 'alasan', label: 'Alasan retur', type: 'textarea', required: true }], danger: true, submit: 'Proses retur',
    onSubmit: (v, btn, f, h) => run('ubahStatusWadah', { wadah_id: id, aksi: 'RETUR', no_dok_retur: v.no_dok_retur, alasan: v.alasan }, btn, h, 'Retur dicatat.') });
  if (a === 'BUANG') formModal({ title: 'Pembuangan', intro, fields: [{ name: 'alasan', label: 'Alasan pembuangan', type: 'select', required: true, options: ['Kedaluwarsa', 'Rusak / terkontaminasi', 'Tidak layak pakai', 'Lainnya'] }, { name: 'metode_buang', label: 'Metode pembuangan sesuai prosedur lab', type: 'textarea', required: true, ph: 'Mis. diserahkan ke TPS limbah B3, manifest no. …' }], danger: true, submit: 'Buang & catat DISPOSAL',
    onSubmit: (v, btn, f, h) => run('ubahStatusWadah', { wadah_id: id, aksi: 'BUANG', alasan: v.alasan, metode_buang: v.metode_buang }, btn, h, 'Pembuangan dicatat.') });
  if (a === 'PERPANJANG') formModal({ title: 'Perpanjangan kedaluwarsa (re-test)', intro, fields: [{ name: 'tgl_baru', label: 'Tanggal kedaluwarsa baru', type: 'date', min: addDays(today(), 1), required: true }, { name: 'alasan', label: 'Hasil re-test / dasar perpanjangan', type: 'textarea', required: true }, { name: 'semua_batch', label: 'Terapkan ke semua wadah dalam batch ini', type: 'check' }],
    onSubmit: (v, btn, f, h) => run('perpanjangExpiry', { wadah_id: id, tgl_baru: v.tgl_baru, alasan: v.alasan, semua_batch: v.semua_batch }, btn, h, 'Kedaluwarsa diperpanjang.') });
};
ACT.wBalik = async el => {
  const alasan = await ask({ title: 'Balik transaksi pengambilan', msg: 'Sisa wadah dipulihkan sebesar jumlah yang diambil. Baris asli tidak dihapus (REVERSAL).', tone: 'warn', ok: 'Balik transaksi', input: { label: 'Alasan pembalikan', required: true, area: true } });
  if (!alasan) return;
  await act('balikPengambilan', { ambil_id: el.dataset.id, alasan }, { ok: 'Transaksi dibalik.' }).then(() => App.modals.slice().forEach(m => m.close())).catch(() => { });
};

// ════════════════════════════════════════════════════════
// BAGIAN 11: STOK OPNAME [W-08]
// ════════════════════════════════════════════════════════

function opScope(o) {
  const S = App.S, I = App.idx;
  const live = ['Tersedia', 'Terbuka', 'Karantina', 'Kedaluwarsa'];
  if (o.jenis === 'Penuh') return S.wadah.filter(w => live.indexOf(w.status) >= 0);
  const ids = new Set(String(o.wadah_ids || '').split(',').filter(Boolean));
  if (o.jenis === 'Siklik') S.wadah.filter(w => w.lokasi_id === o.lokasi_id && live.indexOf(w.status) >= 0).forEach(w => ids.add(w.wadah_id));
  return Array.from(ids).map(id => I.wadah.get(id)).filter(Boolean);
}
function opHasil(w, fisik, kondisi) {
  const sistem = num(w.qty_sisa_dasar), awal = num(w.qty_awal_dasar) || 1, tol = setN('opname_tolerance_open_pct') || 5;
  const sealed = w.status === 'Tersedia' && !w.tgl_dibuka;
  if (sealed) { if ((kondisi || 'Baik') === 'Baik' && (fisik === null || Math.abs(fisik - sistem) <= TOL)) return 'Cocok'; return 'Di atas toleransi'; }
  if (fisik === null) return '';
  const diff = fisik - sistem, pct = Math.abs(diff) / awal * 100;
  if (Math.abs(diff) <= TOL) return 'Cocok'; if (pct <= tol + 1e-9) return 'Dalam toleransi'; return 'Di atas toleransi';
}

RENDER.opname = el => {
  const S = App.S, U = App.ui.opname;
  const o = U.sel ? S.opname.find(x => x.opname_id === U.sel) : null;
  if (o && o.status === 'Berjalan') return renderOpSession(el, o);
  U.sel = null;
  const berjalan = S.opname.filter(x => x.status === 'Berjalan');
  const riwayat = S.opname.filter(x => x.status !== 'Berjalan').slice().reverse().slice(0, 30);
  const due = opnameDue();
  const cari = S.wadah.filter(w => w.perlu_dicari === true || w.perlu_dicari === 'true');
  const f = U.form || { jenis: 'Siklik', lokasi_id: (due[0] && due[0].l.lokasi_id) || '', wadah_ids: cari.map(w => w.wadah_id).join(', '), catatan: '' };
  U.form = f;
  el.innerHTML = `<div class="grid g-main"><div>
    <div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-play-circle"></i> Mulai cek stok fisik</span><span class="idx">US-13 / 5.6</span></div><div class="panel-b">
      <div class="grid g3">${[['Siklik', 'Per lokasi / rak', 'bi-arrow-repeat'], ['Penuh', 'Semua lokasi', 'bi-buildings'], ['Spot', 'Wadah tertentu', 'bi-bullseye']].map(j => `<div class="optbox ${f.jenis === j[0] ? 'on' : ''}" data-act="opJenis" data-j="${j[0]}" role="radio" aria-checked="${f.jenis === j[0]}" tabindex="0"><i class="bi ${j[2]}"></i><div><b>${j[0]}</b><div class="t-sm muted">${j[1]}</div></div></div>`).join('')}</div>
      <div class="fgrid c2 mt12">${f.jenis === 'Siklik' ? `<div class="field"><label>Lokasi <span class="req">*</span></label><select class="sel" data-ch="opForm" name="lokasi_id">${opts(S.lokasi.filter(l => l.status === 'Aktif').map(l => ({ v: l.lokasi_id, t: l.nama + ' (' + S.wadah.filter(w => w.lokasi_id === l.lokasi_id && AKHIR.indexOf(w.status) < 0).length + ' wadah)' })), f.lokasi_id, 'Pilih lokasi…')}</select></div>` : ''}
        ${f.jenis === 'Spot' ? `<div class="field"><label>ID wadah (pisahkan koma) <span class="req">*</span></label><textarea class="ta mono" data-in="opForm" name="wadah_ids">${esc(f.wadah_ids)}</textarea>${cari.length ? `<span class="help">${cari.length} wadah ditandai "perlu dicari" dari opname sebelumnya sudah dimasukkan.</span>` : ''}</div>` : ''}
        <div class="field"><label>Catatan</label><input class="inp" data-in="opForm" name="catatan" value="${esc(f.catatan)}"></div></div>
      <button class="btn btn-p btn-lg mt12" data-act="opStart"><i class="bi bi-play-fill"></i> Mulai sesi ${esc(f.jenis.toLowerCase())}</button>
      <p class="help mt8">Penerimaan &amp; pengambilan tetap boleh berjalan selama sesi. Penyesuaian stok diterapkan sebagai delta saat sesi ditutup.</p></div></div>
    <div class="panel frame mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-clock-history"></i> Riwayat sesi</span></div>
      <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Sesi</th><th>Jenis</th><th>Lokasi</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Ringkasan</th></tr></thead><tbody>
      ${riwayat.map(x => { let r = {}; try { r = JSON.parse(x.ringkasan || '{}'); } catch (e) { }
        return `<tr><td class="id">${esc(x.opname_id)}</td><td>${esc(x.jenis)}</td><td>${esc(x.lokasi_id ? lokName(x.lokasi_id) : x.jenis === 'Penuh' ? 'Semua' : 'Spot')}</td><td class="mono">${esc(String(x.tanggal_mulai).substr(0, 16))}</td><td class="mono">${esc(String(x.tanggal_selesai || '').substr(0, 16))}</td><td>${bdg(x.status)}</td><td class="t-sm">${Object.keys(r).map(k => esc(k) + ': ' + r[k]).join(' · ')}</td></tr>`; }).join('') || `<tr><td colspan="7">${empty('Belum ada riwayat opname.')}</td></tr>`}</tbody></table></div></div></div>
    <div><div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-play-fill"></i> Sesi berjalan (${berjalan.length})</span></div>
      ${berjalan.map(x => { const sc = opScope(x).length, dn = S.opname_detail.filter(d => d.opname_id === x.opname_id).length;
        return `<div class="led"><div class="row between"><b class="mono">${esc(x.opname_id)}</b>${bdg('Berjalan')}</div><div>${esc(x.jenis)} · ${esc(x.lokasi_id ? lokName(x.lokasi_id) : x.jenis === 'Penuh' ? 'Semua lokasi' : 'Spot')}</div><div class="prog mt8"><i style="width:${sc ? Math.min(100, dn / sc * 100) : 0}%"></i></div><div class="row between mt8"><span class="t-sm muted">${dn} / ${sc} diperiksa · ${esc(userName(x.penanggung_jawab))}</span><button class="btn btn-sm btn-p" data-act="opOpen" data-id="${esc(x.opname_id)}">Lanjutkan</button></div></div>`; }).join('') || `<div class="panel-b">${empty('Tidak ada sesi berjalan.')}</div>`}</div>
    <div class="panel frame mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-calendar-x"></i> Lokasi jatuh tempo opname</span></div>
      ${due.map(d => `<div class="led row between"><div><b>${esc(d.l.nama)}</b><div class="t-sm err-t">${d.days === null ? 'Belum pernah diopname' : d.days + ' hari sejak opname terakhir'}</div></div><button class="btn btn-sm" data-act="opnameNew" data-lok="${esc(d.l.lokasi_id)}">Siklik</button></div>`).join('') || `<div class="panel-b">${empty('Semua lokasi dalam siklus.', 'bi-check2-square')}</div>`}</div></div></div>`;
};

function renderOpSession(el, o) {
  const S = App.S, I = App.idx, U = App.ui.opname;
  U.kep = U.kep || {};
  const scope = opScope(o);
  const det = {}; S.opname_detail.filter(d => d.opname_id === o.opname_id).forEach(d => det[d.wadah_id] = d);
  const extra = S.opname_detail.filter(d => d.opname_id === o.opname_id && !scope.some(w => w.wadah_id === d.wadah_id));
  const done = Object.keys(det).length;
  const cnt = h => Object.values(det).filter(d => d.hasil === h).length;
  const tol = setN('opname_tolerance_open_pct') || 5;
  let rows = scope.slice().sort((a, b) => a.wadah_id.localeCompare(b.wadah_id));
  if (U.filter === 'todo') rows = rows.filter(w => !det[w.wadah_id]);
  if (U.filter === 'bad') rows = rows.filter(w => det[w.wadah_id] && ['Di atas toleransi', 'Tidak ditemukan'].indexOf(det[w.wadah_id].hasil) >= 0);
  const needNote = Object.values(det).filter(d => ['Di atas toleransi', 'Tidak ditemukan', 'Tidak terdaftar'].indexOf(d.hasil) >= 0 && !d.catatan);
  const needKep = Object.values(det).filter(d => d.hasil === 'Tidak ditemukan' && !U.kep[d.wadah_id]);
  el.innerHTML = `<div class="panel frame"><div class="panel-b row wrap between"><div class="row wrap"><span class="tag">SESI AUDIT</span><span class="h-lg mono">${esc(o.opname_id)}</span><span class="lbl">Tipe:</span><b>${esc(o.jenis)}${o.jenis === 'Siklik' ? ' (per lokasi)' : ''}</b><span class="lbl">Lokasi:</span><b class="cob">${esc(o.lokasi_id ? lokName(o.lokasi_id) : o.jenis === 'Penuh' ? 'Semua lokasi' : 'Spot')}</b></div>
    <div class="row"><span class="t-sm"><i class="bi bi-clock"></i> Mulai: ${esc(String(o.tanggal_mulai).substr(0, 16))}</span>${bdg('Sedang berjalan', 'Berjalan')}<button class="btn btn-sm" data-act="opBack">Daftar sesi</button></div></div>
    <div class="panel-b" style="padding-top:0"><div class="note"><i class="bi bi-shield-check"></i><div><b>Cara kerja:</b> hitung atau timbang tiap botol, lalu catat. Botol yang sudah dibuka boleh selisih ±${fmtN(tol)}%, botol tersegel harus pas. Selama pengecekan, terima &amp; ambil bahan tetap bisa dilakukan.</div></div></div></div>
  <div class="grid g4 mt12">
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">Progress opname</span><span class="mono ok-t b">${fmtN(scope.length ? done / scope.length * 100 : 0, 1)}%</span></div><div class="h-xl mono">${done} / ${scope.length} <span class="t-lg">wadah</span></div><div class="prog mt8"><i style="width:${scope.length ? Math.min(100, done / scope.length * 100) : 0}%"></i></div></div></div>
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">Di atas toleransi (&gt;${fmtN(tol)}%)</span><i class="bi bi-exclamation-triangle err-t"></i></div><div class="h-xl err-t">${cnt('Di atas toleransi')} <span class="t-lg">anomali delta</span></div><div class="t-sm muted">Wajib catatan verifikasi K3/kondisi</div></div></div>
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">Tidak ditemukan (hilang)</span><i class="bi bi-search err-t"></i></div><div class="h-xl" style="color:var(--sk-fg)">${cnt('Tidak ditemukan')} <span class="t-lg">wadah</span></div><div class="t-sm muted">Opsi: investigasi spot / write-off</div></div></div>
    <div class="panel"><div class="panel-b"><div class="row between"><span class="lbl">Tidak terdaftar</span><i class="bi bi-plus-square" style="color:var(--qr-fg)"></i></div><div class="h-xl" style="color:var(--qr-fg)">${cnt('Tidak terdaftar')} <span class="t-lg">fisik lebih</span></div><div class="t-sm muted">Ditampung ke Karantina (K-18)</div></div></div></div>
  <div class="row wrap mt12">
    <div class="chips">${[['all', `Semua (${scope.length})`], ['todo', `Belum (${scope.length - scope.filter(w => det[w.wadah_id]).length})`], ['bad', 'Bermasalah']].map(f => `<button class="chip ${U.filter === f[0] ? 'on' : ''}" data-act="opFilter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <button class="btn btn-c" data-act="opUnreg"><i class="bi bi-plus-square"></i> Catat botol tak terdaftar</button></div>
  <div class="panel frame mt12"><div class="panel-h"><span class="ttl">Hasil hitung vs catatan sistem</span><span class="idx">TOLERANSI: BOTOL TERBUKA ±${fmtN(tol)}% | BOTOL UTUH 0%</span></div>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl" id="opTbl"><thead><tr><th>ID wadah</th><th>Nama bahan &amp; CAS</th><th>Batch / exp</th><th>Kondisi segel</th><th class="num">Isi awal</th><th class="num">Stok sistem</th><th class="num">Stok fisik</th><th class="num">Selisih / %</th><th>Status hasil</th><th>Catatan audit (wajib jika &gt;${fmtN(tol)}%)</th><th>Aksi</th></tr></thead><tbody>
    ${rows.map(w => opRow(w, det[w.wadah_id], o)).join('') || `<tr><td colspan="11">${empty('Tidak ada wadah pada filter ini.')}</td></tr>`}
    ${extra.map(d => { const x = (() => { try { return JSON.parse(d.data_tambahan || '{}'); } catch (e) { return {}; } })(); const b = I.bahan.get(x.bahan_id) || {};
      return `<tr class="qrow"><td class="id"><i>[${esc(d.wadah_id)}]</i></td><td><b>${esc(b.nama_standar || '?')}</b><span class="sub cob">Sumber: penemuan fisik · ${esc(lokName(x.lokasi_id))}</span></td><td class="mono">${esc(x.nomor_batch || '- Unknown -')}</td><td>${esc(d.kondisi_saat_opname)}</td><td class="num">0</td><td class="num">0</td><td class="num">${fmtQ(d.stok_fisik_dasar, b.satuan_dasar)}</td><td class="num cob">+${fmtN(d.stok_fisik_dasar)} (surplus)</td><td>${bdg('Karantina (K-18)', 'Tidak terdaftar')}</td><td class="t-sm">${esc(d.catatan)}</td><td></td></tr>`; }).join('')}
    </tbody></table></div><div class="panel-f t-sm"><span>LEGEND: ${bdg('Cocok')} ${bdg('Dalam toleransi')} ${bdg('Di atas toleransi')} ${bdg('Tidak ditemukan')} ${bdg('Tidak terdaftar')}</span><span>Menampilkan ${rows.length} dari ${scope.length} target wadah</span></div></div>
  <div class="commit"><div><div class="caps">Kontrol integritas penutupan sesi (T-22)</div>
    <div class="row wrap mt8" style="gap:16px">${needNote.length ? `<span class="err-t"><i class="bi bi-x-circle"></i> ${needNote.length} hasil belum diberi catatan</span>` : '<span class="ok-t"><i class="bi bi-check-circle"></i> Semua deviasi &gt;' + fmtN(tol) + '% memiliki catatan</span>'}
      ${needKep.length ? `<span class="err-t"><i class="bi bi-x-circle"></i> ${needKep.length} wadah tidak ditemukan belum diputuskan (Hilang/Tunda)</span>` : '<span class="ok-t"><i class="bi bi-check-circle"></i> Keputusan wadah hilang lengkap</span>'}
      <span class="${scope.length - done ? 'muted' : 'ok-t'}"><i class="bi bi-info-circle"></i> ${scope.length - done} wadah belum diperiksa (tidak diubah)</span></div>
    <div class="t-sm muted mt8"><i class="bi bi-info-circle"></i> LockService siap: ${Object.values(det).filter(d => Math.abs(num(d.selisih_dasar)) > TOL || d.hasil === 'Tidak terdaftar').length} mutasi ledger delta dipersiapkan · setiap baris tersimpan otomatis</div></div>
    <div class="act"><button class="btn btn-d" data-act="opCancel">Batalkan sesi (stok tidak berubah)</button><button class="btn" data-act="opDraft">Simpan draf sesi</button>
      <button class="btn btn-p btn-lg" data-act="opClose" ${needNote.length || needKep.length || !done ? 'aria-disabled="true"' : ''}><i class="bi bi-patch-check"></i> Tutup sesi &amp; terapkan ledger OPNAME_ADJ</button></div></div>`;
}

function opRow(w, d, o) {
  const I = App.idx, b = I.bahan.get(w.bahan_id) || {}, bt = I.batch.get(w.batch_id) || {}, u = b.satuan_dasar, U = App.ui.opname;
  const sealed = w.status === 'Tersedia' && !w.tgl_dibuka;
  const hasil = d ? d.hasil : '';
  const cls = hasil === 'Di atas toleransi' ? 'warn' : hasil === 'Tidak ditemukan' ? 'amber' : '';
  const fis = d ? (d.hasil === 'Tidak ditemukan' ? '' : d.stok_fisik_dasar) : (sealed ? num(w.qty_sisa_dasar) : '');
  return `<tr class="${cls}" data-w="${esc(w.wadah_id)}" id="op-${esc(w.wadah_id)}"><td class="id ${hasil === 'Di atas toleransi' ? 'err-t' : ''}"><b>${esc(w.wadah_id)}</b>${w.perlu_dicari ? '<span class="sub err-t">perlu dicari</span>' : ''}</td>
    <td><b>${esc(b.nama_standar)}</b><span class="sub">CAS: ${esc(b.cas_number || '—')}</span></td><td class="mono t-sm">${esc(bt.nomor_batch || '')}<span class="sub ${daysLeft(w) <= 30 ? 'err-t' : ''}">Exp: ${dTxt(w.tgl_kedaluwarsa_efektif)}</span></td>
    <td>${sealed ? `<select class="sel" style="min-width:130px" data-op="kondisi" aria-label="Kondisi">${opts([{ v: 'Baik', t: 'Tersegel utuh' }, { v: 'Segel terbuka', t: 'Segel rusak' }, { v: 'Bocor', t: 'Bocor' }, { v: 'Label rusak', t: 'Label rusak' }, { v: 'Pecah', t: 'Pecah' }], d ? d.kondisi_saat_opname : 'Baik')}</select>` : `<select class="sel" style="min-width:120px" data-op="kondisi" aria-label="Kondisi">${opts([{ v: 'Baik', t: 'Terbuka (baik)' }, 'Bocor', 'Label rusak', 'Pecah'], d ? d.kondisi_saat_opname : 'Baik')}</select>`}</td>
    <td class="num">${fmtQ(w.qty_awal_dasar, u)}</td><td class="num b">${fmtQ(d ? d.stok_sistem_dasar : w.qty_sisa_dasar, u)}</td>
    <td class="num">${d && d.hasil === 'Tidak ditemukan' ? '<span class="tag" style="border-style:dashed;color:var(--err)">TIDAK ADA (0)</span>' : `<input class="inp mono ${hasil === 'Di atas toleransi' ? 'bad' : ''}" style="width:110px;text-align:right" inputmode="decimal" data-op="fisik" value="${esc(fis)}" aria-label="Stok fisik ${esc(w.wadah_id)}">`}</td>
    <td class="num ${d && num(d.selisih_dasar) < -TOL ? 'err-t' : d && num(d.selisih_dasar) > TOL ? 'cob' : ''}">${d ? `${num(d.selisih_dasar) > 0 ? '+' : ''}${fmtQ(d.selisih_dasar, u)} (${num(d.selisih_pct) > 0 ? '+' : ''}${fmtN(d.selisih_pct, 1)}%)` : '<span class="muted">—</span>'}</td>
    <td>${hasil ? bdg(hasil) : '<span class="muted t-sm">belum diperiksa</span>'}</td>
    <td><input class="inp ${d && ['Di atas toleransi', 'Tidak ditemukan'].indexOf(hasil) >= 0 && !d.catatan ? 'bad' : ''}" style="min-width:180px" data-op="catatan" value="${esc(d ? d.catatan : '')}" placeholder="${hasil === 'Dalam toleransi' ? 'Penyesuaian otomatis saat penutupan' : 'Catatan'}" aria-label="Catatan"></td>
    <td><span class="row">${hasil === 'Tidak ditemukan' ? `<select class="sel" style="width:auto" data-ch="opKep" data-w="${esc(w.wadah_id)}" aria-label="Keputusan">${opts(['Tunda', 'Hilang'], U.kep[w.wadah_id] || '', 'Putuskan…')}</select><button class="btn btn-sm" data-act="opFound" data-w="${esc(w.wadah_id)}">Ditemukan</button>`
      : `<button class="btn btn-sm btn-p" data-act="opSave" data-w="${esc(w.wadah_id)}">${d ? 'Perbarui' : 'Catat'}</button><button class="btn btn-sm" data-act="opMissing" data-w="${esc(w.wadah_id)}">Tidak ada</button>`}</span></td></tr>`;
}

function opRecord(wadah_id, data) {
  const o = App.S.opname.find(x => x.opname_id === App.ui.opname.sel); if (!o) return;
  const w = App.idx.wadah.get(wadah_id); if (!w) return;
  const S = App.S;
  // Optimistic: hitung hasil lokal seketika
  const sistem = num(w.qty_sisa_dasar), awal = num(w.qty_awal_dasar) || 1;
  const fisik = data.tidak_ditemukan ? null : (data.stok_fisik === '' || data.stok_fisik === null ? null : num(data.stok_fisik));
  const sealed = w.status === 'Tersedia' && !w.tgl_dibuka;
  if (!data.tidak_ditemukan && !sealed && fisik === null) { toast('Isi stok fisik untuk wadah terbuka.', 'warn'); return; }
  const hasil = data.tidak_ditemukan ? 'Tidak ditemukan' : opHasil(w, fisik, data.kondisi);
  const f = data.tidak_ditemukan ? 0 : (fisik === null ? sistem : fisik);
  const diff = r4(f - sistem);
  let det = S.opname_detail.find(d => d.opname_id === o.opname_id && d.wadah_id === wadah_id);
  const prev = det ? Object.assign({}, det) : null;
  if (!det) { det = { detail_id: 'OPT-' + uid().substr(0, 8), opname_id: o.opname_id, wadah_id, _opt: true }; S.opname_detail.push(det); }
  Object.assign(det, { stok_sistem_dasar: sistem, stok_fisik_dasar: data.tidak_ditemukan ? '' : f, selisih_dasar: diff, selisih_pct: r4(diff / awal * 100), hasil, kondisi_saat_opname: data.kondisi || 'Baik', catatan: data.catatan || '', diperiksa_oleh: App.user.user_id });
  const rid = uid();
  App.rollbacks[rid] = { fn: () => { if (prev) Object.assign(det, prev); else S.opname_detail = S.opname_detail.filter(x => x !== det); render('opname'); } };
  outboxPush({ id: rid, action: 'catatOpname', payload: Object.assign({ request_id: rid, opname_id: o.opname_id, wadah_id }, data), label: 'Opname ' + wadah_id, t: Date.now() });
  const row = $('#op-' + CSS.escape(wadah_id));
  if (row) { const tmp = document.createElement('tbody'); tmp.innerHTML = opRow(w, det, o); row.replaceWith(tmp.firstElementChild); }
  flushOutbox();
}
function opReadRow(id) {
  const row = $('#op-' + CSS.escape(id)); if (!row) return {};
  const g = k => { const e = row.querySelector(`[data-op="${k}"]`); return e ? e.value.trim() : ''; };
  return { stok_fisik: g('fisik'), kondisi: g('kondisi') || 'Baik', catatan: g('catatan') };
}
ACT.opSave = el => opRecord(el.dataset.w, opReadRow(el.dataset.w));
ACT.opMissing = el => { const v = opReadRow(el.dataset.w); opRecord(el.dataset.w, { tidak_ditemukan: true, kondisi: v.kondisi, catatan: v.catatan }); };
ACT.opFound = el => { const w = App.idx.wadah.get(el.dataset.w); delete App.ui.opname.kep[el.dataset.w]; opRecord(el.dataset.w, { stok_fisik: num(w.qty_sisa_dasar), kondisi: 'Baik', catatan: 'Ditemukan kembali' }); render('opname'); };
CH.opKep = el => { App.ui.opname.kep[el.dataset.w] = el.value; ls('ci_opkep_' + App.ui.opname.sel, App.ui.opname.kep); render('opname'); };
ACT.opFilter = el => { App.ui.opname.filter = el.dataset.f; render('opname'); };
ACT.opBack = () => { App.ui.opname.sel = null; render('opname'); };
ACT.opOpen = el => { App.ui.opname.sel = el.dataset.id; App.ui.opname.kep = ls('ci_opkep_' + el.dataset.id) || {}; App.ui.opname.filter = 'all'; render('opname'); };
ACT.opJenis = el => { App.ui.opname.form.jenis = el.dataset.j; render('opname'); };
CH.opForm = el => { App.ui.opname.form[el.name] = el.value; };
IN.opForm = el => { App.ui.opname.form[el.name] = el.value; };
ACT.opnameNew = el => { App.ui.opname.sel = null; App.ui.opname.form = { jenis: 'Siklik', lokasi_id: el.dataset.lok || '', wadah_ids: '', catatan: '' }; go('opname'); };
ACT.opStart = async el => {
  const f = App.ui.opname.form;
  const p = { jenis: f.jenis, lokasi_id: f.lokasi_id, catatan: f.catatan, wadah_ids: f.jenis === 'Spot' ? String(f.wadah_ids).toUpperCase().split(/[\s,;]+/).filter(Boolean) : [] };
  try { const d = await act('mulaiOpname', p, { btn: el, ok: 'Sesi opname dimulai.' }); App.ui.opname.sel = d.opname_id; App.ui.opname.kep = {}; App.ui.opname.form = null; render('opname'); } catch (e) { }
};
ACT.opUnreg = () => {
  const o = App.S.opname.find(x => x.opname_id === App.ui.opname.sel);
  formModal({ title: 'Catat wadah fisik tidak terdaftar (K-18)', cols: 2, intro: '<div class="note q mb8"><i class="bi bi-plus-square"></i><div>Wadah baru akan dibuat saat sesi ditutup dengan status <b>Karantina</b> sampai batch &amp; kedaluwarsa dilengkapi.</div></div>',
    fields: [{ name: 'bahan_id', label: 'Bahan (paling sesuai)', type: 'select', required: true, options: App.S.bahan.filter(b => b.status === 'Aktif').map(b => ({ v: b.bahan_id, t: b.nama_standar })) },
      { name: 'lokasi_id', label: 'Lokasi ditemukan', type: 'select', required: true, value: o.lokasi_id, options: App.S.lokasi.filter(l => l.status === 'Aktif').map(l => ({ v: l.lokasi_id, t: l.nama })) },
      { name: 'perkiraan_sisa', label: 'Perkiraan sisa (satuan dasar)', type: 'number', step: 'any', min: 0, required: true, mono: true }, { name: 'kondisi', label: 'Kondisi', type: 'select', options: EN.kondisi, value: 'Baik', ph: '' },
      { name: 'nomor_batch', label: 'Nomor batch (bila terbaca)', mono: true }, { name: 'tgl_kedaluwarsa', label: 'Kedaluwarsa (bila terbaca)', type: 'date' }, { name: 'catatan', label: 'Catatan temuan', type: 'textarea', required: true }],
    onSubmit: async (v, btn, f, h) => { await act('catatTakTerdaftar', Object.assign({ opname_id: o.opname_id }, v, { perkiraan_sisa: num(v.perkiraan_sisa) }), { btn, ok: 'Wadah tidak terdaftar dicatat.', form: f }); h.close(); } });
};
ACT.opCancel = async () => {
  const alasan = await ask({ title: 'Batalkan sesi opname', msg: 'Sesi dibatalkan dan stok tidak berubah. Hasil pemeriksaan tetap tersimpan sebagai riwayat.', danger: true, ok: 'Batalkan sesi', input: { label: 'Alasan', required: true } });
  if (!alasan) return;
  await act('batalOpname', { opname_id: App.ui.opname.sel, alasan }, { ok: 'Sesi dibatalkan.' }).then(() => { App.ui.opname.sel = null; render('opname'); }).catch(() => { });
};
ACT.opDraft = () => { ls('ci_opkep_' + App.ui.opname.sel, App.ui.opname.kep); toast('Setiap baris sudah tersimpan otomatis ke server; keputusan Hilang/Tunda disimpan di perangkat.', 'ok'); };
ACT.opClose = async el => {
  if (App.outbox.length) { toast('Menunggu sinkronisasi baris opname… coba lagi sebentar.', 'warn'); flushOutbox(); return; }
  const o = App.S.opname.find(x => x.opname_id === App.ui.opname.sel);
  const det = App.S.opname_detail.filter(d => d.opname_id === o.opname_id);
  const adj = det.filter(d => Math.abs(num(d.selisih_dasar)) > TOL && d.hasil !== 'Tidak ditemukan').length;
  const hil = det.filter(d => d.hasil === 'Tidak ditemukan' && App.ui.opname.kep[d.wadah_id] === 'Hilang').length;
  const ok = await ask({ title: 'Tutup sesi & terapkan penyesuaian', html: `Akan diterapkan: <b>${adj}</b> penyesuaian OPNAME_ADJ (delta), <b>${hil}</b> wadah menjadi Hilang, <b>${det.filter(d => d.hasil === 'Tidak terdaftar').length}</b> wadah temuan dibuat (Karantina). Tindakan ini final.`, tone: 'warn', ok: 'Tutup & terapkan' });
  if (!ok) return;
  try { const d = await act('tutupOpname', { opname_id: o.opname_id, keputusan: App.ui.opname.kep }, { btn: el, busy: 'Menerapkan ledger…' }); ls('ci_opkep_' + o.opname_id, null); App.ui.opname.sel = null; toast('Sesi ditutup: ' + Object.keys(d.ringkasan).map(k => k + ' ' + d.ringkasan[k]).join(', '), 'ok'); render('opname'); } catch (e) { }
};

// ════════════════════════════════════════════════════════
// BAGIAN 12: REGISTRI SDS & K3 [W-09]
// ════════════════════════════════════════════════════════

RENDER.sds = el => {
  const S = App.S, I = App.idx, U = App.ui.sds, t = today();
  const kimia = S.bahan.filter(b => b.status === 'Aktif' && (b.butuh_sds === true || b.butuh_sds === 'true'));
  const warnDays = Math.max.apply(null, String(S.settings.sds_warning_days || '60').split(',').map(Number).filter(isFinite).concat([30]));
  const row = b => { const s = activeSds(b.bahan_id); const st = I.stat.get(b.bahan_id).sdsSt; const d = s ? daysBetween(t, s.tanggal_kedaluwarsa) : null; return { b, s, st, d, soon: d !== null && d <= warnDays }; };
  let rows = kimia.map(row);
  const nAktif = rows.filter(r => r.st === 'Aktif').length, nSoon = rows.filter(r => r.soon).length, nBad = rows.filter(r => r.st !== 'Aktif').length;
  if (U.f === 'bad') rows = rows.filter(r => r.st !== 'Aktif');
  if (U.f === 'soon') rows = rows.filter(r => r.soon);
  const q = normName(U.q); if (q) rows = rows.filter(r => normName(r.b.nama_standar + ' ' + r.b.cas_number + ' ' + r.b.nama_alias).indexOf(q) >= 0);
  rows.sort((a, b) => (a.st === 'Aktif' ? 1 : 0) - (b.st === 'Aktif' ? 1 : 0) || (a.d === null ? -1 : a.d) - (b.d === null ? -1 : b.d));
  el.innerHTML = `<div class="grid g4">
    <div class="panel"><div class="panel-b"><div class="lbl">Bahan kimia aktif</div><div class="h-xl">${kimia.length}</div></div></div>
    <div class="panel"><div class="panel-b"><div class="lbl ok-t">SDS aktif</div><div class="h-xl ok-t">${nAktif}</div><div class="t-sm muted">${fmtN(kimia.length ? nAktif / kimia.length * 100 : 100, 1)}% cakupan</div></div></div>
    <div class="panel"><div class="panel-b"><div class="lbl" style="color:var(--sk-fg)">Akan kedaluwarsa ≤ ${warnDays} hari</div><div class="h-xl" style="color:var(--sk-fg)">${nSoon}</div></div></div>
    <div class="panel"><div class="panel-b"><div class="lbl err-t">SDS bermasalah</div><div class="h-xl err-t">${nBad}</div><div class="t-sm muted">Wadah baru otomatis Karantina</div></div></div></div>
  <div class="panel frame mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-shield-check"></i> Daftar lembar keselamatan (SDS)</span>
    <span class="row"><div class="chips">${[['all', 'Semua'], ['bad', 'Bermasalah'], ['soon', 'Akan habis']].map(f => `<button class="chip ${U.f === f[0] ? 'on' : ''}" data-act="sdsF" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
    <input class="inp" style="width:200px;height:28px" placeholder="Cari bahan / CAS" value="${esc(U.q)}" data-in="sdsQ" aria-label="Cari SDS"><button class="btn btn-sm btn-p" data-act="sdsUpload"><i class="bi bi-upload"></i> Unggah SDS</button></span></div>
    <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>Bahan</th><th>CAS</th><th>Kelas bahaya</th><th>Status</th><th>SDS aktif</th><th>Terbit</th><th>Kedaluwarsa</th><th>Supplier</th><th>Karantina menunggu</th><th>Aksi</th></tr></thead><tbody>
    ${rows.map(r => { const kar = (I.wByB.get(r.b.bahan_id) || []).filter(w => w.status === 'Karantina' && w.alasan_karantina === 'SDS menunggu').length;
      return `<tr class="${r.st !== 'Aktif' ? 'warn' : r.soon ? 'amber' : ''}"><td><b>${esc(r.b.nama_standar)}</b><span class="sub">${esc(r.b.bahan_id)}</span></td><td class="mono">${esc(r.b.cas_number || '—')}</td><td>${ghsTags(r.b.kelas_bahaya)}</td>
        <td>${bdg(r.st === 'Aktif' && r.soon ? 'Akan habis' : r.st, r.st === 'Aktif' && r.soon ? 'Segera' : r.st)}</td><td class="mono">${r.s ? esc(r.s.sds_id) + '<span class="sub">' + esc(r.s.revisi || '') + '</span>' : '—'}</td>
        <td class="mono">${r.s ? dTxt(r.s.tanggal_terbit) : '—'}</td><td class="mono ${r.soon ? 'err-t' : ''}">${r.s ? dTxt(r.s.tanggal_kedaluwarsa) + `<span class="sub">${r.d} hari</span>` : '—'}</td>
        <td>${r.s ? esc((I.supplier.get(r.s.supplier_id) || {}).nama || 'Umum') : '—'}</td><td class="num">${kar ? `<b class="err-t">${kar}</b>` : '0'}</td>
        <td class="row">${r.s && r.s.link ? `<button class="btn btn-sm" data-act="sdsView" data-id="${esc(r.s.sds_id)}"><i class="bi bi-eye"></i> Buka</button>` : ''}<button class="btn btn-sm ${r.st !== 'Aktif' ? 'btn-p' : ''}" data-act="sdsUpload" data-b="${esc(r.b.bahan_id)}">Unggah</button><button class="btn btn-sm btn-g" data-act="sdsHist" data-b="${esc(r.b.bahan_id)}">Riwayat</button></td></tr>`; }).join('') || `<tr><td colspan="10">${empty('Tidak ada data.')}</td></tr>`}
    </tbody></table></div><div class="panel-f t-sm"><span>Hanya satu SDS Aktif per kombinasi bahan &amp; supplier. Unggahan baru otomatis menggantikan yang lama.</span><span class="muted">Masa berlaku default: ${esc(S.settings.sds_validity_years)} tahun</span></div></div>
  <div class="panel frame mt12"><div class="panel-h"><span class="ttl"><i class="bi bi-exclamation-diamond"></i> Referensi piktogram GHS</span></div><div class="panel-b grid g3">
    ${Object.keys(EN.ghs).map(g => `<div class="row"><span class="ghs-ico"><span>${g.replace('GHS', '')}</span></span><div><b class="mono">${g}</b><div class="t-sm">${EN.ghs[g]}</div><div class="t-sm muted">${S.bahan.filter(b => b.status === 'Aktif' && String(b.kelas_bahaya || '').indexOf(g) >= 0).length} bahan</div></div></div>`).join('')}</div></div>`;
};
ACT.sdsF = el => { App.ui.sds.f = el.dataset.f; render('sds'); };
IN.sdsQ = debounce(el => { App.ui.sds.q = el.value; const p = el.selectionStart; render('sds'); const n = $('[data-in="sdsQ"]'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { } } }, 250);
ACT.sdsView = el => {
  const s = App.idx.sds.get(el.dataset.id); if (!s) return;
  const prev = s.file_drive_id ? 'https://drive.google.com/file/d/' + s.file_drive_id + '/preview' : s.link;
  if (!prev) { toast('SDS ini tidak memiliki berkas (data contoh).', 'warn'); return; }
  modal({ title: `SDS ${s.sds_id} — ${bahanName(s.bahan_id)}`, wide: true, body: `<iframe src="${esc(prev)}" style="width:100%;height:72vh;border:1px solid var(--rule)" title="Dokumen SDS"></iframe>`, foot: `<button class="btn" data-act="mclose"><i class="bi bi-x-lg"></i> Tutup</button><a class="btn btn-p" href="${esc(s.link)}" target="_blank" rel="noopener"><i class="bi bi-download"></i> Unduh</a>` });
};
ACT.sdsHist = el => {
  const rows = (App.idx.sdsByB.get(el.dataset.b) || []).slice().sort((a, b) => a.tanggal_terbit < b.tanggal_terbit ? 1 : -1);
  modal({ title: 'Riwayat SDS — ' + bahanName(el.dataset.b), wide: true, body: `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>SDS</th><th>Revisi</th><th>Supplier</th><th>Terbit</th><th>Kedaluwarsa</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(s => `<tr><td class="id">${esc(s.sds_id)}</td><td>${esc(s.revisi)}</td><td>${esc((App.idx.supplier.get(s.supplier_id) || {}).nama || 'Umum')}</td><td class="mono">${dTxt(s.tanggal_terbit)}</td><td class="mono">${dTxt(s.tanggal_kedaluwarsa)}</td><td>${bdg(s.status)}</td><td>${s.link ? `<button class="btn btn-sm" data-act="sdsView" data-id="${esc(s.sds_id)}">Buka</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="7">${empty('Belum ada SDS.')}</td></tr>`}</tbody></table></div>` });
};
ACT.sdsUpload = el => {
  const S = App.S, bid = el && el.dataset ? el.dataset.b || '' : '';
  const years = num(S.settings.sds_validity_years) || 5;
  formModal({
    title: 'Unggah SDS (PDF ≤ 10 MB)', cols: 2,
    fields: [{ name: 'bahan_id', label: 'Bahan', type: 'select', required: true, value: bid, options: S.bahan.filter(b => b.status === 'Aktif' && (b.butuh_sds === true || b.butuh_sds === 'true')).map(b => ({ v: b.bahan_id, t: b.nama_standar })) },
      { name: 'supplier_id', label: 'Supplier (kosong = SDS umum)', type: 'select', value: el && el.dataset ? el.dataset.s || '' : '', ph: '— SDS umum —', options: S.supplier.filter(s => s.status === 'Aktif').map(s => ({ v: s.supplier_id, t: s.nama })) },
      { name: 'revisi', label: 'Nomor / tanggal revisi', ph: 'Rev 9.0' }, { name: 'tanggal_terbit', label: 'Tanggal terbit', type: 'date', max: today(), required: true },
      { name: 'tanggal_kedaluwarsa', label: 'Tanggal kedaluwarsa', type: 'date', help: `Kosong = terbit + ${years} tahun (kebijakan lab)` }, { name: 'file', label: 'Berkas PDF', type: 'file', accept: 'application/pdf', required: true }],
    submit: '<i class="bi bi-upload"></i> Unggah & aktifkan',
    onSubmit: async (v, btn, f, h) => {
      const file = await fileB64($('[name=file]', f));
      if (!file) { toast('Pilih berkas PDF.', 'err'); return; }
      if (file.mime !== 'application/pdf') { toast('Berkas harus PDF.', 'err'); return; }
      if (file.size > 10 * 1024 * 1024) { toast('Ukuran PDF melebihi 10 MB.', 'err'); return; }
      const d = await act('unggahSDS', Object.assign({}, v, { file }), { btn, busy: 'Mengunggah…', form: f, ok: 'SDS diunggah & aktif.' });
      h.close();
      if (d.menunggu_verifikasi && d.menunggu_verifikasi.length && await ask({ title: 'Verifikasi wadah karantina', msg: `${d.menunggu_verifikasi.length} wadah karantina hanya menunggu SDS (kondisi baik). Verifikasi & rilis sekarang?`, ok: 'Verifikasi sekaligus' }))
        await act('verifikasiMassal', { wadah_ids: d.menunggu_verifikasi }, { ok: r => `${r.diverifikasi} wadah dirilis.` }).catch(() => { });
    },
    onMount: (h, form) => {
      const terb = $('[name=tanggal_terbit]', form), exp = $('[name=tanggal_kedaluwarsa]', form);
      terb.addEventListener('change', () => { if (!exp.value && isDate(terb.value)) exp.value = addDays(terb.value, Math.round(365.25 * years)); });
    }
  });
};

// ════════════════════════════════════════════════════════
// BAGIAN 13: MASTER DATA [W-10]
// ════════════════════════════════════════════════════════

RENDER.po = el => { const U = App.ui.master, prev = U.tab; U.tab = 'po'; try { RENDER.master(el, true); } finally { U.tab = prev === 'po' ? 'bahan' : prev; } };
RENDER.master = (el, poOnly) => {
  const U = App.ui.master, S = App.S, admin = App.user.peran === 'Admin';
  if (!poOnly && U.tab === 'po') U.tab = 'bahan';
  const tabs = [['bahan', 'Bahan', S.bahan.length], ['supplier', 'Pemasok', S.supplier.length], ['lokasi', 'Lokasi', S.lokasi.length], ['konversi', 'Satuan', S.konversi.length]].concat(admin ? [['gabung', 'Gabungkan ganda', '']] : []);
  const q = normName(U.q);
  let body = '';
  const search = `<input class="inp" style="width:240px;height:28px" placeholder="Cari…" value="${esc(U.q)}" data-in="masterQ" aria-label="Cari master">`;
  if (U.tab === 'bahan') {
    const rows = S.bahan.filter(b => !q || normName([b.bahan_id, b.nama_standar, b.nama_alias, b.cas_number, b.kategori].join(' ')).indexOf(q) >= 0);
    body = `<div class="panel frame"><div class="panel-h"><span class="ttl">Master bahan &amp; consumable</span><span class="row">${search}<button class="btn btn-sm btn-p" data-act="bahanForm"><i class="bi bi-plus-lg"></i> Tambah bahan</button></span></div>
      <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>ID</th><th>Nama standar</th><th>CAS</th><th>Jenis / kategori</th><th>Satuan</th><th>Densitas</th><th>GHS</th><th>Reorder</th><th>SDS</th><th>Status</th></tr></thead><tbody>
      ${rows.map(b => `<tr style="cursor:pointer" data-act="bahanForm" data-id="${esc(b.bahan_id)}"><td class="id">${esc(b.bahan_id)}</td><td><b>${esc(b.nama_standar)}</b>${b.nama_alias ? `<span class="sub" style="font-family:inherit">${esc(b.nama_alias)}</span>` : ''}${b.kritis === true || b.kritis === 'true' ? ' <span class="bdg s-ex">Kritis</span>' : ''}</td>
        <td class="mono">${esc(b.cas_number || (b.tanpa_cas ? 'Campuran' : '—'))}</td><td>${esc(b.jenis_item)}<span class="sub">${esc(b.kategori)}</span></td><td class="mono">${esc(b.satuan_dasar)}</td><td class="num">${b.densitas_g_per_mL || '—'}</td><td>${ghsTags(b.kelas_bahaya)}</td>
        <td class="mono t-sm">${esc(b.reorder_mode)}${b.reorder_point ? ' · ' + fmtN(b.reorder_point) : ''}</td><td>${bdg(App.idx.stat.get(b.bahan_id).sdsSt)}</td><td>${bdg(b.status)}${b.digabung_ke ? `<span class="sub">→ ${esc(b.digabung_ke)}</span>` : ''}</td></tr>`).join('') || `<tr><td colspan="10">${empty('Tidak ada data.')}</td></tr>`}</tbody></table></div></div>`;
  } else if (U.tab === 'supplier') {
    const rows = S.supplier.filter(s => !q || normName(s.nama + ' ' + s.supplier_id + ' ' + s.email).indexOf(q) >= 0);
    body = `<div class="panel frame"><div class="panel-h"><span class="ttl">Supplier</span><span class="row">${search}<button class="btn btn-sm btn-p" data-act="supForm"><i class="bi bi-plus-lg"></i> Tambah</button></span></div><div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>ID</th><th>Nama</th><th>Kontak</th><th>Email / telepon</th><th>Status</th></tr></thead><tbody>
      ${rows.map(s => `<tr style="cursor:pointer" data-act="supForm" data-id="${esc(s.supplier_id)}"><td class="id">${esc(s.supplier_id)}</td><td><b>${esc(s.nama)}</b><span class="sub" style="font-family:inherit">${esc(s.alamat || '')}</span></td><td>${esc(s.kontak_nama || '—')}</td><td class="mono t-sm">${esc(s.email || '')} ${esc(s.telepon || '')}</td><td>${bdg(s.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
  } else if (U.tab === 'lokasi') {
    const rows = S.lokasi.filter(l => !q || normName(l.nama + ' ' + l.lokasi_id + ' ' + l.tipe).indexOf(q) >= 0);
    body = `<div class="panel frame"><div class="panel-h"><span class="ttl">Lokasi penyimpanan</span><span class="row">${search}<button class="btn btn-sm btn-p" data-act="lokForm"><i class="bi bi-plus-lg"></i> Tambah</button></span></div><div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>ID</th><th>Nama</th><th>Tipe</th><th>Suhu target</th><th>Induk</th><th class="num">Wadah aktif</th><th>Opname terakhir</th><th>Status</th></tr></thead><tbody>
      ${rows.map(l => `<tr style="cursor:pointer" data-act="lokForm" data-id="${esc(l.lokasi_id)}"><td class="id">${esc(l.lokasi_id)}</td><td><b>${esc(l.nama)}</b></td><td>${esc(l.tipe)}</td><td class="mono">${esc(l.suhu_target || '—')}</td><td>${esc(l.induk_lokasi_id ? lokName(l.induk_lokasi_id) : '—')}</td>
        <td class="num">${S.wadah.filter(w => w.lokasi_id === l.lokasi_id && AKHIR.indexOf(w.status) < 0).length}</td><td class="mono">${dTxt((S.opname_last || {})[l.lokasi_id])}</td><td>${bdg(l.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
  } else if (U.tab === 'konversi') {
    body = `<div class="panel frame"><div class="panel-h"><span class="ttl">Konversi satuan (urutan: aturan bahan → umum (*) → densitas)</span><button class="btn btn-sm btn-p" data-act="konvForm"><i class="bi bi-plus-lg"></i> Tambah aturan</button></div><div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>ID</th><th>Berlaku untuk</th><th>Dari</th><th>Ke (dasar)</th><th class="num">Faktor</th><th>Keterangan</th></tr></thead><tbody>
      ${S.konversi.map(k => `<tr style="cursor:pointer" data-act="konvForm" data-id="${esc(k.konv_id)}"><td class="id">${esc(k.konv_id)}</td><td>${k.bahan_id === '*' ? '<span class="bdg s-ink">* semua bahan</span>' : esc(bahanName(k.bahan_id))}</td><td class="mono">${esc(k.dari_satuan)}</td><td class="mono">${esc(k.ke_satuan)}</td><td class="num">${fmtN(k.faktor, 6)}</td><td>${esc(k.keterangan || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
  } else if (U.tab === 'po') {
    const J = U.potab === 'Reservasi' ? 'Reservasi' : 'PO', isR = J === 'Reservasi';
    const jen = p => p.jenis === 'Reservasi' ? 'Reservasi' : 'PO';
    const cnt = j => S.po_header.filter(p => jen(p) === j && (p.status === 'Terbuka' || p.status === 'Sebagian')).length;
    const ptabs = `<div class="subtabs">${[['PO', 'Buat PO', 'bi-cart3'], ['Reservasi', 'Buat Reservasi', 'bi-box-seam']].map(t => `<button class="subtab ${J === t[0] ? 'on' : ''}" data-act="poTab" data-t="${t[0]}"><i class="bi ${t[2]}"></i> ${t[1]}<span class="n">(${cnt(t[0])} berjalan)</span></button>`).join('')}</div>`;
    const hs = S.po_header.filter(p => jen(p) === J && (!q || normName(p.po_no + ' ' + (App.idx.supplier.get(p.supplier_id) || {}).nama).indexOf(q) >= 0)).slice().sort((a, b) => a.tanggal_po < b.tanggal_po ? 1 : -1);
    body = ptabs + `<div class="panel frame"><div class="panel-h"><span class="ttl">${isR ? 'Daftar reservasi gudang' : 'Daftar purchase order'}</span><span class="row">${search}<button class="btn btn-sm btn-p" data-act="poForm" data-j="${J}"><i class="bi bi-plus-lg"></i> ${isR ? 'Buat Reservasi' : 'Buat PO'}</button></span></div><div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>${isR ? 'No. reservasi' : 'No. PO'}</th><th>${isR ? 'Asal barang' : 'Supplier'}</th><th>Tanggal</th><th>Item (diterima / diminta)</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      ${hs.map(h => { const its = S.po_item.filter(i => i.po_no === h.po_no);
        return `<tr><td class="id">${esc(h.po_no)}</td><td>${esc((App.idx.supplier.get(h.supplier_id) || {}).nama || '')}</td><td class="mono">${dTxt(h.tanggal_po)}</td>
          <td>${its.map(i => { const b = App.idx.bahan.get(i.bahan_id) || {}; return `<div class="row between t-sm" style="padding:2px 0"><span>${esc(b.nama_standar)}: <span class="mono">${fmtQ(i.qty_diterima_dasar, b.satuan_dasar)} / ${fmtQ(i.qty_pesan_dasar, b.satuan_dasar)}</span> ${bdg(i.status_item, i.status_item === 'Terbuka' ? 'Terbuka_PO' : i.status_item)}${i.alasan_tutup ? ` <span class="muted">(${esc(i.alasan_tutup)})</span>` : ''}</span>${i.status_item === 'Sebagian' || i.status_item === 'Terbuka' ? `<button class="btn btn-sm btn-g" data-act="poTutup" data-id="${esc(i.po_item_id)}">Tutup sisa</button>` : ''}</div>`; }).join('')}</td>
          <td>${bdg(h.status, h.status === 'Terbuka' ? 'Terbuka_PO' : h.status)}</td><td>${h.status === 'Terbuka' ? `<button class="btn btn-sm btn-d" data-act="poBatal" data-id="${esc(h.po_no)}">Batalkan</button>` : ''}</td></tr>`; }).join('') || `<tr><td colspan="6">${empty(isR ? 'Belum ada reservasi. Klik "Buat Reservasi" untuk meminta barang dari gudang.' : 'Belum ada PO.')}</td></tr>`}</tbody></table></div>
      <div class="panel-f t-sm muted"><span>${isR ? 'Barang dari reservasi diterima lewat menu Terima → "Dengan PO / Reservasi", sama seperti PO.' : 'Barang dari PO diterima lewat menu Terima → "Dengan PO / Reservasi".'}</span></div></div>`;
  } else if (U.tab === 'gabung') {
    body = `<div class="panel frame"><div class="panel-h"><span class="ttl">Gabungkan bahan ganda (khusus Admin)</span></div><div class="panel-b"><div class="note warn"><i class="bi bi-exclamation-triangle"></i><div>Semua referensi (batch, wadah, PO, SDS, konversi, penerimaan) dipindah ke target. Nama sumber menjadi alias target; sumber dinonaktifkan. Ledger tetap utuh (immutable). Satuan dasar harus sama.</div></div>
      <div class="fgrid c3 mt12"><div class="field"><label>Bahan sumber (duplikat)</label><select class="sel" id="gbS">${opts(S.bahan.filter(b => b.status === 'Aktif').map(b => ({ v: b.bahan_id, t: b.bahan_id + ' · ' + b.nama_standar + ' (' + b.satuan_dasar + ')' })), '', 'Pilih…')}</select></div>
      <div class="field"><label>Bahan target (dipertahankan)</label><select class="sel" id="gbT">${opts(S.bahan.filter(b => b.status === 'Aktif').map(b => ({ v: b.bahan_id, t: b.bahan_id + ' · ' + b.nama_standar + ' (' + b.satuan_dasar + ')' })), '', 'Pilih…')}</select></div>
      <div class="field"><label>Alasan</label><input class="inp" id="gbA"></div></div><button class="btn btn-d mt12" data-act="gabungGo"><i class="bi bi-intersect"></i> Gabungkan</button></div></div>`;
  }
  if (poOnly) { el.innerHTML = body; return; }
  el.innerHTML = `<div class="subtabs">${tabs.map(t => `<button class="subtab ${U.tab === t[0] ? 'on' : ''}" data-act="masterTab" data-t="${t[0]}">${t[1]}${t[2] !== '' ? `<span class="n">(${t[2]})</span>` : ''}</button>`).join('')}</div>${body}`;
};
ACT.poTab = el => { App.ui.master.potab = el.dataset.t; App.ui.master.q = ''; render(App.view); };
ACT.masterTab = el => { App.ui.master.tab = el.dataset.t; App.ui.master.q = ''; render('master'); };
IN.masterQ = debounce(el => { App.ui.master.q = el.value; const p = el.selectionStart; render(App.view); const n = $('[data-in="masterQ"]'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { } } }, 200);

ACT.bahanForm = el => {
  const b = el && el.dataset && el.dataset.id ? App.idx.bahan.get(el.dataset.id) : null;
  const v = b || { jenis_item: 'Bahan Kimia', kategori: 'Pelarut', bentuk_fisik: 'Cair', satuan_dasar: 'mL', butuh_sds: true, reorder_mode: 'AUTO', status: 'Aktif' };
  const ghs = String(v.kelas_bahaya || '').split(',').map(x => x.trim());
  const yes = x => x === true || x === 'true';
  formModal({
    title: b ? 'Edit bahan ' + b.bahan_id : 'Tambah bahan', wide: true, cols: 3,
    fields: [
      { name: 'jenis_item', label: 'Jenis item', type: 'select', required: true, value: v.jenis_item, options: ['Bahan Kimia', 'Consumable'], ph: '' },
      { name: 'nama_standar', label: 'Nama standar', required: true, value: v.nama_standar || '', help: '<span id="dupHint"></span>' },
      { name: 'nama_alias', label: 'Alias (pisah ;)', value: v.nama_alias || '' },
      { name: 'cas_number', label: 'Nomor CAS', mono: true, value: v.cas_number || '', ph: '64-17-5', help: '<span id="casHint"></span>' },
      { name: 'grade', label: 'Grade', value: v.grade || '', ph: 'p.a. / HPLC / teknis' },
      { name: 'kategori', label: 'Kategori', type: 'select', required: true, value: v.kategori, options: EN.kategori, ph: '' },
      { name: 'bentuk_fisik', label: 'Bentuk fisik', type: 'select', required: true, value: v.bentuk_fisik, options: EN.bentuk, ph: '' },
      { name: 'satuan_dasar', label: 'Satuan dasar', type: 'select', required: true, value: v.satuan_dasar, options: EN.satuan_dasar, ph: '', help: b ? 'Tidak dapat diubah bila ada wadah aktif' : '' },
      { name: 'densitas_g_per_mL', label: 'Densitas (g/mL)', type: 'number', step: 'any', min: 0, mono: true, value: v.densitas_g_per_mL || '', help: 'Wajib bila diterima dalam massa tetapi dasar volume (atau sebaliknya)' },
      { type: 'html', html: `<div class="field" style="grid-column:1/-1"><span class="flbl">Kelas bahaya (piktogram GHS)</span><div class="row wrap">${Object.keys(EN.ghs).map(g => `<label class="chk optbox" style="padding:4px 8px"><input type="checkbox" name="ghs_${g}" ${ghs.indexOf(g) >= 0 ? 'checked' : ''}> <b class="mono">${g}</b> <span class="t-sm">${EN.ghs[g]}</span></label>`).join('')}</div></div>` },
      { name: 'nfpa', label: 'NFPA (H-F-R-khusus)', mono: true, value: v.nfpa || '', ph: '2-3-0-' }, { name: 'suhu_simpan', label: 'Suhu simpan', value: v.suhu_simpan || '' },
      { name: 'masa_pakai_setelah_dibuka_hari', label: 'Masa pakai setelah dibuka (hari)', type: 'number', min: 1, value: v.masa_pakai_setelah_dibuka_hari || '' },
      { name: 'umur_simpan_tipikal_hari', label: 'Umur simpan tipikal (hari)', type: 'number', min: 1, value: v.umur_simpan_tipikal_hari || '' },
      { name: 'ukuran_kemasan_standar', label: 'Ukuran kemasan standar (satuan dasar)', type: 'number', step: 'any', min: 0, value: v.ukuran_kemasan_standar || '' },
      { name: 'lead_time_hari', label: 'Lead time (hari)', type: 'number', min: 1, value: v.lead_time_hari || '', ph: String(setN('default_lead_time_days') || 14) },
      { name: 'reorder_mode', label: 'Mode reorder', type: 'select', value: v.reorder_mode, options: ['AUTO', 'MANUAL'], ph: '' },
      { name: 'reorder_point', label: 'Reorder point (MANUAL)', type: 'number', step: 'any', min: 0, value: v.reorder_mode === 'MANUAL' ? v.reorder_point || '' : '' },
      { name: 'safety_stock', label: 'Safety stock (MANUAL)', type: 'number', step: 'any', min: 0, value: v.reorder_mode === 'MANUAL' ? v.safety_stock || '' : '' },
      { name: 'status', label: 'Status', type: 'select', value: v.status, options: ['Aktif', 'Nonaktif'], ph: '' },
      { name: 'butuh_sds', label: 'Wajib SDS', type: 'check', value: yes(v.butuh_sds) }, { name: 'kritis', label: 'Bahan kritis (service level lebih tinggi)', type: 'check', value: yes(v.kritis) },
      { name: 'tanpa_cas', label: 'Campuran / tanpa CAS tunggal (K-14)', type: 'check', value: yes(v.tanpa_cas) }, { name: 'alasan_tanpa_cas', label: 'Alasan tanpa CAS', value: v.alasan_tanpa_cas || '' },
      { name: 'alasan', label: 'Alasan perubahan (audit)', value: '' }
    ],
    onMount: (h, form) => {
      const nm = $('[name=nama_standar]', form), cas = $('[name=cas_number]', form);
      const chk = () => {
        const n = normName(nm.value), c = cas.value.trim();
        const sim = n.length >= 3 ? App.S.bahan.filter(x => (!b || x.bahan_id !== b.bahan_id) && (normName(x.nama_standar).indexOf(n) >= 0 || n.indexOf(normName(x.nama_standar)) >= 0 || normName(x.nama_alias).split(' ').join(' ').indexOf(n) >= 0 || (c && x.cas_number === c))).slice(0, 4) : [];
        $('#dupHint').innerHTML = sim.length ? `<span class="err-t">Mirip: ${sim.map(x => esc(x.bahan_id + ' ' + x.nama_standar)).join(', ')}</span>` : '';
        $('#casHint').innerHTML = c ? (isValidCAS(c) ? '<span class="ok-t">✓ Format & digit pemeriksa valid</span>' : '<span class="err-t">✗ CAS tidak valid</span>') : '';
      };
      nm.addEventListener('input', chk); cas.addEventListener('input', chk); chk();
    },
    onSubmit: async (vals, btn, form, h) => {
      const p = Object.assign({}, vals);
      p.kelas_bahaya = Object.keys(EN.ghs).filter(g => vals['ghs_' + g]).join(',');
      Object.keys(EN.ghs).forEach(g => delete p['ghs_' + g]);
      if (b) p.bahan_id = b.bahan_id;
      await act('simpanBahan', p, { btn, form, ok: b ? 'Bahan diperbarui.' : 'Bahan ditambahkan.' });
      h.close();
    }
  });
};
ACT.supForm = el => {
  const s = el && el.dataset && el.dataset.id ? App.idx.supplier.get(el.dataset.id) : {};
  formModal({ title: s.supplier_id ? 'Edit supplier' : 'Tambah supplier', cols: 2, fields: [{ name: 'nama', label: 'Nama', required: true, value: s.nama || '' }, { name: 'kontak_nama', label: 'Nama kontak', value: s.kontak_nama || '' }, { name: 'email', label: 'Email', type: 'email', value: s.email || '' }, { name: 'telepon', label: 'Telepon', value: s.telepon || '' }, { name: 'alamat', label: 'Alamat', value: s.alamat || '' }, { name: 'catatan', label: 'Catatan', value: s.catatan || '' }, { name: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Nonaktif'], value: s.status || 'Aktif', ph: '' }],
    onSubmit: async (v, btn, f, h) => { await act('simpanSupplier', Object.assign(v, { supplier_id: s.supplier_id || '' }), { btn, form: f, ok: 'Supplier tersimpan.' }); h.close(); } });
};
ACT.lokForm = el => {
  const l = el && el.dataset && el.dataset.id ? App.idx.lokasi.get(el.dataset.id) : {};
  formModal({ title: l.lokasi_id ? 'Edit lokasi' : 'Tambah lokasi', cols: 2, fields: [{ name: 'nama', label: 'Nama', required: true, value: l.nama || '', ph: 'Gudang A - Rak 3' }, { name: 'tipe', label: 'Tipe', type: 'select', required: true, options: EN.tipe_lokasi, value: l.tipe || 'Rak', ph: '' }, { name: 'suhu_target', label: 'Suhu target', value: l.suhu_target || '', ph: '2-8 C' }, { name: 'induk_lokasi_id', label: 'Induk lokasi', type: 'select', value: l.induk_lokasi_id || '', ph: '— tidak ada —', options: App.S.lokasi.filter(x => x.lokasi_id !== l.lokasi_id).map(x => ({ v: x.lokasi_id, t: x.nama })) }, { name: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Nonaktif'], value: l.status || 'Aktif', ph: '', help: 'Hanya bisa nonaktif bila kosong dari wadah aktif' }],
    onSubmit: async (v, btn, f, h) => { await act('simpanLokasi', Object.assign(v, { lokasi_id: l.lokasi_id || '' }), { btn, form: f, ok: 'Lokasi tersimpan.' }); h.close(); } });
};
ACT.konvForm = el => {
  const k = el && el.dataset && el.dataset.id ? App.S.konversi.find(x => x.konv_id === el.dataset.id) : {};
  formModal({ title: k.konv_id ? 'Edit konversi' : 'Tambah konversi', cols: 2, fields: [{ name: 'bahan_id', label: 'Berlaku untuk', type: 'select', value: k.bahan_id || '*', ph: '', options: [{ v: '*', t: '* Semua bahan' }].concat(App.S.bahan.filter(b => b.status === 'Aktif').map(b => ({ v: b.bahan_id, t: b.nama_standar }))) }, { name: 'dari_satuan', label: 'Dari satuan', required: true, value: k.dari_satuan || '', ph: 'drum / Box / Kg' }, { name: 'ke_satuan', label: 'Ke satuan dasar', type: 'select', required: true, value: k.ke_satuan || 'mL', options: EN.satuan_dasar, ph: '' }, { name: 'faktor', label: 'Faktor', type: 'number', step: 'any', min: 0, required: true, value: k.faktor || '' }, { name: 'keterangan', label: 'Keterangan', value: k.keterangan || '', ph: '1 drum = 200 L' }],
    onSubmit: async (v, btn, f, h) => { await act('simpanKonversi', Object.assign(v, { konv_id: k.konv_id || '', faktor: num(v.faktor) }), { btn, form: f, ok: 'Konversi tersimpan.' }); h.close(); } });
};
ACT.poForm = (el, ev, pre) => {
  const S = App.S; pre = pre || {};
  const isR = (pre.jenis || (el && el.dataset && el.dataset.j)) === 'Reservasi';
  const items = pre.items || [{ bahan_id: '', qty_pesan: '', satuan_pesan: '' }];
  const itemRow = (it, i) => { const b = App.idx.bahan.get(it.bahan_id); return `<div class="fgrid c3 poi" data-i="${i}" style="border-top:1px solid var(--rule);padding-top:8px"><div class="field"><label>Bahan #${i + 1}</label><select class="sel" name="b_${i}">${opts(S.bahan.filter(x => x.status === 'Aktif').map(x => ({ v: x.bahan_id, t: x.nama_standar })), it.bahan_id, 'Pilih…')}</select></div><div class="field"><label>Jumlah</label><input class="inp mono" name="q_${i}" type="number" step="any" min="0" value="${esc(it.qty_pesan)}"></div><div class="field"><label>Satuan</label><select class="sel" name="s_${i}">${opts(b ? unitsFor(b) : ['L', 'mL', 'Kg', 'g', 'pcs', 'Box'], it.satuan_pesan || (b ? b.satuan_dasar : ''))}</select></div></div>`; };
  const supOpts = S.supplier.filter(s => s.status === 'Aktif' && (isR || s.nama !== 'Warehouse Stock')).map(s => ({ v: s.supplier_id, t: s.nama }));
  const h = modal({ title: isR ? 'Buat reservasi gudang' : 'Buat purchase order', wide: true, body: `<form class="fgrid c3" id="poF"><input type="hidden" name="jenis" value="${isR ? 'Reservasi' : 'PO'}"><div class="field"><label>${isR ? 'No. reservasi' : 'Nomor PO'} <span class="req">*</span></label><input class="inp mono" name="po_no" value="${esc(pre.po_no || '')}" placeholder="${isR ? 'mis. RSV-2026-001' : 'PO-2026-0XX'}"></div><div class="field"><label>${isR ? 'Asal barang' : 'Supplier <span class="req">*</span>'}</label><select class="sel" name="supplier_id">${opts(supOpts, pre.supplier_id || '', isR ? 'Warehouse Stock (gudang)' : 'Pilih…')}</select></div><div class="field"><label>${isR ? 'Tanggal reservasi' : 'Tanggal PO'} <span class="req">*</span></label><input class="inp mono" type="date" name="tanggal_po" value="${today()}"></div><div class="field" style="grid-column:1/-1"><label>Catatan</label><input class="inp" name="catatan" value="${esc(pre.catatan || '')}"></div></form><div id="poItems" class="mt12">${items.map(itemRow).join('')}</div><button class="btn btn-sm mt8" data-add="1"><i class="bi bi-plus-lg"></i> Tambah item</button>`,
    foot: `<button class="btn" data-act="mclose">Batal</button><button class="btn btn-p" data-ok="1">${isR ? 'Simpan reservasi' : 'Simpan PO'}</button>` });
  const collect = () => $$('.poi', h.body).map(r => { const i = r.dataset.i; return { bahan_id: $(`[name=b_${i}]`, r).value, qty_pesan: num($(`[name=q_${i}]`, r).value), satuan_pesan: $(`[name=s_${i}]`, r).value }; });
  h.body.addEventListener('change', e => { if (/^b_/.test(e.target.name)) { const it = collect(); $('#poItems', h.body).innerHTML = it.map(itemRow).join(''); } });
  h.el.querySelector('[data-add]').onclick = () => { const it = collect(); it.push({ bahan_id: '', qty_pesan: '', satuan_pesan: '' }); $('#poItems', h.body).innerHTML = it.map(itemRow).join(''); };
  h.el.querySelector('[data-ok]').onclick = async e => {
    const f = formVals($('#poF', h.body)); const it = collect().filter(x => x.bahan_id && x.qty_pesan > 0);
    try { await act('simpanPO', Object.assign(f, { items: it }), { btn: e.currentTarget, form: $('#poF', h.body), ok: isR ? 'Reservasi tersimpan.' : 'PO tersimpan.' }); h.close(); } catch (er) { }
  };
};
ACT.poDraft = el => {
  const b = App.idx.bahan.get(el.dataset.b), s = App.idx.stat.get(b.bahan_id);
  const lastBatch = App.S.batch.filter(x => x.bahan_id === b.bahan_id && x.supplier_id).sort((x, y) => x.dibuat_pada < y.dibuat_pada ? 1 : -1)[0];
  App.ui.master.potab = 'PO';
  go('po');
  ACT.poForm(null, null, { po_no: 'PO-' + today().substr(0, 4) + '-', supplier_id: lastBatch ? lastBatch.supplier_id : '', catatan: `Saran reorder: posisi ${fmtQ(s.ps, b.satuan_dasar)} ≤ ROP ${fmtQ(s.rop, b.satuan_dasar)}`, items: [{ bahan_id: b.bahan_id, qty_pesan: s.q, satuan_pesan: b.satuan_dasar }] });
};
ACT.poTutup = async el => { const a = await ask({ title: 'Tutup sisa PO (K-03)', msg: 'Item dinyatakan selesai walau belum diterima penuh.', tone: 'warn', ok: 'Tutup sisa', input: { label: 'Alasan', required: true } }); if (a) await act('tutupSisaPO', { po_item_id: el.dataset.id, alasan: a }, { ok: 'Sisa PO ditutup.' }).catch(() => { }); };
ACT.poBatal = async el => { const a = await ask({ title: 'Batalkan PO', msg: 'PO tanpa penerimaan akan dibatalkan.', danger: true, ok: 'Batalkan PO', input: { label: 'Alasan', required: true } }); if (a) await act('simpanPO', { po_no: el.dataset.id, edit: true, status: 'Batal', alasan: a }, { ok: 'PO dibatalkan.' }).catch(() => { }); };
ACT.gabungGo = async el => {
  const s = $('#gbS').value, t = $('#gbT').value, a = $('#gbA').value.trim();
  if (!s || !t || !a) { toast('Lengkapi sumber, target, dan alasan.', 'err'); return; }
  if (!(await ask({ title: 'Konfirmasi penggabungan', msg: `${bahanName(s)} akan digabung ke ${bahanName(t)}. Tidak dapat dibatalkan dari aplikasi.`, danger: true, ok: 'Gabungkan' }))) return;
  await act('gabungBahan', { sumber_id: s, target_id: t, alasan: a }, { btn: el, ok: d => `Digabung: ${d.moved} referensi dipindah.` }).catch(() => { });
};

// ════════════════════════════════════════════════════════
// BAGIAN 14: AUDIT TRAIL & LAPORAN [W-11]
// ════════════════════════════════════════════════════════

const REPORTS = {
  amb_user: { t: 'Pengambilan per pengguna & tujuan', src: 'pengambilan' }, self: { t: 'Pengambilan disetujui diri sendiri', src: 'pengambilan' },
  override: { t: 'Override FEFO', src: 'pengambilan' }, terima_po: { t: 'Penerimaan vs PO', src: 'penerimaan' }, tanpa_po: { t: 'Penerimaan tanpa PO', src: 'penerimaan' },
  opname: { t: 'Selisih opname', src: 'opname' }, grafik: { t: 'Grafik pemakaian & kepatuhan', src: 'pengambilan' }
};
RENDER.audit = el => {
  const U = App.ui.audit;
  if (!U.dari) { U.dari = addDays(today(), -90); U.sampai = today(); }
  const tabs = `<div class="subtabs">${[['audit', 'Riwayat aktivitas'], ['laporan', 'Laporan']].map(t => `<button class="subtab ${U.tab === t[0] ? 'on' : ''}" data-act="auditTab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  if (U.tab === 'audit') {
    const f = U.f;
    el.innerHTML = tabs + `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-journal-text"></i> Catatan aktivitas (tidak bisa diubah)</span><span class="idx">US-16</span></div>
      <div class="panel-b"><form class="fgrid c4" data-sub="auditF"><div class="field"><label>Kata kunci</label><input class="inp" name="q" value="${esc(f.q || '')}" placeholder="ID / nilai / alasan"></div>
        <div class="field"><label>Aksi</label><select class="sel" name="aksi">${opts(['BUAT', 'UBAH', 'STATUS', 'KOREKSI', 'OVERRIDE', 'REVERSAL', 'LOGIN_GAGAL', 'UBAH_PASSWORD', 'RESET_PASSWORD', 'PENGATURAN', 'EKSPOR', 'CETAK_LABEL', 'PERINGATAN'], f.aksi || '', 'Semua')}</select></div>
        <div class="field"><label>Pengguna</label><select class="sel" name="pengguna">${opts(App.S.users.map(u => ({ v: u.user_id, t: u.nama })), f.pengguna || '', 'Semua')}</select></div>
        <div class="field"><label>Entitas</label><select class="sel" name="entitas">${opts(['Wadah', 'Pengambilan', 'Penerimaan', 'Master_Bahan', 'Supplier', 'Lokasi', 'SDS', 'PO_Header', 'PO_Item', 'Stok_Opname', 'Users', 'Pengaturan', 'Konversi_Satuan', 'Batch'], f.entitas || '', 'Semua')}</select></div>
        <div class="field"><label>Dari</label><input class="inp mono" type="date" name="dari" value="${esc(f.dari || '')}"></div><div class="field"><label>Sampai</label><input class="inp mono" type="date" name="sampai" value="${esc(f.sampai || '')}"></div>
        <div class="field" style="justify-content:flex-end"><button class="btn btn-p" type="submit"><i class="bi bi-funnel"></i> Terapkan</button></div><div class="field" style="justify-content:flex-end"><button class="btn" type="button" data-act="auditExport"><i class="bi bi-download"></i> Ekspor</button></div></form></div>
      <div class="tbl-wrap soft" style="border:0;border-top:1px solid var(--rule)"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Entitas</th><th>Record</th><th>Kolom</th><th>Nilai lama</th><th>Nilai baru</th><th>Alasan</th></tr></thead><tbody id="auditBody">
      ${U.rows ? auditRows(U.rows) : `<tr><td colspan="9">${empty('Memuat audit log…', 'bi-hourglass')}</td></tr>`}</tbody></table></div>
      <div class="panel-f"><span class="t-sm muted">${U.rows ? `Menampilkan ${U.offset + 1}–${U.offset + U.rows.length} dari ${U.total}` : ''}</span><span class="row"><button class="btn btn-sm" data-act="auditPage" data-d="-1" ${U.offset ? '' : 'disabled'}>← Sebelumnya</button><button class="btn btn-sm" data-act="auditPage" data-d="1" ${U.rows && U.offset + U.rows.length < U.total ? '' : 'disabled'}>Berikutnya →</button></span></div></div>`;
    if (!U.rows) loadAudit();
    return;
  }
  el.innerHTML = tabs + `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-file-earmark-bar-graph"></i> Laporan</span></div><div class="panel-b">
    <div class="fgrid c4"><div class="field"><label>Jenis laporan</label><select class="sel" data-ch="repJenis">${opts(Object.keys(REPORTS).map(k => ({ v: k, t: REPORTS[k].t })), U.rep)}</select></div>
      <div class="field"><label>Dari</label><input class="inp mono" type="date" value="${esc(U.dari)}" data-ch="repDari"></div><div class="field"><label>Sampai</label><input class="inp mono" type="date" value="${esc(U.sampai)}" data-ch="repSampai"></div>
      <div class="field" style="justify-content:flex-end"><button class="btn btn-p" data-act="repLoad"><i class="bi bi-arrow-repeat"></i> Tampilkan</button></div></div></div>
    <div id="repOut">${U.repData ? '' : `<div class="panel-b">${empty('Pilih laporan dan rentang tanggal, lalu Tampilkan. Angka dihitung dari ledger/transaksi.', 'bi-bar-chart')}</div>`}</div></div>`;
  if (U.repData) renderReport();
};
function auditRows(rows) {
  return rows.map(r => `<tr><td class="mono t-sm nowrap">${esc(r.waktu)}</td><td class="t-sm">${esc(userName(r.pengguna))}</td><td><span class="bdg ${/DITOLAK|OVERRIDE|REVERSAL/.test(r.aksi) ? 's-ex' : /KOREKSI|PERINGATAN/.test(r.aksi) ? 's-sk' : 's-hb'}">${esc(r.aksi)}</span></td><td>${esc(r.entitas)}</td><td class="id">${esc(r.record_id)}</td><td class="t-sm">${esc(r.kolom)}</td>
    <td class="t-sm mono" style="max-width:220px;word-break:break-word">${esc(String(r.nilai_lama).substr(0, 200))}</td><td class="t-sm mono" style="max-width:220px;word-break:break-word">${esc(String(r.nilai_baru).substr(0, 200))}</td><td class="t-sm">${esc(r.alasan)}</td></tr>`).join('') || `<tr><td colspan="9">${empty('Tidak ada entri.')}</td></tr>`;
}
async function loadAudit() {
  const U = App.ui.audit;
  try { const d = await rpc('getAuditLog', Object.assign({}, U.f, { offset: U.offset, limit: 100 })); U.rows = d.rows; U.total = d.total; } catch (e) { U.rows = []; U.total = 0; showErr(e); }
  if (App.view === 'audit') render('audit');
}
SUB.auditF = f => { App.ui.audit.f = formVals(f); App.ui.audit.offset = 0; App.ui.audit.rows = null; render('audit'); };
ACT.auditTab = el => { App.ui.audit.tab = el.dataset.t; render('audit'); };
ACT.auditPage = el => { const U = App.ui.audit; U.offset = Math.max(0, U.offset + (+el.dataset.d) * 100); U.rows = null; render('audit'); };
ACT.auditExport = async el => {
  try { const d = await act('getAuditLog', Object.assign({}, App.ui.audit.f, { offset: 0, limit: 500 }), { btn: el, busy: 'Mengambil…' }); exportRows('audit_log', d.rows, ['waktu', 'pengguna', 'aksi', 'entitas', 'record_id', 'kolom', 'nilai_lama', 'nilai_baru', 'alasan'].map(k => ({ k }))); } catch (e) { }
};
CH.repJenis = el => { App.ui.audit.rep = el.value; App.ui.audit.repData = null; render('audit'); };
CH.repDari = el => { App.ui.audit.dari = el.value; };
CH.repSampai = el => { App.ui.audit.sampai = el.value; };
ACT.repLoad = async el => {
  const U = App.ui.audit, R = REPORTS[U.rep];
  try { U.repData = await act('getLaporan', { jenis: R.src, dari: U.dari, sampai: U.sampai }, { btn: el, busy: 'Menghitung…' }); U.repKey = U.rep; renderReport(); } catch (e) { }
};
function renderReport() {
  const U = App.ui.audit, out = $('#repOut'); if (!out) return;
  const I = App.idx, d = U.repData, k = U.repKey;
  const yes = v => v === true || v === 'true';
  let cols = [], rows = [], extra = '';
  const tbl = () => `<div class="tbl-wrap soft" style="border:0;border-top:1px solid var(--rule)"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.num ? 'num' : ''} ${c.mono ? 'mono' : ''}">${esc(c.f ? c.f(r) : r[c.k])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">${empty('Tidak ada data pada rentang ini.')}</td></tr>`}</tbody></table></div>`;
  if (k === 'amb_user') {
    const piv = {}; d.filter(r => r.status === 'Disetujui' && !r.dibalik_oleh).forEach(r => { const key = r.pengambil + '|' + r.tujuan + '|' + r.bahan_id; const p = piv[key] = piv[key] || { pengambil: r.pengambil, tujuan: r.tujuan, bahan_id: r.bahan_id, n: 0, qty: 0 }; p.n++; p.qty += num(r.qty_diambil_dasar); });
    rows = Object.values(piv).sort((a, b) => a.pengambil.localeCompare(b.pengambil) || b.qty - a.qty);
    cols = [{ t: 'Pengguna', f: r => userName(r.pengambil) }, { t: 'Tujuan', k: 'tujuan' }, { t: 'Bahan', f: r => bahanName(r.bahan_id) }, { t: 'Transaksi', k: 'n', num: 1 }, { t: 'Jumlah', f: r => fmtQ(r.qty, (I.bahan.get(r.bahan_id) || {}).satuan_dasar), num: 1 }];
  } else if (k === 'self' || k === 'override') {
    rows = d.filter(r => k === 'self' ? yes(r.self_approved) : yes(r.override_fefo));
    cols = [{ t: 'Waktu', k: 'waktu', mono: 1 }, { t: 'ID', k: 'ambil_id', mono: 1 }, { t: 'Wadah', k: 'wadah_id', mono: 1 }, { t: 'Bahan', f: r => bahanName(r.bahan_id) }, { t: 'Pengambil', f: r => userName(r.pengambil) }, { t: 'Penyetuju', f: r => userName(r.penyetuju) }, { t: 'Jumlah', f: r => fmtQ(r.qty_diambil_dasar, (I.bahan.get(r.bahan_id) || {}).satuan_dasar), num: 1 }].concat(k === 'override' ? [{ t: 'Saran FEFO', k: 'saran_fefo_wadah_id', mono: 1 }, { t: 'Alasan', k: 'alasan_override' }] : [{ t: 'Tujuan', k: 'tujuan' }]);
    const tot = d.filter(r => r.status === 'Disetujui').length;
    extra = `<div class="panel-b"><div class="note ${rows.length ? 'warn' : 'ok'}"><i class="bi bi-info-square"></i><div>${rows.length} dari ${tot} baris pengambilan (${fmtN(tot ? rows.length / tot * 100 : 0, 1)}%).${k === 'override' ? ` Kepatuhan FEFO: <b>${fmtN(tot ? 100 - rows.length / tot * 100 : 100, 1)}%</b> (target ≥ 90%).` : ''}</div></div></div>`;
  } else if (k === 'terima_po' || k === 'tanpa_po') {
    rows = d.filter(r => k === 'tanpa_po' ? !r.po_item_id : !!r.po_item_id);
    cols = [{ t: 'Tanggal', k: 'tanggal_terima', mono: 1 }, { t: 'ID', k: 'terima_id', mono: 1 }, { t: 'Bahan', f: r => bahanName(r.bahan_id) }, { t: 'Supplier', f: r => (I.supplier.get(r.supplier_id) || {}).nama || '' }, { t: 'Diterima', f: r => fmtN(r.qty_terima) + ' ' + r.satuan_terima, num: 1 }, { t: 'Dasar', f: r => fmtQ(r.qty_terima_dasar, (I.bahan.get(r.bahan_id) || {}).satuan_dasar), num: 1 }, { t: 'Wadah', k: 'jumlah_wadah', num: 1 }]
      .concat(k === 'tanpa_po' ? [{ t: 'Alasan', k: 'tanpa_po_alasan' }] : [{ t: 'Item PO', f: r => { const i = I.poItem.get(r.po_item_id); return i ? i.po_no + ' / ' + r.po_item_id : r.po_item_id; } }, { t: 'Selisih', f: r => fmtN(r.selisih_dasar), num: 1 }, { t: 'Alasan selisih', k: 'alasan_selisih' }]).concat([{ t: 'Penerima', f: r => userName(r.penerima) }]);
  } else if (k === 'opname') {
    const ses = {}; d.sesi.forEach(s => ses[s.opname_id] = s);
    rows = d.detail.filter(x => x.hasil !== 'Cocok');
    cols = [{ t: 'Sesi', k: 'opname_id', mono: 1 }, { t: 'Tanggal', f: r => String((ses[r.opname_id] || {}).tanggal_mulai || '').substr(0, 10), mono: 1 }, { t: 'Wadah', k: 'wadah_id', mono: 1 }, { t: 'Hasil', k: 'hasil' }, { t: 'Sistem', k: 'stok_sistem_dasar', num: 1 }, { t: 'Fisik', k: 'stok_fisik_dasar', num: 1 }, { t: 'Selisih', k: 'selisih_dasar', num: 1 }, { t: '%', k: 'selisih_pct', num: 1 }, { t: 'Keputusan', k: 'keputusan' }, { t: 'Catatan', k: 'catatan' }];
    const all = d.detail.length, ok = d.detail.filter(x => x.hasil === 'Cocok' || x.hasil === 'Dalam toleransi').length;
    extra = `<div class="panel-b"><div class="note"><i class="bi bi-clipboard-data"></i><div>${d.sesi.length} sesi · ${all} wadah diperiksa · akurasi (cocok + dalam toleransi): <b>${fmtN(all ? ok / all * 100 : 0, 1)}%</b> (target ≥ 95%).</div></div></div>`;
  } else if (k === 'grafik') {
    out.innerHTML = `<div class="grid g-half panel-b"><div><div class="lbl">Pemakaian per kategori per minggu</div><div class="chart-box"><canvas id="cKat"></canvas></div></div><div><div class="lbl">Kepatuhan FEFO per minggu (%)</div><div class="chart-box"><canvas id="cFefo"></canvas></div></div><div><div class="lbl">Stok efektif per kategori (saat ini, jumlah wadah)</div><div class="chart-box"><canvas id="cStok"></canvas></div></div></div>`;
    drawReportCharts(d); return;
  }
  out.innerHTML = extra + tbl() + `<div class="panel-f"><span class="t-sm muted">${rows.length} baris · ${esc(U.dari)} s.d. ${esc(U.sampai)}</span><span class="row"><button class="btn btn-sm" data-act="repCsv"><i class="bi bi-filetype-csv"></i> CSV</button><button class="btn btn-sm" data-act="repPrint"><i class="bi bi-filetype-pdf"></i> Cetak / PDF</button></span></div>`;
  U._exp = { rows, cols };
}
ACT.repCsv = () => { const e = App.ui.audit._exp; if (e) exportRows('laporan_' + App.ui.audit.repKey, e.rows, e.cols.map(c => ({ t: c.t, f: c.f, k: c.k }))); };
ACT.repPrint = () => { const t = $('#repOut table'); if (t) printHtml(`<h3 style="font-family:Space Grotesk">${esc(REPORTS[App.ui.audit.repKey].t)} — ${esc(App.ui.audit.dari)} s.d. ${esc(App.ui.audit.sampai)}</h3><div style="font:10px Geist">${t.outerHTML}</div>`); };
function drawReportCharts(d) {
  if (!window.Chart) return;
  const I = App.idx, cs = getComputedStyle(document.documentElement), c = v => cs.getPropertyValue(v).trim();
  const pal = ['#1E5AA8', '#17653F', '#92400E', '#B42318', '#4C3490', '#52606D', '#0E7490', '#7C2D12'];
  const wk = s => { const dd = daysBetween(App.ui.audit.dari, String(s).substr(0, 10)); return Math.floor(dd / 7); };
  const nW = Math.max(1, Math.ceil((daysBetween(App.ui.audit.dari, App.ui.audit.sampai) + 1) / 7));
  const labels = Array.from({ length: nW }, (_, i) => addDays(App.ui.audit.dari, i * 7).substr(5));
  const ok = d.filter(r => r.status === 'Disetujui' && !r.dibalik_oleh);
  const kats = {}; ok.forEach(r => { const b = I.bahan.get(r.bahan_id) || {}; const kk = b.kategori || 'Lainnya'; (kats[kk] = kats[kk] || Array(nW).fill(0))[Math.min(nW - 1, Math.max(0, wk(r.waktu)))]++; });
  const base = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { color: c('--text'), font: { family: 'JetBrains Mono', size: 10 } } } }, scales: { x: { stacked: true, grid: { color: c('--rule') }, ticks: { color: c('--muted') } }, y: { stacked: true, beginAtZero: true, grid: { color: c('--rule') }, ticks: { color: c('--muted') } } } };
  App.charts['audit:kat'] = new Chart($('#cKat'), { type: 'bar', data: { labels, datasets: Object.keys(kats).map((k, i) => ({ label: k + ' (transaksi)', data: kats[k], backgroundColor: pal[i % pal.length] })) }, options: base });
  const tot = Array(nW).fill(0), ov = Array(nW).fill(0); ok.forEach(r => { const i = Math.min(nW - 1, Math.max(0, wk(r.waktu))); tot[i]++; if (r.override_fefo === true || r.override_fefo === 'true') ov[i]++; });
  App.charts['audit:fefo'] = new Chart($('#cFefo'), { type: 'line', data: { labels, datasets: [{ label: 'Kepatuhan FEFO %', data: tot.map((t, i) => t ? r4(100 - ov[i] / t * 100) : null), borderColor: c('--cobalt'), borderWidth: 2, spanGaps: true }, { label: 'Target 90%', data: Array(nW).fill(90), borderColor: c('--err'), borderDash: [6, 4], pointRadius: 0 }] }, options: Object.assign({}, base, { scales: { x: { grid: { color: c('--rule') }, ticks: { color: c('--muted') } }, y: { min: 0, max: 100, grid: { color: c('--rule') }, ticks: { color: c('--muted') } } } }) });
  const sk = {}; App.S.wadah.filter(w => AKTIF.indexOf(dispStatus(w)) >= 0).forEach(w => { const kk = (I.bahan.get(w.bahan_id) || {}).kategori || 'Lainnya'; sk[kk] = (sk[kk] || 0) + 1; });
  App.charts['audit:stok'] = new Chart($('#cStok'), { type: 'bar', data: { labels: Object.keys(sk), datasets: [{ label: 'Wadah aktif', data: Object.values(sk), backgroundColor: c('--ink') }] }, options: Object.assign({}, base, { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: c('--rule') }, ticks: { color: c('--muted') } }, y: { grid: { display: false }, ticks: { color: c('--text') } } } }) });
}

// ════════════════════════════════════════════════════════
// BAGIAN 15: PENGATURAN (Admin)
// ════════════════════════════════════════════════════════

RENDER.pengaturan = el => {
  const U = App.ui.peng, S = App.S;
  const tabs = `<div class="subtabs">${[['users', 'Pengguna & peran'], ['sistem', 'Aturan sistem'], ['job', 'Jadwal otomatis']].map(t => `<button class="subtab ${U.tab === t[0] ? 'on' : ''}" data-act="pengTab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>`;
  if (U.tab === 'users') {
    el.innerHTML = tabs + `<div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-people"></i> Pengguna</span><button class="btn btn-sm btn-p" data-act="userForm"><i class="bi bi-person-plus"></i> Tambah pengguna</button></div>
      <div class="tbl-wrap soft" style="border:0"><table class="tbl"><thead><tr><th>ID</th><th>Nama pengguna</th><th>Peran</th><th>Status</th><th></th></tr></thead><tbody>
      ${S.users.map(u => `<tr><td class="id">${esc(u.user_id)}</td><td><span class="row"><span class="avatar" style="width:24px;height:24px;font-size:10px">${esc(initials(u.nama))}</span><b>${esc(u.nama)}</b></span></td><td>${esc(u.peran)}</td><td>${bdg(u.status)}</td><td><button class="btn btn-sm" data-act="userForm" data-id="${esc(u.user_id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>
      <div class="panel-f t-sm"><span>Semua peran memiliki hak operasional setara; Admin juga mengelola pengguna, pengaturan, dan penggabungan master. Minimal satu Admin aktif wajib ada.</span></div></div>`;
    return;
  }
  if (U.tab === 'sistem') {
    const s = S.settings;
    const groups = [['Notifikasi', ['notif_recipients', 'notif_digest_time', 'expiry_warning_days', 'sds_warning_days']], ['Pengambilan & persetujuan', ['approval_mode', 'allow_self_approval', 'block_on_expired_sds', 'allow_expiry_extension']],
      ['Reorder', ['usage_window_weeks', 'default_lead_time_days', 'service_level_default', 'service_level_critical', 'review_period_weeks']], ['Opname & arsip', ['opname_tolerance_open_pct', 'opname_due_days', 'archive_after_days', 'overdelivery_tolerance_pct', 'sds_validity_years']],
      ['Identitas & akses', ['lab_name', 'label_size']]];
    const field = k => { const v = s[k] === undefined ? '' : s[k];
      if (k === 'approval_mode') return `<div class="field"><label>${esc(k)}</label><select class="sel" name="${k}">${opts(['SATU_LANGKAH', 'DUA_LANGKAH'], v)}</select></div>`;
      if (/^(allow_|block_)/.test(k)) return `<div class="field"><label>${esc(k)}</label><select class="sel" name="${k}">${opts(['TRUE', 'FALSE'], String(v).toUpperCase())}</select></div>`;
      return `<div class="field"><label>${esc(k)}</label><input class="inp mono" name="${k}" value="${esc(v)}"></div>`; };
    el.innerHTML = tabs + `<form data-sub="setF">${groups.map(g => `<div class="panel frame mb8"><div class="panel-h"><span class="ttl">${g[0]}</span></div><div class="panel-b fgrid c4">${g[1].map(field).join('')}</div></div>`).join('')}
      <div class="commit"><span class="t-sm muted">Perubahan tercatat di audit log (PENGATURAN). Ubah jam digest → jalankan "Pasang trigger" ulang.</span><div class="act"><button class="btn btn-p btn-lg" type="submit"><i class="bi bi-save"></i> Simpan pengaturan</button></div></div></form>`;
    return;
  }
  const j = S.jobs || {};
  const jl = k => j[k] ? `${bdg(j[k].status === 'OK' ? 'Terkirim' : 'Gagal', j[k].status === 'OK' ? 'Selesai' : 'Gagal')} <span class="mono t-sm">${esc(j[k].waktu)}</span><div class="t-sm muted">${esc(j[k].pesan)}</div>` : '<span class="muted">Belum pernah dijalankan</span>';
  el.innerHTML = tabs + `<div class="grid g-half"><div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-clock"></i> Pekerjaan terjadwal (5.7)</span></div>
    <div class="led"><b>Harian</b> — status kedaluwarsa, SDS, arsip, draf yatim, rekonsiliasi ledger, notifikasi digest<div class="mt8">${jl('HARIAN')}</div><button class="btn btn-sm mt8" data-act="runJob" data-j="HARIAN">Jalankan sekarang</button></div>
    <div class="led"><b>Mingguan</b> — hitung ulang reorder AUTO &amp; cadangan spreadsheet (8 salinan)<div class="mt8">${jl('MINGGUAN')}</div><span class="row mt8"><button class="btn btn-sm" data-act="runJob" data-j="MINGGUAN">Jalankan sekarang</button><button class="btn btn-sm" data-act="runJob" data-j="REORDER">Reorder saja</button><button class="btn btn-sm" data-act="runJob" data-j="CADANGAN">Cadangan saja</button></span></div>
    <div class="panel-f"><button class="btn btn-p" data-act="pasangTrigger"><i class="bi bi-alarm"></i> Pasang / perbarui trigger</button><button class="btn" data-act="flushCache"><i class="bi bi-arrow-clockwise"></i> Bersihkan cache server</button></div></div>
    <div class="panel frame"><div class="panel-h"><span class="ttl"><i class="bi bi-activity"></i> Status sistem</span></div><div class="panel-b kv">
      <div><div class="k">Versi app</div><div class="v">${esc(S.app)}</div></div><div><div class="k">Versi data</div><div class="v">${esc(String(S.ver).slice(-8))}</div></div><div><div class="k">Zona waktu</div><div class="v">${esc(S.tz)}</div></div>
      <div><div class="k">Sel spreadsheet</div><div class="v">${S.sheet_cells ? fmtN(S.sheet_cells, 0) : '—'} / 10 jt</div></div><div><div class="k">Sisa kuota email</div><div class="v">${S.quota === null || S.quota === undefined ? '—' : S.quota}</div></div><div><div class="k">Notifikasi gagal</div><div class="v ${S.notif_gagal ? 'err-t' : ''}">${S.notif_gagal || 0}</div></div>
      <div><div class="k">Wadah arsip</div><div class="v">${S.arsip_count}</div></div><div><div class="k">Outbox perangkat</div><div class="v">${App.outbox.length}</div></div><div><div class="k">Latensi terakhir</div><div class="v">${App.lastLat === null ? '—' : App.lastLat + ' ms'}</div></div></div></div></div>`;
};
ACT.pengTab = el => { App.ui.peng.tab = el.dataset.t; render('pengaturan'); };
SUB.setF = async f => { await act('simpanPengaturan', { values: formVals(f) }, { btn: $('button[type=submit]', f), form: f, ok: 'Pengaturan disimpan.' }).then(() => syncNow(true)).catch(() => { }); };
ACT.userForm = el => {
  const u = el && el.dataset && el.dataset.id ? App.idx.usersById.get(el.dataset.id) : {};
  const baru = !u.user_id;
  formModal({ title: baru ? 'Tambah pengguna' : 'Edit pengguna', cols: 2,
    intro: `<p class="help" style="margin:0 0 12px">Nama dipakai untuk masuk. ${baru ? 'Pengguna akan diminta membuat password sendiri saat pertama masuk.' : 'Isi password hanya bila ingin mengatur ulang (pengguna lupa password).'}</p>`,
    fields: [{ name: 'nama', label: 'Nama pengguna', required: true, value: u.nama || '' },
      { name: 'password', label: baru ? 'Password awal' : 'Password baru (opsional)', type: 'password', required: baru, value: '', help: 'Minimal 6 karakter' },
      { name: 'peran', label: 'Peran', type: 'select', required: true, options: EN.peran, value: u.peran || 'Analyst', ph: '' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: ['Aktif', 'Nonaktif'], value: u.status || 'Aktif', ph: '' }],
    onSubmit: async (v, btn, f, h) => { await act('simpanUser', Object.assign(v, { user_id: u.user_id || '' }), { btn, form: f, ok: baru ? 'Pengguna ditambahkan.' : (v.password ? 'Pengguna disimpan & password diatur ulang.' : 'Pengguna tersimpan.') }); h.close(); } });
};
ACT.ubahPassword = () => {
  $('#userMenu').classList.add('hidden');
  formModal({ title: 'Ubah password', fields: [{ name: 'lama', label: 'Password sekarang', type: 'password', required: true }, { name: 'baru', label: 'Password baru', type: 'password', required: true, help: 'Minimal 6 karakter' }, { name: 'ulang', label: 'Ulangi password baru', type: 'password', required: true }],
    onSubmit: async (v, btn, f, h) => {
      if (v.baru !== v.ulang) { toast('Ulangan password baru tidak sama.', 'err'); return; }
      await act('ubahPassword', { lama: v.lama, baru: v.baru }, { btn, form: f, ok: 'Password berhasil diganti.' }); h.close();
    } });
};
ACT.togglePass = el => { const i = document.getElementById(el.dataset.for); if (!i) return; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}"></i>`; };
ACT.sideToggle = () => { const a = $('#app'); const min = !a.classList.contains('side-min'); a.classList.toggle('side-min', min); try { localStorage.setItem('ci_side', min ? 'min' : ''); } catch (e) { } };
ACT.runJob = async el => { try { const d = await act('jalankanJob', { job: el.dataset.j }, { btn: el, busy: 'Menjalankan…' }); toast('Selesai: ' + [].concat(d.info || []).join(' | '), 'ok'); syncNow(true); } catch (e) { } };
ACT.pasangTrigger = async el => { try { const d = await act('pasangTrigger', {}, { btn: el }); toast(d.info, 'ok'); } catch (e) { } };
ACT.flushCache = async el => { try { await act('bersihkanCache', {}, { btn: el }); await syncNow(true); toast('Cache server dibersihkan & data dimuat ulang.', 'ok'); } catch (e) { } };

// ════════════════════════════════════════════════════════
// BAGIAN 16: PENCARIAN GLOBAL
// ════════════════════════════════════════════════════════

/** Buka botol/bahan dari kode yang diketik di kotak cari. */
function openByCode(raw) {
  const code = String(raw || '').trim().toUpperCase();
  if (!code) return;
  if (App.idx.wadah.get(code)) return openWadah(code);
  if (App.idx.bahan.get(code)) { App.ui.stok.mode = 'katalog'; App.ui.stok.sel = code; return go('stok'); }
  if (/^WDH-/.test(code)) return openWadah(code, true);
  toast(`"${raw}" tidak ditemukan.`, 'warn');
}

// Pencarian global (lokal, instan)
let gSel = 0;
IN.gsearch = el => {
  const q = el.value.trim(), drop = $('#gDrop');
  if (q.length < 2) { drop.classList.add('hidden'); return; }
  const n = normName(q), up = q.toUpperCase(), I = App.idx, res = [];
  App.S.bahan.forEach(b => { if (res.length < 8 && (normName(b.nama_standar + ' ' + b.nama_alias + ' ' + b.bahan_id).indexOf(n) >= 0 || String(b.cas_number) === q)) res.push({ t: 'b', id: b.bahan_id, a: b.nama_standar, s: `CAS ${b.cas_number || '—'} · ${fmtQ(I.stat.get(b.bahan_id).ef, b.satuan_dasar)} · ${b.status}` }); });
  App.S.wadah.forEach(w => { if (res.length < 14 && w.wadah_id.indexOf(up) >= 0) res.push({ t: 'w', id: w.wadah_id, a: w.wadah_id, s: `${bahanName(w.bahan_id)} · ${dispStatus(w)} · ${lokName(w.lokasi_id)}` }); });
  App.S.batch.forEach(bt => { if (res.length < 18 && String(bt.nomor_batch).toUpperCase().indexOf(up) >= 0) res.push({ t: 'b', id: bt.bahan_id, a: 'Batch ' + bt.nomor_batch, s: bahanName(bt.bahan_id) + ' · ' + bt.batch_id }); });
  gSel = 0;
  drop.innerHTML = res.map((r, i) => `<button class="${i === 0 ? 'on' : ''}" data-act="gPick" data-t="${r.t}" data-id="${esc(r.id)}" role="option"><i class="bi ${r.t === 'w' ? 'bi-droplet-half' : 'bi-flask'}"></i><span><b>${esc(r.a)}</b><br><span class="t-sm muted">${esc(r.s)}</span></span></button>`).join('') || `<div class="p12 muted">Tidak ditemukan. Tekan Enter untuk pindai ID.</div>`;
  drop.classList.remove('hidden');
};
ACT.gPick = el => { closeDrop(); $('#gSearch').value = ''; if (el.dataset.t === 'w') openWadah(el.dataset.id); else { App.ui.stok.mode = 'katalog'; App.ui.stok.sel = el.dataset.id; App.ui.stok.q = ''; go('stok'); } };
function closeDrop() { const d = $('#gDrop'); if (d) d.classList.add('hidden'); }

// Panel peringatan & menu pengguna
ACT.notifPanel = () => {
  const a = alerts();
  const h = modal({ title: `Peringatan (${a.length})`, drawer: true, body: a.length ? a.map((x, i) => `<div class="led row between"><div><span class="bdg ${/KEDALUWARSA|STOK|SDS/.test(x.t) ? 's-ex' : 's-sk'}">${esc(x.t.replace('_', ' '))}</span><div class="mt8">${esc(x.m)}</div></div><button class="btn btn-sm" data-ni="${i}">Buka</button></div>`).join('') : empty('Tidak ada peringatan.', 'bi-check2-square') });
  $$('[data-ni]', h.body).forEach(b => b.onclick = () => { const x = a[+b.dataset.ni]; h.close(); if (x.w) openWadah(x.w); else if (x.go) { if (x.go[0] === 'stok') { App.ui.stok.mode = 'katalog'; App.ui.stok.sel = x.go[1]; } go(x.go[0]); } });
};
ACT.userMenu = (el, ev) => {
  ev.stopPropagation();
  const m = $('#userMenu');
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  m.innerHTML = `<div class="p12" style="border-bottom:1px solid var(--rule)"><b>${esc(App.user.nama)}</b><div class="t-sm">${esc(App.user.peran)}</div></div>
    <button data-act="theme"><i class="bi ${dark ? 'bi-sun' : 'bi-moon-stars'}"></i> Mode ${dark ? 'terang' : 'gelap'}</button>
    <button data-act="ubahPassword"><i class="bi bi-key"></i> Ubah password</button>
    <button data-act="syncNow"><i class="bi bi-arrow-repeat"></i> Muat ulang data</button>
    ${App.outbox.length ? `<button data-act="outboxView"><i class="bi bi-cloud-upload"></i> Data menunggu dikirim (${App.outbox.length})</button>` : ''}
    <button data-act="shortcuts"><i class="bi bi-keyboard"></i> Pintasan keyboard</button>
    <button data-act="logout"><i class="bi bi-box-arrow-left"></i> Keluar</button>`;
  m.classList.toggle('hidden');
};
ACT.theme = () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t); ls('ci_theme', null); try { localStorage.setItem('ci_theme', t); } catch (e) { }
  $('#userMenu').classList.add('hidden'); render(App.view);
};
ACT.shortcuts = () => { $('#userMenu').classList.add('hidden'); modal({ title: 'Pintasan keyboard', body: `<table class="tbl">${[['F2', 'Penerimaan'], ['F3', 'Pengambilan'], ['F4', 'Stok opname'], ['Ctrl+K', 'Cari global'], ['Ctrl+Enter', 'Konfirmasi pengambilan'], ['F10', 'Simpan penerimaan'], ['Esc', 'Tutup dialog']].map(r => `<tr><td><span class="kbd">${r[0]}</span></td><td>${r[1]}</td></tr>`).join('')}</table>` }); };
ACT.outboxView = () => { $('#userMenu').classList.add('hidden'); modal({ title: 'Transaksi tertunda (outbox)', body: App.outbox.map(o => `<div class="led"><b>${esc(o.label)}</b><div class="t-sm mono muted">${esc(o.id)} · ${new Date(o.t).toLocaleString('id-ID')}</div></div>`).join('') + '<p class="help mt8">Dikirim ulang otomatis saat koneksi pulih. Aman dari duplikasi (request_id).</p>', foot: '<button class="btn btn-p" data-act="flushNow">Kirim sekarang</button>' }); };
ACT.flushNow = () => { App.modals.slice().forEach(m => m.close()); flushOutbox(); };
ACT.logout = async () => {
  if (App.outbox.length && !(await ask({ title: 'Masih ada transaksi tertunda', msg: `${App.outbox.length} transaksi belum terkirim. Keluar tetap menyimpannya di perangkat ini.`, ok: 'Tetap keluar' }))) return;
  try { await rpc('logout', {}); } catch (e) { }
  App.token = null; try { sessionStorage.clear(); } catch (e) { }
  $('#app').classList.add('hidden'); showLogin({});
};
ACT.syncNow = () => { const m = $('#userMenu'); if (m) m.classList.add('hidden'); syncNow(true).then(() => toast('Data mutakhir.', 'ok')); };
ACT.mclose = el => { const m = App.modals.find(h => h.el.contains(el)); if (m) m.close(); };
ACT.go = el => {
  const v = el.dataset.v;
  if (v === 'stok' && el.dataset.mode) App.ui.stok.mode = el.dataset.mode;
  if (v === 'ambil' && !App.amb) App.amb = ambNew();
  if ((v === 'po' || v === 'master') && App.view !== v) App.ui.master.q = '';
  go(v);
};
ACT.none = () => { };

// ════════════════════════════════════════════════════════
// BAGIAN 17: EVENT GLOBAL, PINTASAN, PEMINDAI WEDGE
// ════════════════════════════════════════════════════════

function bindEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!e.target.closest('#userMenu') && !e.target.closest('.user-box')) { const m = $('#userMenu'); if (m) m.classList.add('hidden'); }
    if (!e.target.closest('.hsearch')) closeDrop();
    if (!el || el.getAttribute('aria-disabled') === 'true' && el.dataset.act !== 'ambCommit' && el.dataset.act !== 'rcvSave' && el.dataset.act !== 'opClose') return;
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el, e); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
  document.addEventListener('submit', e => { const f = e.target; if (f.dataset && f.dataset.sub && SUB[f.dataset.sub]) { e.preventDefault(); SUB[f.dataset.sub](f, e); } });
  // Elemen role=button/radio dengan keyboard
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][tabindex]:not(button):not(a)')) { e.preventDefault(); e.target.click(); } });

  document.addEventListener('keydown', e => {
    if (!App.user) return;
    const tgt = e.target, inField = /INPUT|TEXTAREA|SELECT/.test(tgt.tagName);
    // Pintasan
    if (e.key === 'Escape') { if (App.modals.length) { topModal().close(); e.preventDefault(); return; } closeDrop(); }
    if (e.key === 'F2') { e.preventDefault(); go('terima'); return; }
    if (e.key === 'F3') { e.preventDefault(); if (!App.amb) App.amb = ambNew(); go('ambil'); return; }
    if (e.key === 'F4') { e.preventDefault(); go('opname'); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); $('#gSearch').focus(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && App.view === 'ambil' && !App.modals.length) { e.preventDefault(); ACT.ambCommit(); return; }
    if (e.key === 'F10' && App.view === 'terima') { e.preventDefault(); ACT.rcvSave(); return; }
    // Enter pada input khusus
    if (e.key === 'Enter' && inField) {
      if (tgt.id === 'arsipQ') { e.preventDefault(); ACT.arsipCari(); return; }
      if (tgt.dataset.op) { e.preventDefault(); const tr = tgt.closest('tr[data-w]'); if (tr) opRecord(tr.dataset.w, opReadRow(tr.dataset.w)); return; }
      if (tgt.id === 'gSearch') { e.preventDefault(); const on = $('#gDrop button.on'); if (on && !$('#gDrop').classList.contains('hidden')) on.click(); else { const v = tgt.value; tgt.value = ''; closeDrop(); openByCode(v); } return; }
    }
    if (tgt.id === 'gSearch' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const bs = $$('#gDrop button'); if (!bs.length) return; e.preventDefault();
      gSel = (gSel + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, i) => b.classList.toggle('on', i === gSel)); bs[gSel].scrollIntoView({ block: 'nearest' }); return;
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && App.user && Date.now() - (App.lastSync || 0) > 20000) syncNow(); });
  window.addEventListener('online', () => { App.online = true; flushOutbox(); updateStatus(); });
  window.addEventListener('offline', () => { App.online = false; updateStatus(); });
  $('#fLogin').addEventListener('submit', onLogin);
  $('#fPass').addEventListener('submit', onNewPass);
}

// ════════════════════════════════════════════════════════
// BAGIAN 18: BOOTSTRAP, LOGIN, SINKRON LATAR
// ════════════════════════════════════════════════════════

async function syncNow(force) {
  if (!App.S || (App.busy && !force)) return;
  App.lastSync = Date.now();
  try {
    const d = await rpc('sync', { ver: App.S.ver });
    if (d && d.state) { replaceState(d.state); rerender(); }
    App.online = true; updateStatus();
  } catch (e) { if (!e.network && force) showErr(e); }
}

function showLogin(o) {
  o = o || {};
  $('#boot').classList.add('hidden'); $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  $('#fPass').classList.add('hidden'); $('#fLogin').classList.remove('hidden');
  $('#loginErr').textContent = o.msg || '';
  setTimeout(() => { const i = $('#liUser'); if (i) (i.value ? $('#liPass') : i).focus(); }, 50);
}
let pendingLogin = null;
async function onLogin(e) {
  e.preventDefault();
  const username = $('#liUser').value.trim(), password = $('#liPass').value, btn = $('#btnLogin'), h = btn.innerHTML;
  $('#loginErr').textContent = '';
  if (!username || !password) { $('#loginErr').textContent = 'Isi nama pengguna dan password.'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Memeriksa…';
  try {
    const d = await rpc('login', { username, password });
    $('#liPass').value = '';
    if (d.user.harus_ganti) {
      pendingLogin = { d, lama: password };
      App.token = d.token;
      $('#fLogin').classList.add('hidden'); $('#fPass').classList.remove('hidden'); $('#passErr').textContent = ''; $('#liNew1').focus();
    } else start(d);
  } catch (er) { $('#loginErr').textContent = er.message || 'Gagal masuk.'; $('#liPass').select(); }
  finally { btn.disabled = false; btn.innerHTML = h; }
}
async function onNewPass(e) {
  e.preventDefault();
  const a = $('#liNew1').value, b = $('#liNew2').value, btn = $('#btnPass'), h = btn.innerHTML, err = $('#passErr');
  err.textContent = '';
  if (a.length < 6) { err.textContent = 'Password minimal 6 karakter.'; return; }
  if (a !== b) { err.textContent = 'Ulangan password tidak sama.'; return; }
  if (!pendingLogin) { showLogin({}); return; }
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Menyimpan…';
  try {
    const r = await rpc('ubahPassword', { lama: pendingLogin.lama, baru: a });
    const d = pendingLogin.d; d.user = r.user; pendingLogin = null;
    $('#liNew1').value = ''; $('#liNew2').value = '';
    toast('Password tersimpan. Selamat datang!', 'ok');
    start(d);
  } catch (er) { err.textContent = er.message || 'Gagal menyimpan password.'; }
  finally { btn.disabled = false; btn.innerHTML = h; }
}

function start(d) {
  App.token = d.token; try { sessionStorage.setItem('ci_tok', d.token); } catch (e) { }
  App.user = d.user;
  replaceState(d.state);
  App.outbox = ls(outboxKey()) || [];
  $('#uName').textContent = App.user.nama; $('#uRole').textContent = App.user.peran; $('#uAvatar').textContent = initials(App.user.nama);
  $('#login').classList.add('hidden'); $('#boot').classList.add('hidden'); $('#app').classList.remove('hidden');
  try { $('#app').classList.toggle('side-min', localStorage.getItem('ci_side') === 'min'); } catch (e) { }
  let v = 'dashboard'; try { v = sessionStorage.getItem('ci_view') || 'dashboard'; } catch (e) { }
  if (v === 'pengaturan' && App.user.peran !== 'Admin') v = 'dashboard';
  App.lastSync = Date.now();
  go(v);
  updateStatus();
  if (App.outbox.length) { toast(`${App.outbox.length} transaksi tertunda dari sesi sebelumnya sedang dikirim…`, 'warn'); flushOutbox(); }
  clearInterval(App.syncTimer);
  App.syncTimer = setInterval(() => { if (document.visibilityState === 'visible' && !App.busy && !App.outbox.length && !App.modals.length) syncNow(); if (App.outbox.length) flushOutbox(); }, 45000);
}

function init() {
  try { App.token = sessionStorage.getItem('ci_tok'); } catch (e) { }
  try { bindEvents(); } catch (e) { console.error(e); if (window.__ciBootErr) window.__ciBootErr('bindEvents: ' + e.message); }
  boot();
}
/** Layar "Hubungkan server": tampil bila js/config.js belum berisi URL /exec. Disimpan per perangkat. */
function showSetup(note) {
  window.__ciStage = 'setup';
  const msg = $('#bootMsg'); if (!msg) return;
  $('.boot-bar') && $('.boot-bar').classList.add('hidden');
  msg.innerHTML = `<div style="text-transform:none;letter-spacing:0;font-weight:400;line-height:20px">
    <b class="t-lg" style="color:var(--ink)">Hubungkan ke server</b>
    <p class="muted t-sm" style="margin:4px 0 10px">${esc(note || 'Tempel URL Web App Apps Script (berakhiran /exec). Admin bisa mengisinya permanen di js/config.js.')}</p>
    <input id="setupUrl" class="inp mono" placeholder="https://script.google.com/macros/s/…/exec" value="${esc((function () { try { return localStorage.getItem('ci_api') || ''; } catch (e) { return ''; } })())}">
    <div id="setupErr" class="ferr mt8"></div>
    <button class="btn btn-p btn-blk mt8" id="setupBtn">Tes &amp; simpan</button></div>`;
  $('#setupBtn').onclick = async () => {
    const u = $('#setupUrl').value.trim(), err = $('#setupErr'), b = $('#setupBtn');
    err.textContent = '';
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) { err.textContent = 'URL harus diawali https://script.google.com/ dan berakhiran /exec'; return; }
    b.disabled = true; b.innerHTML = '<span class="spin"></span> Menguji…';
    try {
      const r = await callApi(u, { action: 'ping', payload: {} }, 30000);
      if (!r || !r.success || !r.data || !r.data.pong) throw { message: 'Server merespons, tetapi bukan API CHEM-INV.' };
      try { localStorage.setItem('ci_api', u); } catch (e) { }
      $('.boot-bar') && $('.boot-bar').classList.remove('hidden');
      boot();
    } catch (e) { err.textContent = e.message || 'Gagal terhubung.'; b.disabled = false; b.textContent = 'Tes & simpan'; }
  };
}
function boot() {
  window.__ciStage = 'rpc';
  const msg = $('#bootMsg');
  if (!apiUrl()) { showSetup(); return; }
  if (msg) msg.textContent = 'Memuat data inventaris…';
  rpc('bootstrap', {}).then(d => {
    window.__ciStage = 'ready';
    if (d.needLogin) { showLogin(d); return; }
    if (d.user.harus_ganti) { App.token = null; try { sessionStorage.removeItem('ci_tok'); } catch (e) { } showLogin({ msg: 'Silakan masuk lagi untuk membuat password baru.' }); return; }
    start(d);
  }).catch(e => {
    window.__ciStage = 'rpc-gagal';
    if (msg) msg.innerHTML = `<span class="err-t" style="text-transform:none">${esc(e.message || 'Gagal memuat.')}</span><br><button class="btn btn-sm mt8" id="bootRetry">Coba lagi</button> <button class="btn btn-sm btn-g mt8" id="bootSetup">Ubah alamat server</button>`;
    const r1 = $('#bootRetry'), r2 = $('#bootSetup');
    if (r1) r1.onclick = () => boot();
    if (r2) r2.onclick = () => showSetup('Alamat server saat ini tidak bisa dihubungi. Periksa atau tempel ulang URL /exec.');
  });
}

// Ekspos minimum ke global (semua kode lain tertutup di dalam IIFE)
window.boot = boot;
window.App = App;
window.CHEMINV = { go, render, fefo, ambPlan, ambSelectWadah, opScope, rcvCalc, openWadah, openByCode };
function safeInit() {
  if (window.__ciStarted) return;
  window.__ciStarted = true; window.__ciStage = 'init';
  try { init(); } catch (e) { console.error(e); if (window.__ciBootErr) window.__ciBootErr('Inisialisasi: ' + e.message); }
}
// Aman bila DOMContentLoaded sudah lewat
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
else safeInit();
window.addEventListener('load', safeInit);
})();
