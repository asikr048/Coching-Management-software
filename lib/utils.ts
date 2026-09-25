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
  if (total <= 0 || isNaN(obtained) || obtained === null) return "F"
  const pct = Math.round((obtained / total) * 100)
  if (pct >= 80) return "A+"
  if (pct >= 70) return "A"
  if (pct >= 60) return "A-"
  if (pct >= 50) return "B"
  if (pct >= 40) return "C"
  if (pct >= 33) return "D"
  return "F"
}

export function getGradePoint(obtained: number, total: number): number {
  if (total <= 0 || isNaN(obtained) || obtained === null) return 0.0
  const pct = Math.round((obtained / total) * 100)
  if (pct >= 80) return 5.0
  if (pct >= 70) return 4.0
  if (pct >= 60) return 3.5
  if (pct >= 50) return 3.0
  if (pct >= 40) return 2.0
  if (pct >= 33) return 1.0
  return 0.0
}

export function getGradeRemarks(obtained: number, total: number): string {
  if (total <= 0 || isNaN(obtained) || obtained === null) return "Fail"
  const pct = Math.round((obtained / total) * 100)
  if (pct >= 80) return "Outstanding"
  if (pct >= 70) return "Excellent"
  if (pct >= 60) return "Very Good"
  if (pct >= 50) return "Good"
  if (pct >= 40) return "Satisfactory"
  if (pct >= 33) return "Pass"
  return "Fail"
}

/**
 * Safely extracts the weekly schedule array from exam.result_note tag:
 * [WEEKLY_SCHEDULE:[{...}]]
 */
/**
 * Safely extracts the weekly or routine schedule array from exam.result_note tag:
 * [WEEKLY_SCHEDULE:[{...}]] or [ROUTINE_SCHEDULE:[{...}]]
 */
export function extractWeeklyScheduleFromNote(note?: string | null): any[] | null {
  if (!note || typeof note !== "string") return null
  const tag = note.includes("[WEEKLY_SCHEDULE:")
    ? "[WEEKLY_SCHEDULE:"
    : note.includes("[ROUTINE_SCHEDULE:")
    ? "[ROUTINE_SCHEDULE:"
    : null
  if (!tag) return null

  // 1. Try regex match
  const regex = tag === "[WEEKLY_SCHEDULE:"
    ? /\[WEEKLY_SCHEDULE:(\[[\s\S]*?\])\]/
    : /\[ROUTINE_SCHEDULE:(\[[\s\S]*?\])\]/
  const match = note.match(regex)
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }

  // 2. Bracket-balancing parser for malformed or nested tags
  const startIdx = note.indexOf(tag)
  if (startIdx !== -1) {
    const after = note.slice(startIdx + tag.length)
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
 * Safely removes [WEEKLY_SCHEDULE:...], [ROUTINE_SCHEDULE:...], and related metadata tags from result_note
 */
export function cleanWeeklyScheduleFromNote(note?: string | null): string {
  if (!note || typeof note !== "string") return ""
  return note
    .replace(/\[WEEKLY_SCHEDULE:(\[[\s\S]*?\])\]/g, "")
    .replace(/\[WEEKLY_SCHEDULE:[^\]]*\]\]?/g, "")
    .replace(/\[ROUTINE_SCHEDULE:(\[[\s\S]*?\])\]/g, "")
    .replace(/\[ROUTINE_SCHEDULE:[^\]]*\]\]?/g, "")
    .replace(/\[WEEKLY_DAYS:[^\]]*\]/g, "")
}

/**
 * Extract exam schedule type ('one_time' | 'weekly' | 'routine')
 */
export function extractExamScheduleType(note?: string | null, fallbackType?: string | null): "one_time" | "weekly" | "routine" {
  if (note && typeof note === "string") {
    const m = note.match(/\[EXAM_SCHEDULE_TYPE:([^\]\s]+)\]/)
    if (m && m[1]) return m[1].trim() as any
    if (note.includes("[ROUTINE_SCHEDULE:")) return "routine"
  }
  if (fallbackType === "routine" || fallbackType === "weekly") return fallbackType
  return "one_time"
}

/**
 * Helper to get Bengali day and standard English info from a date string (YYYY-MM-DD)
 */
export function getBengaliDayFromDate(dateStr: string): { bn: string; en: string; id: string } {
  if (!dateStr) return { bn: "", en: "", id: "" }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return { bn: "", en: "", id: "" }
  const days = [
    { id: "sunday", bn: "রবিবার", en: "Sunday" },
    { id: "monday", bn: "সোমবার", en: "Monday" },
    { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
    { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
    { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
    { id: "friday", bn: "শুক্রবার", en: "Friday" },
    { id: "saturday", bn: "শনিবার", en: "Saturday" },
  ]
  return days[d.getDay()]
}

/**
 * Extract series ID from exam result_note
 */
export function extractSeriesId(note?: string | null): string | null {
  if (!note || typeof note !== "string") return null
  const m = note.match(/\[SERIES_ID:([^\]\s]+)\]/)
  return m && m[1] ? m[1].trim() : null
}

/**
 * Extract series week number from result_note or title
 */
export function extractSeriesWeek(note?: string | null, title?: string | null): number | null {
  if (note && typeof note === "string") {
    const nm = note.match(/\[SERIES_WEEK:(\d+)\]/)
    if (nm && nm[1]) return parseInt(nm[1], 10)
  }
  if (title && typeof title === "string") {
    const normalized = title.replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)))
    const m = normalized.match(/weekly[-_\s]0*(\d+)/i) || normalized.match(/সাপ্তাহিক[-_\s]0*(\d+)/)
    if (m && m[1]) {
      const beforeNum = normalized.substring(0, normalized.indexOf(m[0]) + m[0].indexOf(m[1]))
      if (!/class\s*$/i.test(beforeNum) && !/ক্লাস\s*$/.test(beforeNum)) {
        return parseInt(m[1], 10)
      }
    }
  }
  return null
}

/**
 * Get unique series key for grouping an exam into its series.
 * - If an explicit [SERIES_ID:xxx] exists, returns `series_${seriesId}`.
 * - For legacy exams:
 *   If title is formatted like WEEKLY-01, WEEKLY-02, etc. (standard auto-created weekly names),
 *   group them by batch: `legacy_weekly_${branchId}::${batchId}`.
 *   OTHERWISE (e.g. custom titles like "Science", "Math", "mm"), each exam is its own independent series: `exam_${exam.id}`.
 */
export function getExamSeriesKey(exam: {
  id?: string
  batch_id?: string | null
  batch_ids?: string[] | null
  branch_id?: string | null
  result_note?: string | null
  title?: string | null
  exam_schedule_type?: string | null
  recurring_days?: any
}): string {
  if (!exam) return ""
  const explicit = extractSeriesId(exam.result_note)
  if (explicit) {
    const cleanId = explicit.replace(/^series_|^exam_/, "")
    return `series_${cleanId}`
  }

  // If this exam is a weekly exam, its own ID is its series identity!
  // Sibling weeks created from this exam will carry [SERIES_ID:exam.id]
  const isWeekly =
    exam.exam_schedule_type === "weekly" ||
    (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
    exam.result_note?.includes("[WEEKLY_SCHEDULE:") ||
    exam.result_note?.includes("[SERIES_WEEK:")

  if (isWeekly && exam.id) {
    const cleanId = exam.id.replace(/^series_|^exam_/, "")
    return `series_${cleanId}`
  }

  // Legacy fallback:
  const title = (exam.title || "").trim()
  const normalized = title.replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)))
  const isGenericWeeklyPattern =
    /^weekly[-_\s]?0*\d+$/i.test(normalized) ||
    /^সাপ্তাহিক[-_\s]?0*\d+$/.test(normalized) ||
    /^week[-_\s]?0*\d+$/i.test(normalized)

  if (isGenericWeeklyPattern) {
    const bId = exam.batch_id || (Array.isArray(exam.batch_ids) && exam.batch_ids.length > 0 ? [...exam.batch_ids].sort().join(",") : "all_batches")
    const brId = exam.branch_id || "all_branches"
    return `legacy_weekly_${brId}::${bId}`
  }

  // Any custom-titled exam or one without generic weekly title is its own series!
  return `exam_${exam.id || Math.random().toString(36).slice(2)}`
}

const BN_TO_EN_DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
}

export function normalizeDigits(str: string): string {
  if (!str) return ""
  return str.replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] || d)
}

export function parseRollQuery(query: string) {
  const q = (query || "").toLowerCase().trim()
  const qNormalized = normalizeDigits(q)
  const qClean = qNormalized
    .replace(/^(roll|r|#|রোল|no|নং|রোল\s*নং|roll\s*no|[\s\-\:\.\#])+/i, "")
    .trim()
  const qStripped = qClean.replace(/^0+/, "") || "0"
  const qNum = parseInt(qStripped, 10)
  const isNumericQuery = !isNaN(qNum) && qNum > 0 && qClean.length > 0
  const hasMinPhoneDigits = qNormalized.replace(/\D/g, "").length >= 4

  return {
    q,
    qNormalized,
    qClean,
    qStripped,
    qNum: isNumericQuery ? qNum : null,
    isNumericQuery,
    hasMinPhoneDigits,
  }
}

export function isRollMatch(
  queryInfo: ReturnType<typeof parseRollQuery> | string,
  candidateRolls: (number | string | null | undefined)[]
): boolean {
  const parsed = typeof queryInfo === "string" ? parseRollQuery(queryInfo) : queryInfo
  if (!parsed.q) return false

  const candidateNumbers = new Set<number>()
  const candidateStrings = new Set<string>()

  for (const r of candidateRolls) {
    if (r == null || r === "") continue
    const rStr = String(r).trim()
    if (!rStr) continue
    candidateStrings.add(rStr)
    const n = Number(rStr)
    if (!isNaN(n) && n > 0) {
      candidateNumbers.add(n)
    }
  }

  if (candidateNumbers.size === 0 && candidateStrings.size === 0) return false

  if (parsed.isNumericQuery && parsed.qNum !== null) {
    if (candidateNumbers.has(parsed.qNum)) return true
  }

  for (const rStr of candidateStrings) {
    const rStripped = rStr.replace(/^0+/, "") || "0"
    if (
      rStr === parsed.q ||
      rStr === parsed.qClean ||
      rStr === parsed.qNormalized ||
      rStripped === parsed.qStripped ||
      rStripped === parsed.qClean ||
      `roll ${rStr}` === parsed.qNormalized ||
      `roll #${rStr}` === parsed.qNormalized ||
      `r${rStr}` === parsed.qNormalized ||
      `রোল ${rStr}` === parsed.q ||
      `রোল #${rStr}` === parsed.q
    ) {
      return true
    }
  }

  return false
}

/**
 * Generates a unique admission-time based QR identifier for a student or enrollment.
 * Format: MSQR-YYYYMMDD-SEQNO-CHECKSUM
 * Example: MSQR-20260920-0042-8F2B
 */
export function generateStudentQrCode(params: {
  studentId?: string | null
  admissionDate?: string | Date | null
  createdAt?: string | Date | null
  rollNo?: number | string | null
  studentUuid?: string | null
}): string {
  const d = params.admissionDate
    ? new Date(params.admissionDate)
    : params.createdAt
      ? new Date(params.createdAt)
      : new Date()
  const validDate = isNaN(d.getTime()) ? new Date() : d
  const yyyy = validDate.getFullYear()
  const mm = String(validDate.getMonth() + 1).padStart(2, "0")
  const dd = String(validDate.getDate()).padStart(2, "0")
  const dateStr = `${yyyy}${mm}${dd}`

  // Extract digits from student ID (e.g. MS-2026-0042 -> 0042)
  const rawId = (params.studentId || "").replace(/\D/g, "")
  const seq = rawId ? rawId.slice(-4).padStart(4, "0") : (params.rollNo ? String(params.rollNo).padStart(3, "0") : "0001")

  // Checksum derived from admission timestamp, UUID or student ID
  const seed = `${params.studentUuid || ""}|${params.studentId || ""}|${validDate.getTime()}|${params.rollNo || ""}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const checksum = Math.abs(hash).toString(16).toUpperCase().padStart(4, "0").slice(-4)

  return `MSQR-${dateStr}-${seq}-${checksum}`
}

/**
 * Returns the public verification URL containing the unique QR code
 */
export function getStudentVerificationUrl(qrCode: string): string {
  return `https://medhashiree.vercel.app/verify/student?code=${encodeURIComponent(qrCode)}`
}

/**
 * Extracts raw QR code from any scanner input (URL or raw code)
 */
export function extractQrCodeFromInput(input: string): string {
  if (!input) return ""
  const trimmed = input.trim()
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed)
      const code = url.searchParams.get("code")
      if (code) return code.trim()
      // Fallback check path parts
      const parts = url.pathname.split("/").filter(Boolean)
      const lastPart = parts[parts.length - 1]
      if (lastPart && (lastPart.startsWith("MSQR-") || lastPart.startsWith("MS-") || lastPart.startsWith("EDU-"))) {
        return lastPart.trim()
      }
    }
  } catch {}

  // Check if string contains ?code= or &code=
  const match = trimmed.match(/[?&]code=([^&\s]+)/i)
  if (match && match[1]) return decodeURIComponent(match[1]).trim()

  return trimmed
}



