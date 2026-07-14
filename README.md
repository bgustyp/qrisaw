# Qrisaw (Unofficial)

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
# ADMIN_KEY=your-secret-admin-key
```

### 3. Instalasi & Jalan

```bash
npm install
npm start
```

### 4. Docker (recommended untuk server)

```bash
docker compose up -d
```

Atau build manual:

```bash
docker build -t qrisaw .
docker run -d -p 3000:3000 --env-file .env qrisaw
```

Image sudah bundle Chromium + Xvfb. Tidak perlu install apa-apa di host.

### 5. Single Binary (via Bun)

Untuk distribusi sebagai single binary tanpa Node.js:

```bash
# 1. Download Chromium lokal
npm run setup:chromium

# 2. Build single binary
npm run build

# 3. Jalankan
./qrisaw
```

Binary akan auto-detect Chromium di `./chromium/` (dari step 1) atau Chrome system.
Pastikan Xvfb terinstall di Linux tanpa GUI (`sudo apt install -y xvfb`).

---

## 📂 Project Structure

```
├── app.js                       # Entry point & app config
├── docs/                        # OpenAPI specification
├── src/
│   ├── browser/                 # Browser automation (chrome-locator, turnstile-solver)
│   ├── configs/                 # Axios instance & interceptors
│   ├── controllers/             # Request handlers
│   ├── middlewares/             # Express middlewares
│   ├── routes/                  # Express routes
│   ├── services/                # API calls, auth, captcha orchestration
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
- **Admin Key Protection**: Endpoint `POST /health/session` dilindungi `ADMIN_KEY` (opsional).
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
- Test perubahan sebelum push: `npm run dev` lalu cek endpoint yang relevan

### Swagger / OpenAPI

Dokumentasi API ada di `docs/openapi.yaml`. Kalau tambah/ubah endpoint, update juga spec-nya. Swagger UI tersedia di `http://localhost:3000/api-docs` (dev mode saja).

---

## Disclaimer

Proyek ini dibuat untuk tujuan pembelajaran dan portofolio. Tidak berafiliasi dengan Saweria. Penggunaan robotik pada akun Saweria mungkin melanggar TOS mereka. Gunakan dengan bijak.

---

## 📄 License

Distributed under the [MIT License](./LICENSE). See `LICENSE` for full text.

> **Note**: This software is not affiliated with, endorsed by, or sponsored by Saweria. Usage may violate Saweria's Terms of Service. Use at your own risk.
