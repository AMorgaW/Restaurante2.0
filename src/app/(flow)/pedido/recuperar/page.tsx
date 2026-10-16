import type { Metadata } from "next";
import { GuestReceiptRecoveryScreen } from "@/components/checkout/guest-receipt-recovery-screen";
import { isGuestReceiptRecoveryEnabled } from "@/lib/env/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recuperar comprobante",
  referrer: "no-referrer",
  robots: { index: false, follow: false, nocache: true },
};

export default function RecoverReceiptPage() {
  return <GuestReceiptRecoveryScreen enabled={isGuestReceiptRecoveryEnabled()} />;
}
