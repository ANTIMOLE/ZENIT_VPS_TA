import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col">
      {/* Simple header */}
      <header className="bg-white border-b border-[#ebebeb] px-6 h-[58px] flex items-center">
        <Link href="/">
          <Image src="/zenit-logo.svg" alt="Zenit" width={80} height={24} />
        </Link>
      </header>

      {/* Centered content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>

      <footer className="text-center py-4 text-[11px] text-[#bbb]">
        © 2025 Zenit Marketplace
      </footer>
    </div>
  );
}
