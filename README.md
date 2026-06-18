# Zenit — E-Commerce Sandbox

> Universitas Atma Jaya Yogyakarta**  
> Program Studi Informatika · NIM 220711833

Zenit adalah aplikasi e-commerce yang digunakan sebagai **sandbox** untuk membandingkan performa REST API dan tRPC. Dibangun sebagai pnpm monorepo dan di-deploy di DigitalOcean VPS.

---

## Structure

```
e-commerce/
├── apps/
│   ├── backend-rest/    # Express.js REST API  (port 4000)
│   ├── backend-trpc/    # tRPC v11 server      (port 4001)
│   └── frontend/        # Next.js
└── packages/
    └── shared/          # Prisma client, Redis helper, shared types
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22.x |
| REST backend | Express.js |
| RPC backend | tRPC v11 |
| Frontend | Next.js 14 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Package manager | pnpm (monorepo) |

---

## VPS

DigitalOcean — Ubuntu 24.04 LTS · 4 vCPU · 8 GB RAM

Kedua backend (REST & tRPC) berjalan di VPS yang **sama** untuk memastikan kondisi pengujian yang adil.

---

## Notes

- Redis digunakan sebagai **read-through cache** untuk query produk dan kategori saja, bukan session store.
- Auth: REST menggunakan **httpOnly cookie**, tRPC menggunakan **Authorization Bearer header**.

---

## Author

**Angello Khara Sitanggang** · NIM 220711833  
Informatika — Universitas Atma Jaya Yogyakarta · [@ANTIMOLE](https://github.com/ANTIMOLE)
