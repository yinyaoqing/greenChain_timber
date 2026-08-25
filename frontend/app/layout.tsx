import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const SITE_DISCLAIMER =
  "本平台為技術展示原型｜呈現碳匯量測與監測數據，估算值不等於亦不構成經查證之減量額度";

export const metadata: Metadata = {
  title: "綠鏈林匯 GreenChain Timber",
  description: "森林碳匯數位 MRV 監測與存證平台——林區建檔、空間查核、固碳估算、上鏈驗證",
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
