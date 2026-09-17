import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: "indigo" | "emerald" | "orange" | "red" | "blue" | "purple"
  trend?: { value: number; label: string }
  href?: string
}

const colorMap = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200/80 shadow-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-emerald-100",
  orange: "bg-amber-50 text-amber-700 border-amber-200/80 shadow-amber-100",
  red: "bg-rose-50 text-rose-700 border-rose-200/80 shadow-rose-100",
  blue: "bg-sky-50 text-sky-700 border-sky-200/80 shadow-sky-100",
  purple: "bg-purple-50 text-purple-700 border-purple-200/80 shadow-purple-100",
}

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "indigo", trend, href }: Props) {
  const content = (
    <div className="bg-white rounded-2xl border border-slate-200/80 hover:border-amber-400/60 p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1 tracking-tight truncate">{value}</p>
          {subtitle && <p className="text-[11px] sm:text-xs text-amber-600 font-semibold mt-0.5 truncate">{subtitle}</p>}
          {trend && (
            <div className={cn("inline-flex items-center gap-1 mt-1.5 sm:mt-2 text-xs font-bold", trend.value >= 0 ? "text-emerald-600" : "text-rose-600")}>
              <span>{trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
              <span className="text-slate-400 font-normal truncate">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn("p-2 sm:p-3 rounded-xl sm:rounded-2xl border shadow-xs flex-shrink-0", colorMap[color])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full transition-transform hover:-translate-y-0.5">
        {content}
      </Link>
    )
  }

  return content
}
