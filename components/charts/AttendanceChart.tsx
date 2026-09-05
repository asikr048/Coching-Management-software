"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { createClient } from "@/lib/supabase/client"

interface DayData { day: string; present: number; absent: number }

export default function AttendanceChart() {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const days: DayData[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split("T")[0]

        const { data: att } = await supabase
          .from("attendance")
          .select("status")
          .eq("date", dateStr)

        const present = (att || []).filter(a => a.status === "present").length
        const absent = (att || []).filter(a => a.status === "absent").length
        days.push({ day: d.toLocaleDateString("en-GB", { weekday: "short" }), present, absent })
      }
      setData(days)
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-6 h-64 flex items-center justify-center text-gray-400">Loading chart...</div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Attendance (Last 7 Days)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="present" name="Present" fill="#10b981" radius={[4,4,0,0]} />
          <Bar dataKey="absent" name="Absent" fill="#f87171" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
