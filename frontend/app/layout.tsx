import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const SITE_DISCLAIMER = "本平台為技術展示原型，估算值不構成經查證之碳權";

export const metadata: Metadata = {
  title: "綠鏈林匯 GreenChain Timber",
  description: "數位 MRV 碳權透明化平台——圈地、估算、上鏈、驗證",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="flex min-h-screen flex-col bg-stone-50 text-stone-900 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-stone-200 bg-white py-3 text-center text-xs text-stone-500">
          {SITE_DISCLAIMER}
        </footer>
      </body>
    </html>
  );
}
