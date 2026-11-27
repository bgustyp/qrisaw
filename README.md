# Qrisaw

> **Note**: This software is not affiliated with, endorsed by, or sponsored by Saweria. Usage may violate Saweria's Terms of Service. Use at your own risk.

Unofficial API Wrapper untuk Saweria yang mendukung **Auto-Login** (Email + Password), **Session Management** (JWT Persistence), dan **Turnstile Auto-Solve** via real browser (puppeteer-real-browser). Dibuat dengan arsitektur MVC yang robust dan aman.

---

## ✨ Features

- **Auto Login**: Otomatis login menggunakan email & password.
- **Session Persistence**: Menyimpan session (JWT) ke `session.json` dan memvalidasi masa berlaku token secara otomatis.
- **Turnstile Auto-Solve**: Bypass Cloudflare Turnstile secara otomatis via real Chrome (puppeteer-real-browser). Tidak membutuhkan paid captcha service.
- **Concurrent Request Handling**: Mencegah race condition saat re-login (hanya 1 captcha solve untuk banyak request).
- **Robust Error Handling**: Forwarding status code asli dari Saweria (400, 403, 404) bukan sekadar 500.
- **Swagger Documentation**: Dokumentasi API interaktif (khusus mode development).
- **Cross-Platform Browser Detection**: Auto-detect Chrome/Chromium/Edge di Windows, Linux, dan macOS.
- **Xvfb Support**: Headful browser di server Linux tanpa GUI via Xvfb (Turnstile solve rate tetap tinggi).

---

## 🚀 Quick Start

### 1. Prasyarat

- Node.js v22+
- Chrome / Chromium / Edge terinstall (atau set `CHROME_PATH` di `.env`)
- Xvfb (untuk server Linux tanpa GUI — `sudo apt install -y xvfb`)

### 2. Konfigurasi

Copy `.env.example` menjadi `.env` dan isi variabel yang dibutuhkan:

```env
PORT=3000
NODE_ENV=development

SAWERIA_EMAIL=email_anda@gmail.com
SAWERIA_PASSWORD=password_anda

# Optional
# CHROME_PATH=/usr/bin/google-chrome-stable
# BROWSER_HEADLESS=true  # Default false, biarkan false untuk solve rate terbaik
ADMIN_KEY=  # Isi dengan hasil `openssl rand -hex 32` untuk mengaktifkan endpoint privat
```

### 3. Instalasi & Jalan

```bash
npm install
npm start
```

**Sesi manual di WSL/Linux:** Bila Chromium tidak dapat dijalankan, isi `ADMIN_KEY`
dan kosongkan `SAWERIA_EMAIL` serta `SAWERIA_PASSWORD` sebelum menyalakan server.
Di terminal kedua, jalankan `npm run login`. Login lewat browser Windows biasa, lalu
masukkan `userId` dan `authToken` sesi milik Anda jika sudah tersedia.
Skrip ini hanya memasang sesi yang sudah ada; skrip tidak mengambil token dari browser.
Token tidak ditampilkan atau dikirim ke luar host. Endpoint privat seperti `/api/users`
tetap memerlukan header `X-Admin-Key`, termasuk setelah sesi dipasang.

### 4. Docker (recommended untuk server)

```bash
docker compose up -d
```

Atau build manual:

```bash
docker build -t qrisaw .
docker run -d -p 127.0.0.1:3000:3000 --env-file .env -e NODE_ENV=production -e PORT=3000 -e HOST=0.0.0.0 \
  --security-opt seccomp=./docker/seccomp-chromium.json qrisaw
```

Image menyertakan Chromium dari Debian dan berjalan sebagai pengguna `node`, bukan root.
Sesi container disimpan di `/home/node/session.json`. Jika sebelumnya memakai mount `/app/session.json`, pindahkan sesi saat migrasi dan pastikan UID 1000 bisa menulis direktori sesi.

Auto-login memerlukan sandbox Chromium di dalam container. Profil seccomp default Docker memblokir pembuatan namespace yang dibutuhkan sandbox, jadi repo ini menyertakan `docker/seccomp-chromium.json` — profil default Docker ditambah izin `clone`/`clone3`/`unshare`/`setns`. Compose memasangnya lewat `security_opt`; `docker run` manual wajib menyertakan `--security-opt seccomp=...` seperti di atas. Container tetap non-root tanpa `CAP_SYS_ADMIN`; jangan gunakan `--no-sandbox` atau container privileged.
Uji tanpa kredensial: `docker run --rm --network none --security-opt seccomp=./docker/seccomp-chromium.json --entrypoint chromium qrisaw --headless --disable-background-networking --dump-dom about:blank` — harus mengeluarkan HTML. Jika host membatasi user namespace lewat AppArmor (Ubuntu 23.10+, cek `sysctl kernel.apparmor_restrict_unprivileged_userns`), pembuatan namespace masih bisa ditolak; dalam kasus itu gunakan sesi manual melalui `POST /health/session` dan kosongkan kredensial auto-login.
Jika Chromium melaporkan sandbox ditolak, `/health` menampilkan `data.auth.browserLoginError: "CHROMIUM_SANDBOX_UNAVAILABLE"`. Proses menghentikan percobaan browser sampai restart. Sesi manual tetap dapat digunakan. Tanpa sesi, endpoint yang membutuhkan akun mengembalikan `503`; `401` untuk kunci admin salah tetap berlaku.

### 5. Single Binary (via Bun)

Untuk distribusi sebagai single binary tanpa Node.js:

```bash
# 1. Build single binary
npm run build

# 2. Jalankan
./qrisaw
```

Instal Chromium dari pengelola paket OS, atau arahkan `CHROME_PATH` ke instalasi browser tepercaya.
Pastikan Xvfb terinstall di Linux tanpa GUI (`sudo apt install -y xvfb`).

---

## 📂 Project Structure

```
├── app.js                       # Entry point & app config
├── docs/                        # OpenAPI specification
├── src/
│   ├── browser/                 # Browser login, Chrome detection, Turnstile handling
│   ├── configs/                 # Axios instance & interceptors
│   ├── controllers/             # Request handlers
│   ├── middlewares/             # Express middlewares
│   ├── routes/                  # Express routes
│   ├── services/                # API calls, session management and refresh
│   └── utils/                   # Helper (session, response, logger)
└── session.json                 # Saved session (auto-generated, gitignored)
```

---

## 🛠 API Endpoints

| Method | Endpoint                          | Description               |
| ------ | --------------------------------- | ------------------------- |
| `GET`  | `/`                               | API info (dev: full endpoints, prod: minimal) |
| `GET`  | `/api-docs`                       | Swagger UI (Dev Only)     |
| `GET`  | `/health`                         | Server & auth health check|
| `POST` | `/health/session`                 | Set session manually      |
| `POST` | `/api/payments/qris`              | Buat QRIS Payment         |
| `GET`  | `/api/payments/:id/status`        | Cek status transaksi      |
| `GET`  | `/api/payments/balance`           | Cek total saldo           |
| `GET`  | `/api/payments/balance/available` | Cek saldo siap tarik      |
| `GET`  | `/api/payments/transactions`      | Daftar transaksi terakhir |
| `GET`  | `/api/users`                      | Info profil user          |

---

## 🔒 Security & Robustness

- **JWT Validation**: Mengecek expiry token sebelum dipakai untuk menghindari request sia-sia.
- **Mutex Re-login**: Jika banyak request gagal 401 bersamaan, sistem hanya akan melakukan 1x proses login ulang.
- **Production Mode**: Swagger UI otomatis dimatikan jika `NODE_ENV=production`.
- **Akses privat**: Kirim header `X-Admin-Key` dari backend untuk mengganti sesi, membaca profil, saldo, atau riwayat transaksi. Jangan kirim kunci ke frontend. Tanpa `ADMIN_KEY`, endpoint privat mengembalikan `403`; kunci salah atau tidak dikirim menghasilkan `401`. Pembuatan QRIS dan cek status tetap publik.
- **Reverse proxy**: Compose hanya membuka port di `127.0.0.1`. Untuk akses eksternal, gunakan reverse proxy HTTPS. Isi `TRUSTED_PROXY` dengan IP proxy tepercaya hanya jika proxy tersebut menimpa header `X-Forwarded-For`.
- **Structured Logging**: JSON output di production, colorized di development (Winston).

---

## 🤝 Contributing

Kontribusi terbuka untuk siapa saja. Ikuti langkah berikut:

1. **Fork** repo ini
2. **Clone** fork kamu: `git clone git@github.com:username/qrisaw.git`
3. **Install dependencies**: `npm install`
4. **Setup environment**: Copy `.env.example` ke `.env`, isi `SAWERIA_EMAIL` dan `SAWERIA_PASSWORD`
5. **Jalankan dev server**: `npm run dev` (auto-restart on file changes via `node --watch`)
6. **Buat branch baru**: `git checkout -b feat/nama-fitur` atau `git checkout -b fix/nama-bug`
7. **Commit** dengan pesan yang jelas. Format: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
8. **Push** ke fork kamu: `git push origin feat/nama-fitur`
9. **Buka Pull Request** ke `main` branch repo ini

### Code Style

- Gunakan pattern yang sudah ada (MVC: routes → controllers → services)
- Response API wajib pakai `success()` / `error()` dari `src/utils/response.js`
- Jangan tambah dependency baru kalau bisa diselesaikan dengan yang sudah ada
- Jalankan `npm test` sebelum push. Jalankan `npm run test:docker` untuk menguji startup container tanpa kredensial Saweria.

### Swagger / OpenAPI

Dokumentasi API ada di `docs/openapi.yaml`. Kalau tambah/ubah endpoint, update juga spec-nya. Swagger UI tersedia di `http://localhost:3000/api-docs` (dev mode saja).

---

## Disclaimer

Proyek ini dibuat untuk tujuan pembelajaran dan portofolio. Tidak berafiliasi dengan Saweria. Penggunaan robotik pada akun Saweria mungkin melanggar TOS mereka. Gunakan dengan bijak.

---

## 📄 License

Distributed under the [MIT License](./LICENSE). See `LICENSE` for full text.

> **Note**: This software is not affiliated with, endorsed by, or sponsored by Saweria. Usage may violate Saweria's Terms of Service. Use at your own risk.
