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
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  orange: "bg-orange-50 text-orange-600 border-orange-100",
  red: "bg-red-50 text-red-600 border-red-100",
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
}

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "indigo", trend, href }: Props) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          {trend && (
            <div className={cn("inline-flex items-center gap-1 mt-2 text-xs font-medium", trend.value >= 0 ? "text-emerald-600" : "text-red-600")}>
              <span>{trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%</span>
              <span className="text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl border", colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full transition-transform hover:scale-[1.02]">
        {content}
      </Link>
    )
  }

  return content
}

