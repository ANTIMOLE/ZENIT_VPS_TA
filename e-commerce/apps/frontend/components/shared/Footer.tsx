import Link from "next/link";
import Image from "next/image";
import {
  Instagram,
  Facebook,
  Youtube,
  Mail,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";

const SOCIALS: {
  Icon: LucideIcon;
  label: string;
  href: string;
  hoverClass: string;
}[] = [
  {
    Icon: Instagram,
    label: "Instagram",
    href: "#",
    hoverClass: "hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#bc1888] hover:text-white",
  },
  {
    Icon: Facebook,
    label: "Facebook",
    href: "#",
    hoverClass: "hover:bg-[#1877F2] hover:text-white",
  },
  {
    Icon: Youtube,
    label: "YouTube",
    href: "#",
    hoverClass: "hover:bg-[#FF0000] hover:text-white",
  },
  {
    Icon: Mail,
    label: "Email",
    href: "mailto:hello@zenit.id",
    hoverClass: "hover:bg-white hover:text-[#111]",
  },
];

const PAYMENTS = ["QRIS", "BCA", "Mandiri", "GoPay", "OVO"];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-[3px] h-3.5 rounded-full bg-primary flex-shrink-0" />
      <h4 className="text-[12px] font-semibold text-white/70">{children}</h4>
    </div>
  );
}

function SocialLink({
  icon: Icon,
  label,
  href,
  hoverClass,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  hoverClass: string;
}) {
  const classes =
    "flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[#999] transition-colors duration-200 " +
    hoverClass;

  return (
    <a href={href} aria-label={label} className={classes}>
      <Icon className="w-4 h-4" />
    </a>
  );
}

export function Footer() {
  return (
    <footer className="relative bg-[#0e0e12] text-white mt-auto overflow-hidden">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#7c3aed] to-transparent opacity-60" />

      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[8%] w-[420px] h-[420px] rounded-full bg-[#7c3aed]/[0.10] blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-[5%] w-[300px] h-[300px] rounded-full bg-fuchsia-500/[0.06] blur-[90px]"
      />

      <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between pb-9 mb-9 border-b border-white/[0.06]">
          <div>
            <Image
              src="/zenit-logo.svg"
              alt="Zenit"
              width={92}
              height={26}
              className="brightness-0 invert opacity-90 mb-3"
            />
            <p className="text-sm text-[#8a8a92] leading-relaxed max-w-[280px]">
              50.000+ produk dari berbagai kategori, dikirim ke seluruh Indonesia.
            </p>
          </div>

          <Link
            href={ROUTES.PRODUCTS}
            className="group/cta inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] px-5 h-11 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(124,58,237,0.5)] transition-[gap,box-shadow] duration-300 hover:gap-3 hover:shadow-[0_10px_28px_-4px_rgba(124,58,237,0.65)]"
          >
            Mulai Belanja
            <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <FooterHeading>Belanja</FooterHeading>
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

          <div>
            <FooterHeading>Akun</FooterHeading>
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

          <div>
            <FooterHeading>Bantuan</FooterHeading>
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

          <div>
            <FooterHeading>Ikuti Kami</FooterHeading>
            <div className="flex items-center gap-2">
              {SOCIALS.map((social) => (
                <SocialLink
                  key={social.label}
                  icon={social.Icon}
                  label={social.label}
                  href={social.href}
                  hoverClass={social.hoverClass}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-8 mb-8 border-b border-white/[0.06]">
          <span className="text-[11px] text-[#666] mr-1">Pembayaran:</span>
          {PAYMENTS.map((method) => (
            <span
              key={method}
              className="text-[11px] font-medium text-[#999] bg-white/[0.05] rounded-md px-2 py-1"
            >
              {method}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#555]">
            © 2025 Zenit Marketplace. Hak cipta dilindungi.
          </p>
          <p className="text-xs text-[#555]">
            Dibuat untuk thesis — REST vs tRPC
          </p>
        </div>
      </div>
    </footer>
  );
}