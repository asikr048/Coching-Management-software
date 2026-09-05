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
  indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 shadow-indigo-500/10",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10",
  orange: "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-amber-500/10",
  red: "bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-rose-500/10",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-sky-500/10",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-purple-500/10",
}

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "indigo", trend, href }: Props) {
  const content = (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800/90 hover:border-amber-500/40 p-5 shadow-lg shadow-black/20 hover:shadow-amber-500/5 transition-all duration-200 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">{title}</p>
          <p className="text-2xl font-extrabold text-white mt-1 tracking-tight truncate">{value}</p>
          {subtitle && <p className="text-xs text-amber-400/90 font-medium mt-0.5 truncate">{subtitle}</p>}
          {trend && (
            <div className={cn("inline-flex items-center gap-1 mt-2 text-xs font-semibold", trend.value >= 0 ? "text-emerald-400" : "text-rose-400")}>
              <span>{trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
              <span className="text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl border shadow-sm flex-shrink-0", colorMap[color])}>
          <Icon className="w-5 h-5" />
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
