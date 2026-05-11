"use strict";
// prisma/clean.ts
// Jalankan: npx ts-node prisma/clean.ts
// Truncate semua table dalam urutan yang aman (child dulu baru parent)
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../generated/prisma");
const adapter_pg_1 = require("@prisma/adapter-pg");
require("dotenv/config");
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new prisma_1.PrismaClient({ adapter });
async function clean() {
    console.log('🧹 Cleaning database...\n');
    // Urutan: child tables dulu, baru parent
    const steps = [
        ['order_items', () => prisma.orderItem.deleteMany()],
        ['orders', () => prisma.order.deleteMany()],
        ['cart_items', () => prisma.cartItem.deleteMany()],
        ['carts', () => prisma.cart.deleteMany()],
        ['addresses', () => prisma.address.deleteMany()],
        ['refresh_tokens', () => prisma.refreshToken.deleteMany()],
        ['users', () => prisma.user.deleteMany()],
        ['products', () => prisma.product.deleteMany()],
        ['categories', () => prisma.category.deleteMany()],
    ];
    for (const [table, fn] of steps) {
        const { count } = await fn();
        console.log(`  ✅ ${table}: ${count} rows deleted`);
    }
    console.log('\n🎉 Database clean!');
}
clean()
    .catch((e) => {
    console.error('❌ Clean failed:', e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=clean.js.map