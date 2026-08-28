import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 排除 api、Next 內部路徑與含副檔名的靜態檔
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
