"use client"
import { Users, UserCheck, UserX, Clock, CalendarDays, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface AttendanceClientProps {
  todayAttendance: any[]
  batches: any[]
  recentAttendance: any[]
  top10: any[]
  bottom10: any[]
  todayDate: string
}

export default function AttendanceClient({ todayAttendance, batches, recentAttendance, top10, bottom10, todayDate }: AttendanceClientProps) {
  // Today's summary
  const presentCount = todayAttendance.filter(a => a.status === 'present').length
  const lateCount = todayAttendance.filter(a => a.status === 'late').length
  const absentCount = todayAttendance.filter(a => a.status === 'absent').length
  const excusedCount = todayAttendance.filter(a => a.status === 'excused').length
  const totalMarked = todayAttendance.length
  
  // Total expected based on batches that have attendance marked or active batches
  // Assuming total enrolled for today is just sum of current_seats of all batches for simplicity,
  // or we can just use totalMarked if we don't know who has classes today.
  // The spec says "Summary cards: Present, Absent, Late, Excused, Total, % Present"
  const presentRate = totalMarked > 0 ? Math.round(((presentCount + lateCount) / totalMarked) * 100) : 0

  // Batchwise breakdown
  const batchBreakdown = batches.map(batch => {
    const batchAtt = todayAttendance.filter(a => a.batch_id === batch.id)
    const bPresent = batchAtt.filter(a => a.status === 'present' || a.status === 'late').length
    const bAbsent = batchAtt.filter(a => a.status === 'absent').length
    const bTotal = batchAtt.length
    const bRate = bTotal > 0 ? Math.round((bPresent / bTotal) * 100) : 0
    return {
      id: batch.id,
      name: batch.name,
      enrolled: batch.current_seats,
      present: bPresent,
      absent: bAbsent,
      rate: bRate,
      marked: bTotal
    }
  }).filter(b => b.marked > 0 || b.enrolled > 0).sort((a, b) => b.rate - a.rate)

  // Recent 7 days trends
  // Group by date
  const trendsMap: Record<string, { present: number, absent: number, total: number }> = {}
  recentAttendance.forEach(a => {
    if (!trendsMap[a.date]) trendsMap[a.date] = { present: 0, absent: 0, total: 0 }
    trendsMap[a.date].total += 1
    if (a.status === 'present' || a.status === 'late') trendsMap[a.date].present += 1
    else if (a.status === 'absent') trendsMap[a.date].absent += 1
  })

  const trendsArray = Object.keys(trendsMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => {
    const data = trendsMap[date]
    const rate = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
    return { date, ...data, rate }
  })

  return (
    <div className="space-y-8">
      {/* Today's Summary */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-600" /> Today's Overview ({formatDate(todayDate)})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-2"><Users className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{totalMarked}</p>
            <p className="text-xs text-gray-500 font-medium">Total Marked</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2"><UserCheck className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{presentCount}</p>
            <p className="text-xs text-gray-500 font-medium">Present</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-2"><Clock className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{lateCount}</p>
            <p className="text-xs text-gray-500 font-medium">Late</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2"><UserX className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{absentCount}</p>
            <p className="text-xs text-gray-500 font-medium">Absent</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-2"><UserX className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-gray-900">{excusedCount}</p>
            <p className="text-xs text-gray-500 font-medium">Excused</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-white">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-2"><Activity className="w-5 h-5" /></div>
            <p className="text-2xl font-bold">{presentRate}%</p>
            <p className="text-xs text-indigo-100 font-medium">Attendance Rate</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Batchwise Breakdown */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Batchwise Breakdown
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Batch Name</th>
                    <th className="px-4 py-3 font-medium text-right">Enrolled</th>
                    <th className="px-4 py-3 font-medium text-right">Present</th>
                    <th className="px-4 py-3 font-medium text-right">Absent</th>
                    <th className="px-4 py-3 font-medium text-right">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batchBreakdown.length > 0 ? batchBreakdown.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{b.enrolled}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{b.present}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{b.absent}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${b.rate >= 80 ? 'bg-emerald-100 text-emerald-800' : b.rate >= 50 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                          {b.rate}%
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No attendance marked for today yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Attendance Trends */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Last 7 Days Trend
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">Total Marked</th>
                    <th className="px-4 py-3 font-medium text-right">Present</th>
                    <th className="px-4 py-3 font-medium text-right">Absent</th>
                    <th className="px-4 py-3 font-medium text-right">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trendsArray.length > 0 ? trendsArray.map(t => (
                    <tr key={t.date} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{t.total}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{t.present}</td>
                      <td className="px-4 py-3 text-right text-red-600">{t.absent}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={`${t.rate >= 80 ? 'text-emerald-600' : t.rate >= 50 ? 'text-orange-600' : 'text-red-600'}`}>{t.rate}%</span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No attendance data for the last 7 days.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Leaderboard Section */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" /> Student Attendance Leaderboard
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h4 className="font-semibold text-emerald-900">Top 10 Best Attendance</h4>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-gray-100">
                {top10.length > 0 ? top10.map((s, idx) => (
                  <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400 w-5">{idx + 1}.</span>
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{s.total} classes</span>
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md min-w-[3rem]">{s.rate}%</span>
                    </div>
                  </li>
                )) : (
                  <li className="px-4 py-6 text-center text-gray-500 text-sm">Not enough data to calculate leaderboard.</li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-900">Bottom 10 Worst Attendance</h4>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-gray-100">
                {bottom10.length > 0 ? bottom10.map((s, idx) => (
                  <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-400 w-5">{idx + 1}.</span>
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{s.total} classes</span>
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md min-w-[3rem]">{s.rate}%</span>
                    </div>
                  </li>
                )) : (
                  <li className="px-4 py-6 text-center text-gray-500 text-sm">Not enough data to calculate leaderboard.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
