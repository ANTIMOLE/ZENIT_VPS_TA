import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-[#0e0e12] text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            {/* Logo dengan invert karena background gelap */}
            <div className="mb-3">
              <Image
                src="/zenit-logo.svg"
                alt="Zenit"
                width={80}
                height={24}
                className="brightness-0 invert opacity-90"
              />
            </div>
            <p className="text-sm text-[#666] leading-relaxed max-w-[200px]">
              Platform belanja dengan 50.000+ produk dari berbagai kategori.
            </p>
          </div>

          {/* Belanja */}
          <div>
            <h4 className="text-xs font-semibold text-[#555] uppercase tracking-widest mb-4">Belanja</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/products" className="text-sm text-[#888] hover:text-white transition-colors">
                  Semua Produk
                </Link>
              </li>
              <li>
                <Link href="/products?sortBy=sold_count" className="text-sm text-[#888] hover:text-white transition-colors">
                  Terlaris
                </Link>
              </li>
              <li>
                <Link href="/products?sortBy=created_at" className="text-sm text-[#888] hover:text-white transition-colors">
                  Terbaru
                </Link>
              </li>
            </ul>
          </div>

          {/* Akun */}
          <div>
            <h4 className="text-xs font-semibold text-[#555] uppercase tracking-widest mb-4">Akun</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/login" className="text-sm text-[#888] hover:text-white transition-colors">
                  Masuk
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-sm text-[#888] hover:text-white transition-colors">
                  Daftar
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-sm text-[#888] hover:text-white transition-colors">
                  Pesanan Saya
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-sm text-[#888] hover:text-white transition-colors">
                  Profil
                </Link>
              </li>
            </ul>
          </div>

          {/* Bantuan */}
          <div>
            <h4 className="text-xs font-semibold text-[#555] uppercase tracking-widest mb-4">Bantuan</h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-sm text-[#888] hover:text-white transition-colors cursor-pointer">
                  Pusat Bantuan
                </span>
              </li>
              <li>
                <span className="text-sm text-[#888] hover:text-white transition-colors cursor-pointer">
                  Kebijakan Privasi
                </span>
              </li>
              <li>
                <span className="text-sm text-[#888] hover:text-white transition-colors cursor-pointer">
                  Syarat & Ketentuan
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1e1e24] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#444]">
            © 2025 Zenit Marketplace. Hak cipta dilindungi.
          </p>
          <p className="text-xs text-[#444]">
            Dibuat untuk thesis — REST vs tRPC
          </p>
        </div>
      </div>
    </footer>
  );
}
