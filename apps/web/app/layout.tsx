import type { Metadata } from "next";
import { TRPCProvider } from "@/lib/trpc/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "مساحة بوح",
  description: "مساحتك الآمنة للتعبير",
};

// Disable static prerendering for the whole app — every page uses tRPC/auth
// client-side, so SSG/ISR has no benefit and triggers prerender errors.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
