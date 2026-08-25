/** 未登入時導向登入頁，登入後回到原頁（returnTo）。 */
export function loginHref(returnTo?: string | null): string {
  if (!returnTo || returnTo === "/login") return "/login";
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/** 僅接受站內絕對路徑，擋掉 //evil.com 之類的開放轉址 */
export function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
