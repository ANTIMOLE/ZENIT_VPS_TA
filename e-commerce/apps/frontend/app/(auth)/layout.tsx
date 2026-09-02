// import Link from "next/link";
// import Image from "next/image";
// import { ShiftBackground } from "@/components/shared/ShiftBackground";

// export default function AuthLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <div className="min-h-screen flex flex-col">
//       {/* Mounted once here instead of per-page. It portals itself into
//           document.body, so it doesn't matter that this div has no
//           position/background of its own — it renders as a totally
//           separate fixed layer regardless of where it's called from. */}
//       <ShiftBackground />

//       {/* Simple header */}
//       <header className="bg-white/70 backdrop-blur-md border-b border-white/40 px-6 h-[58px] flex items-center">
//         <Link href="/">
//           <Image src="/zenit-logo.svg" alt="Zenit" width={80} height={24} />
//         </Link>
//       </header>

//       {/* Centered content — trimmed from py-10 to py-6. The page itself no
//           longer forces its own min-h-[100dvh] block, so this is the only
//           place doing vertical centering now; the old double-padding (this
//           py-10 plus the page's own py-10/14) was part of what pushed the
//           card down and forced a scroll. */}
//       <main className="flex-1 flex items-center justify-center px-4 py-6">
//         {children}
//       </main>

//       <footer className="text-center py-4 text-[11px] text-[#999]">
//         © 2025 Zenit Marketplace
//       </footer>
//     </div>
//   );
// }

import { ShiftBackground } from "@/components/shared/ShiftBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Mounted once here instead of per-page. It portals itself into
          document.body, so it doesn't matter that this div has no
          position/background of its own — it renders as a totally
          separate fixed layer regardless of where it's called from. */}
      <ShiftBackground />

      {/* No page header anymore — each page (login/register) now carries
          its own logo + "back home" link inside the glass card itself, so
          there's one less band of chrome eating into the vertical space. */}
      <main className="flex-1 flex items-center justify-center px-4 py-4">
        {children}
      </main>

      <footer className="text-center py-3 text-[11px] text-zinc-600/70">
        © 2025 Zenit Marketplace
      </footer>
    </div>
  );
}