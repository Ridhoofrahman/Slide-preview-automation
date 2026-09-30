# Slide Review — panduan setup

Dua bagian yang saling terhubung:

- **Add-in PowerPoint (desainer).** Desainer memilih slide yang selesai, lalu klik **Mark slide ready for review**. Screenshot slide itu otomatis terkirim. Di panel yang sama, desainer melihat status dan komentar DM, termasuk posisi pin-nya di preview slide.
- **Halaman review (DM).** Dibuka di browser. Berisi daftar project, slide yang menunggu review muncul otomatis tanpa refresh, klik di slide untuk memberi komentar berpin, lalu **Approve** atau **Request changes**. Kalau desainer mengirim versi baru, versi lama beserta komentarnya tetap bisa dilihat.

Tidak ada notifikasi. DM membuka halaman review kapan pun dia siap QA.

## Isi folder

| File | Fungsi |
|---|---|
| `supabase-setup.sql` | Membuat database, tempat penyimpanan gambar, dan aturan akses |
| `config.js` | Alamat Supabase. Diisi sekali, dipakai oleh add-in dan halaman review |
| `taskpane.html` | Panel desainer di PowerPoint |
| `review.html` | Halaman review untuk DM |
| `manifest.xml`, `commands.html`, `assets/` | Kebutuhan untuk memasang add-in |

## Langkah 1 — Supabase (±15 menit)

1. Daftar di supabase.com → **New project** (paket gratis cukup untuk uji coba). Pilih region **Singapore**.
2. **SQL Editor → New query** → tempel seluruh isi `supabase-setup.sql` → **Run**.
3. **Authentication → Sign In / Providers**: matikan **Allow new users to sign up**, supaya hanya akun yang kamu buat yang bisa masuk.
4. **Authentication → Users → Add user → Create new user**: buat akun untuk tiap desainer dan DM (email + password), centang **Auto Confirm User**.
5. **Project Settings → API**: salin **Project URL** dan key **anon public**, lalu tempel ke `config.js`.

## Langkah 2 — Hosting di GitHub Pages (±10 menit)

1. Buat repo `slide-qa-marker`, upload semua file.
2. **Settings → Pages** → branch `main`, folder `/root` → Save.
3. Di `manifest.xml`, ganti semua `YOUR-GITHUB-USERNAME` dengan username GitHub kamu.
4. Di `config.js`, isi `REVIEW_PAGE_URL` dengan `https://USERNAME.github.io/slide-qa-marker/review.html`. Commit.
5. Buka `review.html` di browser dan login dengan akun DM untuk memastikan semuanya tersambung.

Kode di repo ini tidak berisi data customer. Gambar slide tersimpan di bucket privat Supabase dan hanya bisa dibuka lewat link sementara (berlaku 1 jam) setelah login.

## Langkah 3 — Pasang add-in untuk uji coba (Windows)

1. Taruh `manifest.xml` di folder, misalnya `C:\SlideQA`. Klik kanan → **Properties → Sharing → Share**, lalu catat path jaringannya (contoh `\\NAMA-PC\SlideQA`).
2. PowerPoint → **File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs** → tempel path → **Add catalog** → centang **Show in Menu** → OK. Buka ulang PowerPoint.
3. **Home → Add-ins → More Add-ins → Shared Folder** → pilih **Slide QA Marker**.

Untuk rollout ke satu tim, minta admin Microsoft 365: **Admin center → Settings → Integrated apps → Upload custom apps** → upload `manifest.xml`.

## Cara pakai

**Desainer**
1. Buka **QA Marker** di tab Home, lalu login. Isi nama di kolom nama saat login pertama.
2. Nama project diambil dari nama file. Bisa diganti dengan klik judulnya, tapi sebaiknya sebelum slide pertama dikirim (lihat catatan di bawah).
3. Pilih slide → tulis catatan kalau perlu → **Mark slide ready for review**.
4. Warna grid nomor: kuning = menunggu review, hijau = approved, oranye = perlu revisi. Komentar DM muncul otomatis.
5. Setelah merevisi, klik **Send updated version of slide N**.

**DM**
1. Buka halaman review. Tab **Waiting for review** hanya menampilkan slide yang belum diputuskan.
2. Klik slide → klik di bagian yang ingin dikomentari → tulis → **Add comment** (atau Ctrl+Enter). Komentar tanpa pin juga bisa.
3. **Approve** atau **Request changes**. Klik tombol yang sama sekali lagi untuk membatalkan.
4. Navigasi: tombol ‹ › atau panah kiri/kanan di keyboard, Esc untuk kembali.

## Hal yang perlu diketahui

- **File harus di-save setelah pengiriman slide pertama.** Add-in menyimpan ID file di dalam PPT. Kalau file ditutup tanpa di-save, pengiriman berikutnya akan tercatat sebagai file baru.
- **Save As untuk project lain ikut membawa ID file lama.** Kalau file lama dijadikan template project baru, slide-nya akan tercampur di review. Solusi sementara: buat file baru dari template, jangan Save As dari file project yang sudah pernah dikirim.
- **Mengganti nama project setelah slide dikirim** membuat project terbelah jadi dua di halaman review.
- **Butuh PowerPoint M365 versi terbaru** (PowerPoint API 1.8) untuk mengambil screenshot.
- **Kapasitas paket gratis Supabase**: 1 GB gambar, kira-kira beberapa ribu slide. Project gratis juga akan di-pause kalau tidak dipakai selama seminggu. Untuk pemakaian rutin, pertimbangkan paket Pro.
- **Data client disimpan di layanan pihak ketiga** (Supabase). Tanyakan ke IT atau legal apakah ini boleh untuk project dengan NDA sebelum dipakai di luar uji coba.
