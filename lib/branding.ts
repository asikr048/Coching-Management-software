export type ThemeColor = "emerald" | "indigo" | "blue" | "rose" | "violet" | "amber"

export interface InstituteBranding {
  name: string
  nameBn: string
  shortName: string
  tagline: string
  taglineBn: string
  logoUrl: string
  logoShape: "circle" | "rounded" | "square"
  themeColor: ThemeColor
  phone: string
  email: string
  website: string
  address: string
  establishedYear: string
  receiptFooterNote: string
}

export interface ThemePalette {
  id: ThemeColor
  name: string
  primaryHex: string
  secondaryHex: string
  bgLightHex: string
  borderHex: string
  textHex: string
  gradient: string
  badgeClass: string
  borderClass: string
  bgHoverClass: string
  accentTextClass: string
  buttonClass: string
  activeRingClass: string
}

export const THEME_PALETTES: Record<ThemeColor, ThemePalette> = {
  emerald: {
    id: "emerald",
    name: "MIIS Emerald (সবুজ)",
    primaryHex: "#059669",
    secondaryHex: "#10b981",
    bgLightHex: "#ecfdf5",
    borderHex: "#a7f3d0",
    textHex: "#065f46",
    gradient: "from-emerald-600 via-teal-600 to-emerald-700",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    borderClass: "border-emerald-500",
    bgHoverClass: "hover:bg-emerald-50",
    accentTextClass: "text-emerald-600",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    activeRingClass: "ring-2 ring-emerald-500 ring-offset-2",
  },
  indigo: {
    id: "indigo",
    name: "Royal Indigo (রয়্যাল নীল)",
    primaryHex: "#4f46e5",
    secondaryHex: "#6366f1",
    bgLightHex: "#eef2ff",
    borderHex: "#c7d2fe",
    textHex: "#3730a3",
    gradient: "from-indigo-600 via-indigo-700 to-purple-700",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    borderClass: "border-indigo-500",
    bgHoverClass: "hover:bg-indigo-50",
    accentTextClass: "text-indigo-600",
    buttonClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
    activeRingClass: "ring-2 ring-indigo-500 ring-offset-2",
  },
  blue: {
    id: "blue",
    name: "Ocean Sky (আকাশী নীল)",
    primaryHex: "#0284c7",
    secondaryHex: "#38bdf8",
    bgLightHex: "#f0f9ff",
    borderHex: "#bae6fd",
    textHex: "#075985",
    gradient: "from-sky-600 via-blue-600 to-cyan-700",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    borderClass: "border-sky-500",
    bgHoverClass: "hover:bg-sky-50",
    accentTextClass: "text-sky-600",
    buttonClass: "bg-sky-600 hover:bg-sky-700 text-white",
    activeRingClass: "ring-2 ring-sky-500 ring-offset-2",
  },
  rose: {
    id: "rose",
    name: "Crimson Rose (গোলাপী লাল)",
    primaryHex: "#e11d48",
    secondaryHex: "#f43f5e",
    bgLightHex: "#fff1f2",
    borderHex: "#fecdd3",
    textHex: "#9f1239",
    gradient: "from-rose-600 via-pink-600 to-red-700",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    borderClass: "border-rose-500",
    bgHoverClass: "hover:bg-rose-50",
    accentTextClass: "text-rose-600",
    buttonClass: "bg-rose-600 hover:bg-rose-700 text-white",
    activeRingClass: "ring-2 ring-rose-500 ring-offset-2",
  },
  violet: {
    id: "violet",
    name: "Noble Violet (বেগুনী)",
    primaryHex: "#7c3aed",
    secondaryHex: "#8b5cf6",
    bgLightHex: "#f5f3ff",
    borderHex: "#ddd6fe",
    textHex: "#5b21b6",
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
    borderClass: "border-violet-500",
    bgHoverClass: "hover:bg-violet-50",
    accentTextClass: "text-violet-600",
    buttonClass: "bg-violet-600 hover:bg-violet-700 text-white",
    activeRingClass: "ring-2 ring-violet-500 ring-offset-2",
  },
  amber: {
    id: "amber",
    name: "Golden Amber (সোনালী)",
    primaryHex: "#d97706",
    secondaryHex: "#f59e0b",
    bgLightHex: "#fffbeb",
    borderHex: "#fde68a",
    textHex: "#92400e",
    gradient: "from-amber-600 via-orange-600 to-yellow-600",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    borderClass: "border-amber-500",
    bgHoverClass: "hover:bg-amber-50",
    accentTextClass: "text-amber-600",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
    activeRingClass: "ring-2 ring-amber-500 ring-offset-2",
  },
}

// 5 Beautiful Preset SVG Vector Badges for Educational Institutions
export const PRESET_LOGOS = [
  {
    id: "preset-cap",
    title: "Scholar Cap & Laurels",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#059669" />
            <stop offset="100%" stop-color="#047857" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad1)" stroke="#34d399" stroke-width="2" />
        <path d="M50 22 L82 36 L50 50 L18 36 Z" fill="#ffffff" />
        <path d="M30 43 L30 62 C30 72 70 72 70 62 L70 43 L50 52 Z" fill="#ffffff" opacity="0.9" />
        <path d="M80 37 L80 62 L76 60 L76 39 Z" fill="#fef08a" />
        <circle cx="78" cy="64" r="3" fill="#fef08a" />
        <circle cx="50" cy="50" r="1.5" fill="#047857" />
      </svg>
    `.trim()),
  },
  {
    id: "preset-shield",
    title: "Academic Crest & Shield",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e1b4b" />
            <stop offset="100%" stop-color="#312e81" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad2)" stroke="#fbbf24" stroke-width="2" />
        <path d="M50 20 C68 20 74 24 74 38 C74 62 50 78 50 78 C50 78 26 62 26 38 C26 24 32 20 50 20 Z" fill="#ffffff" opacity="0.15" />
        <path d="M50 25 C64 25 70 28 70 40 C70 59 50 72 50 72 C50 72 30 59 30 40 C30 28 36 25 50 25 Z" fill="#ffffff" />
        <path d="M50 32 L53 41 L62 41 L55 46 L58 55 L50 49 L42 55 L45 46 L38 41 L47 41 Z" fill="#fbbf24" />
      </svg>
    `.trim()),
  },
  {
    id: "preset-book",
    title: "Open Book & Torch",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#0369a1" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad3)" stroke="#7dd3fc" stroke-width="2" />
        <path d="M22 66 C32 60 45 61 50 66 C55 61 68 60 78 66 L78 38 C68 32 55 33 50 38 C45 33 32 32 22 38 Z" fill="#ffffff" />
        <line x1="50" y1="38" x2="50" y2="66" stroke="#0284c7" stroke-width="2" />
        <path d="M50 20 Q54 28 50 34 Q46 28 50 20 Z" fill="#fbbf24" />
      </svg>
    `.trim()),
  },
  {
    id: "preset-atom",
    title: "Science & Innovation",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#7c3aed" />
            <stop offset="100%" stop-color="#6d28d9" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad4)" stroke="#c4b5fd" stroke-width="2" />
        <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="#ffffff" stroke-width="2" transform="rotate(30 50 50)" />
        <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="#ffffff" stroke-width="2" transform="rotate(-30 50 50)" />
        <ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="#ffffff" stroke-width="2" transform="rotate(90 50 50)" />
        <circle cx="50" cy="50" r="7" fill="#fbbf24" />
      </svg>
    `.trim()),
  },
  {
    id: "preset-classic",
    title: "Classical Academy Pillar",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#grad5)" stroke="#f59e0b" stroke-width="2" />
        <!-- Pediment -->
        <path d="M22 34 L50 20 L78 34 Z" fill="#ffffff" />
        <rect x="24" y="35" width="52" height="4" fill="#ffffff" />
        <!-- Columns -->
        <rect x="28" y="42" width="6" height="24" rx="2" fill="#ffffff" />
        <rect x="40" y="42" width="6" height="24" rx="2" fill="#ffffff" />
        <rect x="54" y="42" width="6" height="24" rx="2" fill="#ffffff" />
        <rect x="66" y="42" width="6" height="24" rx="2" fill="#ffffff" />
        <!-- Base -->
        <rect x="22" y="68" width="56" height="6" rx="1" fill="#ffffff" />
        <rect x="18" y="75" width="64" height="4" rx="1" fill="#f59e0b" />
      </svg>
    `.trim()),
  },
]

export const DEFAULT_BRANDING: InstituteBranding = {
  name: "MIIS ACADEMY",
  nameBn: "এমআইআইএস একাডেমি",
  shortName: "MIIS",
  tagline: "Academic & Admission Care",
  taglineBn: "উন্নত ও নির্ভরযোগ্য শিক্ষা সেবা",
  logoUrl: PRESET_LOGOS[0].url,
  logoShape: "circle",
  themeColor: "emerald",
  phone: "+880 1700-000000",
  email: "contact@miisacademy.com",
  website: "www.miisacademy.com",
  address: "Rangpur / Dhaka, Bangladesh",
  establishedYear: "2024",
  receiptFooterNote: "Thank you for your payment! Please preserve this receipt for all future verification.",
}

const STORAGE_KEY = "institute_branding_config"
export const BRANDING_UPDATE_EVENT = "institute_branding_updated"

/**
 * Synchronous reader for client contexts and standalone generators (PDF, print HTML, etc.)
 */
export function getActiveBranding(): InstituteBranding {
  if (typeof window === "undefined") {
    return DEFAULT_BRANDING
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BRANDING
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_BRANDING,
      ...parsed,
    }
  } catch {
    return DEFAULT_BRANDING
  }
}

/**
 * Synchronous saver that writes to localStorage and broadcasts the update event
 */
export function saveActiveBranding(branding: InstituteBranding): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding))
    window.dispatchEvent(new CustomEvent(BRANDING_UPDATE_EVENT, { detail: branding }))
  } catch (e) {
    console.warn("Could not save branding to localStorage:", e)
  }
}

export function getThemeConfig(themeColor?: ThemeColor): ThemePalette {
  const key = themeColor && THEME_PALETTES[themeColor] ? themeColor : "emerald"
  return THEME_PALETTES[key]
}
