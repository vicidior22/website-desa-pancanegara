# Website Desa Pancanegara Modern — Netlify

Versi ini dibuat ulang agar sesuai konsep mockup: modern, profesional, dominan biru muda dengan gradasi tipis, responsif, dan seluruh konten dapat dikelola dari Dashboard Admin.

## Fitur

- Beranda modern
- Profil Desa + foto kantor
- Berita: tambah, edit, hapus + upload cover langsung
- Galeri: tambah, edit, hapus + upload foto langsung
- Struktur Perangkat Desa: tambah, edit, hapus + foto + jabatan + bidang + urutan
- Maps Desa: Google Maps URL + latitude/longitude + preview OpenStreetMap
- Kontak/pengaduan masyarakat
- Dashboard admin
- Login admin berbasis environment variables
- Penyimpanan data dan foto menggunakan Netlify Blobs
- Tidak ada field "image key" yang perlu diisi admin

## Deploy

1. `npm install`
2. Buat hash password:
   `node scripts/hash-password.mjs PASSWORD_ANDA`
3. Di Netlify Production buat:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `SESSION_SECRET`
4. `netlify link`
5. `netlify deploy --prod`

Netlify Blobs otomatis dipakai oleh Functions untuk menyimpan data dan file upload. Pastikan project Netlify sudah terhubung dan deploy melalui CLI/continuous deployment.

## Catatan

Foto yang dipilih admin dikirim ke `/api/admin/upload`, disimpan di Netlify Blobs, lalu API mengembalikan URL media. Admin tidak pernah perlu memasukkan key media secara manual.

Untuk data yang sangat kompleks/relasional dalam skala besar, gunakan database SQL; untuk kebutuhan website desa ini, Blobs cocok untuk data sederhana dan upload gambar.
