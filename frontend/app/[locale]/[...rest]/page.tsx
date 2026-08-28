import { notFound } from "next/navigation";

// 攔截 [locale] 底下所有未定義路徑，交給同層 not-found.tsx 顯示在地化 404，
// 避免退回框架層級、未在地化的預設 404 頁。
export default function CatchAll(): never {
  notFound();
}
