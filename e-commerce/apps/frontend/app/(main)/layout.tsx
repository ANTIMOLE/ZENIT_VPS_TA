import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ShiftBackground } from "@/components/shared/ShiftBackground";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Same portal-to-body background used on the auth pages. Root wrapper
          here has no bg-white anymore on purpose — Navbar/Footer almost
          certainly paint their own solid background already, so this only
          changes what shows through in the gaps/whitespace between
          sections. */}
      <ShiftBackground />
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}