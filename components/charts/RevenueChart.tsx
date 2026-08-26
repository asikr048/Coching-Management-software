"use client"
import { useEffect, useState } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { createClient } from "@/lib/supabase/client"

interface MonthRevenue { month: string; revenue: number; dues: number }

export default function RevenueChart() {
  const [data, setData] = useState<MonthRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const months: MonthRevenue[] = []
      const now = new Date()

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const startDate = `${monthStr}-01`
        const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]

        const { data: pmts } = await supabase
          .from("payments")
          .select("total_paid")
          .gte("paid_at", startDate)
          .lte("paid_at", endDate)

        const revenue = (pmts || []).reduce((s, p) => s + (p.total_paid || 0), 0)

        months.push({
          month: d.toLocaleDateString("en-GB", { month: "short" }),
          revenue,
          dues: 0,
        })
      }
      setData(months)
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-6 h-64 flex items-center justify-center text-gray-400">Loading chart...</div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Revenue (Last 6 Months)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => [`৳${Number(v).toLocaleString()}`, "Revenue"]} />
          <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
