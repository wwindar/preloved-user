# Pre-Loved Marketplace — User Service

REST API User Service berstandar enterprise yang dirancang untuk platform **Pre-Loved Marketplace** (jual-beli barang bekas layak pakai) dengan arsitektur **Microservices**. Dibangun menggunakan **Express.js**, **TypeScript** (Strict Mode), **MySQL**, dan **Prisma ORM**.

---

## 1. Project Overview & Arsitektur

User Service merupakan service inti yang mengelola identitas, sesi, profil, dan autentikasi pengguna secara independen dari service marketplace lainnya (seperti Product Service, Order Service, atau Chat Service).

### Karakteristik Arsitektur
- **Database Isolation**: Memiliki dan mengelola database MySQL sendiri (`preloved_user_service`), tanpa foreign key ke database service lain.
- **Microservice Identifier**: Menggunakan `id` (UUID) sebagai identitas referensial lintas seluruh service.
- **Stateless & State-Aware JWT**: Access Token berumur pendek (15 menit) diverifikasi secara efisien, dengan pengecekan status akun aktif dan status pencabutan sesi di database untuk endpoint terproteksi.
- **Refresh Token Rotation**: Mencegah serangan replay dan token theft. Token lama langsung dicabut begitu di-refresh.
- **Internal Service Authentication**: Komunikasi antar-service (inter-microservice) diamankan dengan shared secret melalui header `X-Internal-Secret`.

---

## 2. Struktur Database

Database dirancang secara ringkas dan aman dengan hanya 3 tabel utama sesuai spesifikasi:

```
┌─────────────────────────────────┐
│              users              │
├─────────────────────────────────┤
│ id: VARCHAR(36) [PK, UUID]      │
│ username: VARCHAR(50) [UNIQUE]  │
│ email: VARCHAR(255) [UNIQUE]    │
│ password_hash: VARCHAR(255)     │
│ role: ENUM ('USER', 'ADMIN')    │
│ is_active: BOOLEAN (default 1)  │
│ created_at: DATETIME(3)         │
│ updated_at: DATETIME(3)         │
└────────────────┬────────────────┘
                 │ 1:1
                 ▼
┌─────────────────────────────────┐
│          user_profiles          │
├─────────────────────────────────┤
│ id: VARCHAR(36) [PK, UUID]      │
│ user_id: VARCHAR(36) [FK, UNIQ] │
│ full_name: VARCHAR(100)         │
│ phone_number: VARCHAR(20) [NULL]│
│ profile_picture: VARCHAR(500)   │
│ bio: TEXT [NULL]                │
│ address: TEXT [NULL]            │
│ created_at: DATETIME(3)         │
│ updated_at: DATETIME(3)         │
└─────────────────────────────────┘
                 │ 1:N
                 ▼
┌─────────────────────────────────┐
│          auth_sessions          │
├─────────────────────────────────┤
│ id: VARCHAR(36) [PK, UUID]      │
│ user_id: VARCHAR(36) [FK]       │
│ refresh_token_hash: VARCHAR(255)│
│ expires_at: DATETIME(3)         │
│ revoked_at: DATETIME(3) [NULL]  │
│ created_at: DATETIME(3)         │
└─────────────────────────────────┘
```

### Relasi & Aturan Database:
1. `users` ke `user_profiles`: One-to-One (1:1). Pembuatan data dibuat atomik dalam satu **Prisma Transaction** saat registrasi.
2. `users` ke `auth_sessions`: One-to-Many (1:N). Pengguna dapat login dari beberapa perangkat.
3. Refresh token disimpan dalam bentuk hash kriptografis (`SHA-256`), bukan string mentah.
4. Password pengguna di-hash menggunakan algoritma `bcrypt` dengan salt rounds terkonfigurasi.

---

## 3. Struktur Proyek

```
User-service/
├── prisma/
│   ├── schema.prisma              # Definisi model & relasi Prisma
│   └── migrations/                # SQL Migration history
├── src/
│   ├── config/
│   │   ├── database.ts            # Prisma client instance singleton
│   │   └── env.ts                 # Validasi Zod untuk environment variables
│   ├── docs/
│   │   └── swagger.ts             # Spesifikasi OpenAPI 3.0 / Swagger
│   ├── middlewares/
│   │   ├── authenticate.ts        # Verifikasi Bearer JWT & status aktif
│   │   ├── authorize.ts           # Role-based access control (RBAC)
│   │   ├── error-handler.ts       # Centralized error handler
│   │   ├── internal-auth.ts       # Shared secret auth header antar-service
│   │   ├── rate-limiter.ts        # IP rate limiter untuk endpoint sensitif
│   │   └── validate.ts            # Request body/param schema validator
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts # Handler HTTP auth
│   │   │   ├── auth.routes.ts     # Route definitions
│   │   │   ├── auth.service.ts    # Bisnis logic autentikasi & rotasi token
│   │   │   └── auth.validation.ts # Zod schema untuk register, login, refresh
│   │   └── users/
│   │       ├── user.controller.ts # Handler HTTP profil & internal
│   │       ├── user.routes.ts     # Route profile (/me) & internal (/internal)
│   │       ├── user.service.ts    # Bisnis logic profil & update password
│   │       └── user.validation.ts # Zod schema untuk update profil & password
│   ├── types/
│   │   └── express.d.ts           # Deklarasi tipe kustom Request Express
│   ├── utils/
│   │   ├── errors.ts              # Custom AppError class
│   │   ├── jwt.ts                 # Generator & verifier JWT access/refresh
│   │   ├── password.ts            # Hashing bcrypt & SHA-256 token
│   │   └── response.ts            # Standard format response API
│   ├── app.ts                     # Konfigurasi Express, middleware, & routes
│   └── server.ts                  # Entry point bootstrap server
├── postman/
│   ├── user-service.postman_collection.json   # 22 automated test scenarios
│   └── user-service.postman_environment.json  # Postman environment variables
├── tests/
│   └── run-api-tests.ts           # Automated end-to-end test runner
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. Keamanan (API Security Architecture)

1. **Password Hashing**: Menggunakan `bcrypt` dengan salt rounds terkonfigurasi (default: 12).
2. **Dual-Token System (JWT)**:
   - **Access Token**: Masa aktif singkat (15 menit), digunakan pada header `Authorization: Bearer <token>`.
   - **Refresh Token**: Masa aktif lebih panjang (7 hari), digunakan untuk regenerasi access token.
3. **Refresh Token Rotation & Revocation**:
   - Setiap penggunaan refresh token akan menerbitkan refresh token baru dan langsung mencabut token sebelumnya (`revoked_at`).
   - Token lama tidak dapat digunakan kembali. Upaya pemakaian ulang terdeteksi sebagai anomali sesi.
4. **Mass Assignment Prevention**:
   - Validasi ketat menggunakan Zod `.strict()`. Request update profile yang mencoba mengirim `user_id`, `role`, `email`, atau atribut tak berizin langsung ditolak (`400 Bad Request`).
5. **No Data Leakage**:
   - `password_hash` dan `refresh_token_hash` difilter di level query Prisma (`select`) sehingga tidak pernah bocor ke response client maupun log aplikasi.
   - Pesan error login generik: `"Email/username atau password salah"` guna mencegah teknik user enumeration.
6. **HTTP Security Headers**: Menggunakan `helmet` untuk mengamankan headers.
7. **Rate Limiting**: Membatasi request login dan register per IP menggunakan `express-rate-limit`.
8. **Internal Endpoint Protection**: Endpoint `/api/v1/internal/*` hanya dapat diakses dengan shared secret `X-Internal-Secret`.

---

## 5. Standar Format Response API

### Response Sukses
```json
{
  "success": true,
  "message": "Deskripsi sukses",
  "data": { ... }
}
```

### Response Gagal
```json
{
  "success": false,
  "message": "Deskripsi kesalahan",
  "errors": null
}
```

### Kode Status HTTP:
- `200 OK`: Permintaan berhasil diproses.
- `201 Created`: Sumber daya berhasil dibuat (contoh: Register).
- `400 Bad Request`: Validasi input gagal atau data tidak valid.
- `401 Unauthorized`: Token tidak valid, kedaluwarsa, sesi dicabut, atau credential salah.
- `403 Forbidden`: Akun dinonaktifkan atau akses role tidak diizinkan.
- `404 Not Found`: Pengguna atau endpoint tidak ditemukan.
- `409 Conflict`: Username atau email sudah terdaftar.
- `429 Too Many Requests`: Melebihi ambang batas rate limit.
- `500 Internal Server Error`: Terjadi kesalahan pada server (stack trace disembunyikan di production).

---

## 6. Instalasi & Cara Menjalankan

### Prasyarat
- Node.js v18+ (direkomendasikan v20+)
- MySQL Server / MariaDB v10.4+
- Port MySQL 3306 terbuka

### Langkah Instalasi
1. Clone atau masuk ke direktori service:
   ```bash
   cd User-service
   ```
2. Salin environment configuration:
   ```bash
   cp .env.example .env
   ```
   *Sesuaikan `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, dan `INTERNAL_SERVICE_SECRET` pada file `.env`.*
3. Install dependensi:
   ```bash
   npm install
   ```
4. Jalankan migrasi Prisma untuk membuat tabel database:
   ```bash
   npx prisma migrate dev --name init_users_and_auth
   ```
5. Build aplikasi TypeScript:
   ```bash
   npm run build
   ```
6. Jalankan service:
   - **Mode Development (Watch mode)**:
     ```bash
     npm run dev
     ```
   - **Mode Production**:
     ```bash
     npm run start
     ```

Service akan aktif di: `http://localhost:3001`
Dokumentasi interaktif Swagger dapat diakses di: `http://localhost:3001/api-docs`

---

## 7. Daftar Endpoint API

### A. Autentikasi (`/api/v1/auth`)

| Method | Endpoint | Keterangan | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Mendaftarkan akun dan profil pengguna | Publik (Rate limited) |
| `POST` | `/api/v1/auth/login` | Login menggunakan email atau username | Publik (Rate limited) |
| `POST` | `/api/v1/auth/logout` | Mencabut sesi autentikasi saat ini | Bearer Token |
| `POST` | `/api/v1/auth/refresh` | Rotasi refresh token dan penerbitan access token baru | Body `refreshToken` |

### B. User Profile (`/api/v1/users`)

| Method | Endpoint | Keterangan | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | Mengambil data akun & profil pengguna login | Bearer Token |
| `PATCH` | `/api/v1/users/me` | Memperbarui profil pengguna (fullName, bio, address, dll) | Bearer Token |
| `PATCH` | `/api/v1/users/me/password` | Mengubah password dan mencabut sesi lama | Bearer Token |

### C. Internal Service (`/api/v1/internal`)

| Method | Endpoint | Keterangan | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/internal/users/:id` | Mengambil data publik profil untuk service lain | Header `X-Internal-Secret` |

---

## 8. Panduan Pengujian Postman

File pengujian telah disediakan di folder `postman/`:
- `postman/user-service.postman_collection.json`
- `postman/user-service.postman_environment.json`

### Cara Mengimpor & Menjalankan:
1. Buka aplikasi **Postman**.
2. Klik tombol **Import** dan pilih kedua file JSON di atas.
3. Pilih Environment: **Pre-Loved Marketplace - User Service Environment**.
4. Jalankan folder collection atau jalankan runner:
   - Request diurutkan secara berurutan (Register -> Login -> Token Rotation -> Logout -> Revocation Check -> Profile -> Change Password -> Internal Endpoint).
   - Test script Postman secara otomatis menyimpan `access_token`, `refresh_token`, dan `user_id` ke environment variabel.
5. **Cara Menguji Ulang Bila Sesi Kedaluwarsa/Dicabut**:
   - Cukup jalankan request `6. Login - Using Username Success` atau `14. Re-Login For Profile Tests`. Token baru akan otomatis tersimpan di environment.

---

## 9. Panduan Integrasi Antar-Microservice

Untuk microservice seperti **Product Service**, **Order Service**, atau **Chat Service**:

1. **Validasi Pemilik Barang / Transaksi**:
   - Saat pengguna membuat produk di Product Service, client mengirim header `Authorization: Bearer <access_token>`.
   - Product Service dapat memverifikasi JWT menggunakan public secret yang sama ATAU memanggil endpoint internal User Service:
   ```http
   GET /api/v1/internal/users/{seller_uuid} HTTP/1.1
   Host: user-service:3001
   X-Internal-Secret: <INTERNAL_SERVICE_SECRET>
   ```
2. **Response Internal Endpoint**:
   ```json
   {
     "success": true,
     "message": "Data pengguna internal berhasil diambil",
     "data": {
       "user": {
         "id": "c620459c-6a69-4f70-a3bc-2dfdfc3bfdb3",
         "username": "windar",
         "email": "windar@example.com",
         "role": "USER",
         "isActive": true,
         "createdAt": "2026-11-25T09:00:00.000Z",
         "profile": {
           "id": "78083818-a6e5-4a6c-b472-ee1ca46f6ee9",
           "fullName": "Windar Wening",
           "phoneNumber": "081234567890",
           "profilePicture": null,
           "bio": "Penjual terpercaya barang pre-loved",
           "address": "Surakarta"
         }
       }
     }
   }
   ```
3. **Data Sensitif Terlindungi**:
   - User Service menjamin `password_hash` dan `refresh_token_hash` **tidak akan pernah** dikembalikan melalui endpoint internal.
