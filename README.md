# Aplikasi Absensi Mahasiswa — STIKK AN-NUR 2

Aplikasi absensi berbasis HTML, CSS, dan JavaScript untuk penggunaan lokal melalui browser.

## Fitur
- Login admin sederhana dengan PIN lokal.
- Tambah mahasiswa satu per satu atau impor daftar sekaligus.
- Pengurutan nama mahasiswa otomatis berdasarkan alfabet.
- Buat sesi perkuliahan berdasarkan mata kuliah, tanggal, pertemuan, dan dosen.
- Status kehadiran: Hadir, Sakit, Izin, Alpa, atau Belum ditandai.
- Riwayat sesi perkuliahan.
- Ekspor absensi ke CSV yang dapat dibuka di Excel.
- Cadangan dan pemulihan data dalam format JSON.
- Tampilan responsif untuk laptop dan ponsel.

## Cara menjalankan
1. Buka `index.html` di browser modern.
2. PIN awal: `1234`.
3. Segera ubah PIN melalui menu **Pengaturan**.
4. Tambahkan daftar mahasiswa pada menu **Mahasiswa**.
5. Buat sesi di menu **Absensi**, lalu tandai status kehadiran.
6. Ekspor CSV dan buat cadangan JSON secara rutin.

## Cara mengaktifkan GitHub Pages
1. Buka repository **Settings**.
2. Pilih **Pages**.
3. Pada bagian **Build and deployment**, pilih **Deploy from a branch**.
4. Pilih branch `main` dan folder `/(root)`, lalu klik **Save**.
5. Tunggu proses deployment selesai. URL akan muncul di halaman GitHub Pages repository.

## Format impor daftar mahasiswa
Pada kotak impor, satu nama per baris bisa digunakan. Untuk menyertakan NIM, gunakan format:

```csv
NIM,Nama Mahasiswa
2026001,Ahmad Contoh
2026002,Siti Contoh
```

File CSV impor memakai kolom pertama sebagai NIM dan kolom kedua sebagai nama. Jika hanya nama yang tersedia, masukkan satu nama per baris melalui kotak impor.

## Penting: batasan keamanan dan penyimpanan
- Data disimpan di `localStorage` browser pada perangkat yang sedang digunakan. Data tidak tersinkron otomatis ke perangkat lain dan dapat hilang jika data browser dibersihkan.
- Ekspor cadangan JSON secara rutin dan simpan file cadangan di tempat yang aman.
- PIN adalah pengunci sederhana di sisi browser, bukan autentikasi server. Pengguna yang memahami browser atau memiliki akses ke perangkat mungkin dapat melewatinya.
- Jangan masukkan data pribadi yang sensitif jika aplikasi digunakan melalui hosting publik tanpa backend dan autentikasi yang layak.
- GitHub Pages hanya menyajikan file statis. Untuk akun admin sungguhan, sinkronisasi antarperangkat, audit log, dan kontrol akses yang kuat, aplikasi perlu backend serta database dengan aturan keamanan.

## File proyek
- `index.html` — aplikasi lengkap (antarmuka dan logika).

## Lisensi
Gunakan dan modifikasi sesuai kebutuhan institusi. Pastikan penggunaan data mahasiswa mengikuti kebijakan privasi dan aturan kampus.
