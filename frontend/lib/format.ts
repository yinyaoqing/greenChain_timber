/** 數字顯示格式化（千分位；面積 2 位小數） */
export function formatHa(v: number, locale: string): string {
  return `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}
