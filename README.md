# NasabNet — Jejaring Kabilah & Sahabat Nabi ﷺ

Aplikasi web edukasi untuk memahami keterkaitan sosial, garis klan, dan pernikahan silang antarsahabat
Nabi Muhammad ﷺ. Datanya **dikompilasi dari Turath.io** (basis data rawi + teks kitab klasik), bukan
diketik manual.

**🌐 Live: [nasabnet.vercel.app](https://nasabnet.vercel.app)** — 5.769 tokoh (1.804 sahabat), 6.753 relasi
(1.218 pernikahan, 4.747 orang tua–anak, 94 mu'akhah), 54 kabilah/klan; biografi naratif untuk 1.791 sahabat
dan profil bersitasi untuk 54 kabilah, termasuk 414 tempat kabilah (293 di peta). 99,9% relasi sudah dicocokkan
ulang dengan teks sumbernya.

## Fitur

| # | Fitur | Lokasi di aplikasi |
|---|-------|--------------------|
| 1 | Diagram Garis Hubungan Langsung (Pathfinder) | **Cari Hubungan** → diagram panah beranimasi, label tiap tautan, sumber per tautan |
| 2 | Peta Suku & Kabilah (Tribe Network View) | **Peta Kabilah** (beranda): kartu kabilah, pohon klan Quraisy, graf jejaring per kabilah, peta pernikahan antarkabilah, **Peta wilayah** (titik tempat tiap kabilah menurut kitab, bisa diklik → kutipan + profil) |
| 3 | Profil Mini & Kartu Keluarga | Klik nama mana pun → pop-up: ayah/ibu, kabilah, istri/suami, anak (beserta ibunya), saudara, mertua, menantu, ipar, besan, mu'akhah, rujukan; tab **Biografi** (1.791 sahabat, dari al-Ishabah, Ibnu Sa'd, Usdul Ghabah dkk.; nasab & asal-usul, kiprah, keluarga & pernikahan, rujukan) |
| 4 | Jejaring Istri & Pernikahan Silang | **Jejaring Pernikahan**: graf pernikahan, “simpul pengikat”, aliansi antarklan, lingkaran mertua–ipar–besan per tokoh |
| 5 | Mesin Pencari Hubungan Kilat | **Cari Hubungan**: pilih 2 nama bebas → jalur terpendek + istilah kekerabatan (mertua, ipar, besan, sepupu, biras…) + titik temu nasab; **Tokoh terkait**: daftar sahabat yang berkaitan nasab, kekerabatan, dan aliansi kabilah dengan tiap tokoh, serta kerabat bersama keduanya |
| 6 | Filter Kategori Sosial | Chip filter: Muhajirin, Anshar, Ahlulbait, Kerabat Nabi, Ummahatul Mukminin, Khulafaur Rasyidin, Al-'Asyarah, Ahlu Badar |
| 7 | Pencarian Global Cepat | Kolom di header (Ctrl/⌘ + K), Arab atau Latin, untuk tokoh & kabilah |
| 8 | Riwayat & Favorit | Tombol “Simpan” pada profil/diagram/silsilah/kabilah; halaman **Riwayat & Favorit** (localStorage) |
| 9 | Kamus Istilah & Biografi Klasik | **Glosarium & Rujukan**: nasab, nisbah, laqab, kunyah, ‘ashabah, mu’akhah, wala’, halif, dst. + tautan kitab di Turath |
| 10 | Silsilah Vertikal | **Silsilah Vertikal**: rantai ayah → kakek → … → titik temu klan (Abdu Manaf, Qushay, Ka'b, Fihr, Aus/Khazraj), tanda leluhur yang sama dengan Nabi ﷺ, anak-cucu; mode bandingkan dua tokoh → **pohon titik temu** (dari leluhur bersama turun ke kedua tokoh) + jejaring kekerabatan & tokoh bernasab terkait di bawahnya |
| + | Profil Kabilah | Pencarian kabilah → tab **Profil Kabilah** (asal-usul, cabang, lokasi, peran kabilah di bidang militer/diplomasi/ekonomi/sosial, tempat-tempatnya; setiap butir bersitasi halaman kitab) |

## Menjalankan aplikasi (data sudah tersedia)

Prasyarat: Node.js ≥ 20.

```bash
cd web
npm install
npm run dev          # buka http://localhost:5173
```

Build produksi (file statis di `web/dist`, bisa di-host di mana saja — versi live di-deploy ke Vercel
dengan Root Directory `web`, preset Vite):

```bash
cd web
npm run build
npm run preview      # cek hasil build di http://localhost:4173
```

## Sumber data & cara membangun ulang

Penelusuran `app.turath.io` (lewat Chrome DevTools + bundle JS aplikasi) menemukan API publik yang dipakai
aplikasi Turath sendiri:

| Endpoint | Isi |
|----------|-----|
| `GET https://api.turath.io/narrators?page=N&limit=100&q=` | Daftar 18.989 rawi (nama, nama lengkap, wafat, martabat) |
| `GET https://api.turath.io/narrator?id=ID` | Detail rawi: **النسب** (nisbah), **علاقات الراوي** (ibu, istri, anak, saudara, mu'akhah, maula), kunyah, laqab, domisili, penilaian ulama + sitasi |
| `GET https://api.turath.io/search?q=` | Pencarian teks penuh di seluruh kitab |
| `GET https://api.turath.io/book?id=ID&include=indexes` / `page?book_id=&pg=` | Metadata & halaman kitab |
| `GET https://files.turath.io/books-v3/ID.json` | Teks lengkap satu kitab (semua halaman + daftar isi) |
| `GET https://files.turath.io/data-v4.sqlite` | Katalog seluruh kitab (untuk mencari ID kitab) |

Tidak ada API “graf nasab” siap pakai, jadi relasinya dikompilasi:

1. `scripts/crawl_turath.py list` → daftar rawi; `scripts/crawl_turath.py details` → detail tiap rawi
   (sahabat diprioritaskan; ada throttle adaptif karena API membatasi ±60–90 permintaan/menit).
2. `scripts/extract_ibnsad.py` → memotong paragraf keluarga setiap biografi di *ath-Thabaqat al-Kubra*
   Ibnu Sa'd (Turath #9351, jilid 1/3/4/8): nasab, ibu, daftar anak per ibu (= para istri), mu'akhah.
3. Ekstraksi terstruktur (spesifikasi di `data/work/EXTRACTION_SPEC.md`) dari teks Ibnu Sa'd dan teks
   `علاقات الراوي` → `data/work/extracted/*.json`.
4. `scripts/build_dataset.py` → mencocokkan nama antarsumber berdasarkan rantai nasab (ism + ayah + kakek,
   termasuk alias seperti `أبي قحافة: عثمان`), menurunkan kabilah dari nisbah/rantai nasab, kategori sosial,
   silsilah patrilineal, lalu menulis `web/public/data/nasabnet.json`. Lapisan kurasi kecil
   (`data/curated.json`: Nabi ﷺ, orang tua, paman, putra-putri) juga bersitasi halaman Ibnu Sa'd.

```bash
python3 scripts/crawl_turath.py list
python3 scripts/crawl_turath.py details
python3 scripts/extract_ibnsad.py
# (jalankan ekstraksi relasi sesuai EXTRACTION_SPEC.md)
python3 scripts/build_dataset.py
```

### Pemeriksaan & koreksi data

Agar tidak ada salah nasab, dataset melewati beberapa lapis pemeriksaan:

- `scripts/check_dataset.py` — 18 fakta nasab baku (mis. Fathimah az-Zahra' istri Ali, Ali–Umar bertemu di
  Ka'b bin Lu'ay) harus terpenuhi.
- `scripts/audit_dataset.py` — aturan R1–R10 (ibu ganda, siklus, rentang usia mustahil, kemungkinan
  duplikat, kabilah anak ≠ ayah, dst.). Tiap temuan ditinjau terhadap teks sumber; keputusan disimpan di
  `data/corrections.json` (merge / drop_edge / add_edge / set_tribe, masing-masing dengan alasan) dan
  `data/audit_reviewed.json`.
- **Verifikasi per relasi** (`scripts/build_edge_packets.py` → `scripts/compile_edge_verification.py`):
  setiap relasi dicocokkan ulang dengan teks Arab sumbernya (halaman Ibnu Sa'd atau catatan rawi Turath).
  Hasil: 6.747 dari 6.753 relasi terverifikasi; 214 relasi salah dihapus (salah orang/namesake, arah
  terbalik, "orang" yang sebenarnya nama kabilah); 150 relasi diragukan (riwayat bertentangan, teks
  terpotong, nama ayah satu kata) dicatat di `data/edge_unsure.json`; relasi benar yang hanya disebut di
  entri tetangga dipertahankan lewat `data/edge_keep.json`.
- Temuan verifikasi juga memperbaiki pembangun data: dua biografi Ibnu Sa'd tidak digabung otomatis
  (pengulangan yang sudah ditinjau digabung lebih dulu), nama yang hanya menyebut kabilah/status
  ("من بني سهم", "آل جحش", "أم ولد") bukan tokoh, ayah harus sekelompok kabilah dengan anaknya, kakek si anak
  harus cocok dengan ayah si tokoh, nama satu kata tidak dicocokkan sebagai ayah/ibu, perawi yang cocok tiga
  tingkat didahulukan, dan simpul nama umum ("عبد الله بن سعد") masuk daftar pencocokan ketat
  (`data/curated.json` → `strict`, `keep_apart`).
- Keluarga inti Nabi ﷺ (istri dan putra-putri) hanya dicocokkan lewat nasab lengkap, bukan nama pendek;
  "محمد" tanpa nasab tidak dianggap Nabi ﷺ.

Setiap tautan relasi menyimpan rujukannya (halaman Ibnu Sa'd atau halaman rawi di Turath) dan tampil di
profil serta diagram.

### Biografi, profil kabilah & peta wilayah

Semua butir naratif dikutip dari halaman kitab yang dibaca langsung (26 kitab Turath diunduh dengan
`curl -o data/raw/books/ID.json https://files.turath.io/books-v3/ID.json`; daftar dan format sitasinya di
`scripts/books.py list`). Setiap kutipan Arab diperiksa otomatis ada di halaman yang disebut.

- **Biografi sahabat** — `data/work/BIO_RUN.md`, `BIO_SPEC.md`, `VERIFY_SPEC.md`, `FIND_SPEC.md`: kutipan entri
  al-Ishabah / Ibnu Sa'd / Usdul Ghabah → draf → verifikasi klaim demi klaim oleh agen lain → `scripts/build_bio.py`.
- **Profil kabilah** — `data/work/PROFILE_SPEC.md`: butir asal-usul yang semula "umum" dicarikan halaman
  (`scripts/check_profile.py` → `compile_profile.py` → `data/tribe_profile_src.json`).
- **Peran kabilah** — `data/work/ROLES_SPEC.md` + `ROLE_LEVEL_SPEC.md`: peran militer/diplomasi/ekonomi/sosial
  harus tentang kabilah sebagai kelompok; jasa satu tokoh dipindah ke biografinya
  (`check_moved.py` → `compile_roles.py`, `compile_moved.py` → `data/tribe_roles.json`, `data/bio_extra.json`).
- **Peta wilayah** — `data/work/PLACES_SPEC.md`: tempat yang dikaitkan kitab dengan kabilah (Mu'jam al-Buldan,
  Shifat Jazirat al-'Arab, Jamharah, Futuh al-Buldan…), koordinat dari Wikidata/OpenStreetMap lewat
  `scripts/geo.py` (tidak pernah ditebak; "perkiraan" = kitab hanya menyebut "dekat X") → `check_places.py` →
  `compile_places.py` → `data/tribe_places.json`.
- **Mode "Zaman Nabi ﷺ"** — relief medan tanpa jalan/bangunan modern; tempat bersejarah Makkah & Madinah
  (`LANDMARKS_SPEC.md` → `data/landmarks.json`) dan unsur alam Madinah bergaya peta kuno — wadi, gunung, harrah,
  kebun (`SHAPES_SPEC.md`, bentuk dari OpenStreetMap lewat `scripts/shapes.py` → `compile_shapes.py` →
  `data/shapes.json`), denah Madinah (kawasan kabilah, uthum, pasar, Khandaq — dari Wafa' al-Wafa', Tarikh
  al-Madinah Ibnu Syabbah dkk.), lapisan Jazirah (gurun berpola pasir, harrah, wilayah, laut, pasar Arab, jalur
  kafilah) dan legenda berisi definisi istilah dari kitab; ikon bergambar per jenis tempat. Semuanya bersitasi.

```bash
python3 scripts/compile_profile.py && python3 scripts/compile_roles.py && python3 scripts/compile_moved.py
python3 scripts/compile_places.py && python3 scripts/compile_shapes.py && python3 scripts/build_bio.py
```

## Batasan

- Ekstraksi otomatis dari teks Arab klasik bisa keliru menyamakan dua orang bernama sama atau melewatkan
  relasi; selalu periksa rujukan yang ditautkan.
- Kategori Muhajirin/Anshar diturunkan dari kabilah dan keterangan hijrah/Badar di sumber.
- Data rawi non-sahabat (tabi'in) hanya dipakai untuk mengenali anak-cucu sahabat.
- Titik peta menunjukkan tempat yang disebut kitab, bukan batas wilayah; banyak kabilah berpindah-pindah, dan
  121 tempat belum punya koordinat yang pasti sehingga hanya tercantum di profil kabilah.

## Struktur

```
scripts/        crawler, pemotong teks Ibnu Sa'd, builder dataset
data/raw/       hasil unduhan Turath (rawi, kitab)
data/work/      potongan teks, hasil ekstraksi
data/curated.json
web/            aplikasi React + TypeScript + Tailwind CSS + Cytoscape.js
```

## Lisensi

- **Kode** (`web/`, `scripts/`): [MIT](LICENSE).
- **Data** (`web/public/data/*.json`, `data/*.json`, `data/work/extracted/`):
  [CC BY 4.0](data/LICENSE-DATA.md) — wajib menyebut NasabNet dan sumber aslinya (Turath.io / kitab
  rujukan). Dump mentah Turath tidak disertakan; bangun ulang dengan `scripts/`. Koordinat dari
  Wikidata (CC0) dan © kontributor OpenStreetMap (ODbL); peta dasar © Esri.
