# Panduan setup database online — STIKK AN-NUR 2

## Yang sudah ditambahkan ke repository
- `student.html`: portal mahasiswa, hanya dapat melihat riwayat dirinya sendiri.
- `admin-cloud.html`: panel admin cloud untuk membuat/reset PIN 4 digit secara acak.
- `supabase/config.example.js`: contoh konfigurasi browser (URL + anon key saja).
- `supabase/schema.sql`: tabel, RLS, dan seed 21 mahasiswa.
- `supabase/functions/student-portal/index.ts`: backend Edge Function dengan login mahasiswa, sesi bertoken, pembatasan percobaan, riwayat pribadi, serta pengelolaan PIN oleh admin.
- `supabase-config.js`: placeholder konfigurasi yang harus diisi sebelum portal online berfungsi.

## Penting: belum online sampai project Supabase Anda dikonfigurasi
Repository GitHub tidak dapat membuat project database atau mengetahui kredensial Supabase milik Anda. Jangan menaruh service-role key di HTML, JavaScript publik, GitHub Pages, atau mengirimkannya ke chat.

## 1. Buat project Supabase
1. Buat project di https://supabase.com/dashboard.
2. Buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
3. Di **Project Settings → API**, salin Project URL dan anon/public key.
4. Edit `supabase-config.js` di repository, ganti `YOUR_PROJECT_REF` dan `YOUR_SUPABASE_ANON_KEY`. URL dan anon key memang digunakan oleh browser; service-role key tidak.

## 2. Deploy Edge Function
Pasang Supabase CLI, login, lalu tautkan project:
```bash
supabase login
supabase link --project-ref PROJECT_REF_ANDA
supabase functions deploy student-portal
supabase secrets set SUPABASE_ANON_KEY=ANON_KEY_ANDA RATE_LIMIT_SALT="GANTI_DENGAN_RANDOM_SECRET_PANJANG"
```
Supabase menyediakan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sebagai environment bawaan untuk Edge Functions. Pastikan fungsi berjalan dengan service role hanya di sisi server. Jangan menambahkan service role ke file front-end.

## 3. Buat akun admin cloud
1. Buka **Authentication → Users** di Supabase Dashboard dan buat user admin dengan email/password.
2. Salin UUID user tersebut.
3. Jalankan di SQL Editor, mengganti UUID:
```sql
insert into public.admin_users (user_id, active)
values ('UUID_USER_ADMIN_ANDA', true)
on conflict (user_id) do update set active = true;
```
4. Buka `admin-cloud.html` setelah GitHub Pages aktif, login menggunakan email/password admin tersebut.
5. Gunakan **Buat PIN** pada setiap mahasiswa. PIN ditampilkan satu kali. Sampaikan langsung secara pribadi. Jika PIN hilang, reset PIN lama tidak berlaku lagi.

## 4. Buka portal mahasiswa
Setelah konfigurasi dan deployment selesai, buka `student.html`. Mahasiswa memilih nama dan memasukkan PIN 4 digit. Token sesi hanya disimpan di memori tab; sesi backend berlaku 8 jam dan dihapus saat login baru untuk akun yang sama.

## 5. Hubungkan absensi admin ke database
Aplikasi lama `index.html` tetap dipertahankan. Saat ini fitur lama menyimpan sesi dan kehadiran di localStorage browser. Untuk menampilkan riwayat di portal mahasiswa, data sesi/kehadiran harus ditulis ke tabel `attendance_sessions` dan `attendance_records`. Jangan menganggap data lama otomatis tersinkron. Migrasi dan sinkronisasi admin perlu diselesaikan sebelum dipakai sebagai satu sistem produksi.

## Batasan keamanan
- PIN 4 digit hanya memiliki 10.000 kemungkinan. Backend membatasi percobaan berulang berdasarkan mahasiswa + fingerprint IP dan mengunci percobaan setelah 8 kali dalam 15 menit. Ini bukan pengganti MFA untuk admin.
- PIN di-hash dengan bcrypt cost 12; tidak disimpan sebagai teks biasa.
- RLS aktif dan tidak ada policy akses langsung untuk anon/authenticated; fungsi backend menjadi perantara.
- Login mahasiswa hanya memberikan riwayat untuk student_id yang terikat pada token sesi server.
- Admin cloud harus menggunakan Supabase Auth dan tercatat di `admin_users`.
- Sebelum penggunaan resmi, uji akses silang, pembatasan percobaan, backup, dan audit akses. Gunakan HTTPS dan jangan membagikan PIN dalam grup umum.
