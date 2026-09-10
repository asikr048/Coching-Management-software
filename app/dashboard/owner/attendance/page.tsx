import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import AttendanceClient from "./AttendanceClient"
import { format, subDays } from "date-fns"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AttendancePage() {
  const admin = createAdminClient()
  const today = format(new Date(), "yyyy-MM-dd")
  const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd")

  // Fetch today's attendance using admin to bypass RLS
  const { data: todayAttendance } = await admin
    .from("attendance")
    .select("*, student:students(id, name, student_id, roll_no, batch_roll), batch:batches(id, name, subject)")
    .eq("date", today)

  // Fetch all batches (without is_active constraint to ensure no batches are missed)
  const { data: batches } = await admin
    .from("batches")
    .select("id, name, branch_id, classroom, subject, current_seats, max_seats, is_active, status")
    .order("name")

  // Fetch last 7 days attendance
  const { data: recentAttendance } = await admin
    .from("attendance")
    .select("id, date, status")
    .gte("date", sevenDaysAgo)
    .lte("date", today)

  // Fetch all time attendance for leaderboard
  const { data: allAttendance } = await admin
    .from("attendance")
    .select("student_id, status, student:students(name)")

  // Aggregate leaderboard in server
  const studentStats: Record<string, { name: string; present: number; total: number }> = {}
  if (allAttendance) {
    allAttendance.forEach((record: any) => {
      const sId = record.student_id
      if (!studentStats[sId]) {
        // @ts-ignore
        studentStats[sId] = { name: record.student?.name || "Unknown", present: 0, total: 0 }
      }
      studentStats[sId].total += 1
      if (record.status === "present" || record.status === "late") {
        studentStats[sId].present += 1
      }
    })
  }

  const leaderboard = Object.values(studentStats).map(s => ({
    name: s.name,
    rate: Math.round((s.present / s.total) * 100),
    total: s.total
  })).filter(s => s.total >= 5)

  leaderboard.sort((a, b) => b.rate - a.rate)
  const top10 = leaderboard.slice(0, 10)
  const bottom10 = [...leaderboard].reverse().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Overview of student attendance and trends</p>
        </div>
      </div>
      <AttendanceClient 
        todayAttendance={todayAttendance || []} 
        batches={batches || []} 
        recentAttendance={recentAttendance || []}
        top10={top10}
        bottom10={bottom10}
        todayDate={today}
      />
    </div>
  )
}
