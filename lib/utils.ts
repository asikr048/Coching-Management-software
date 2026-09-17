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

/**
 * Safely extracts the weekly schedule array from exam.result_note tag:
 * [WEEKLY_SCHEDULE:[{...}]]
 */
export function extractWeeklyScheduleFromNote(note?: string | null): any[] | null {
  if (!note || typeof note !== "string" || !note.includes("[WEEKLY_SCHEDULE:")) return null

  // 1. Try matching [WEEKLY_SCHEDULE:([...])]
  const match = note.match(/\[WEEKLY_SCHEDULE:(\[[\s\S]*?\])\]/)
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }

  // 2. Bracket-balancing parser for malformed or nested tags
  const startIdx = note.indexOf("[WEEKLY_SCHEDULE:")
  if (startIdx !== -1) {
    const after = note.slice(startIdx + "[WEEKLY_SCHEDULE:".length)
    const jsonStart = after.indexOf("[")
    if (jsonStart !== -1) {
      let depth = 0
      for (let i = jsonStart; i < after.length; i++) {
        if (after[i] === "[") depth++
        else if (after[i] === "]") {
          depth--
          if (depth === 0) {
            try {
              const parsed = JSON.parse(after.slice(jsonStart, i + 1))
              if (Array.isArray(parsed) && parsed.length > 0) return parsed
            } catch {}
            break
          }
        }
      }
    }
  }

  return null
}

/**
 * Safely removes [WEEKLY_SCHEDULE:...] and related metadata tags from result_note
 */
export function cleanWeeklyScheduleFromNote(note?: string | null): string {
  if (!note || typeof note !== "string") return ""
  return note
    .replace(/\[WEEKLY_SCHEDULE:(\[[\s\S]*?\])\]/g, "")
    .replace(/\[WEEKLY_SCHEDULE:[^\]]*\]\]?/g, "")
    .replace(/\[WEEKLY_DAYS:[^\]]*\]/g, "")
    .trim()
}

