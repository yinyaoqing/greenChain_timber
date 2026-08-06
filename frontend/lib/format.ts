/** 數字顯示格式化（千分位；面積 2 位小數、碳匯 2 位小數） */
export function formatHa(v: number): string {
  return `${v.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

export function formatCo2e(v: number): string {
  return `${v.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 噸 CO₂e/年`;
}
