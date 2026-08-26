import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "৳0"
  return `৳${amount.toLocaleString("en-BD")}`
}

export function formatDate(date: string | Date): string {
  if (!date) return "-"
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  if (!date) return "-"
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date))
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

export function getGrade(obtained: number, total: number): string {
  const pct = (obtained / total) * 100
  if (pct >= 80) return "A+"
  if (pct >= 70) return "A"
  if (pct >= 60) return "A-"
  if (pct >= 50) return "B"
  if (pct >= 40) return "C"
  if (pct >= 33) return "D"
  return "F"
}
