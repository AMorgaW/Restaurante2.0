import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-5 py-10">
      <Link href="/" aria-label="Volver a la portada"><BrandMark size="md" /></Link>
      {children}
    </main>
  );
}
