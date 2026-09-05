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
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber-400" /> Today's Attendance Overview ({formatDate(todayDate)})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center justify-center hover:border-amber-500/30 transition-all">
            <div className="w-10 h-10 bg-slate-800 text-amber-400 rounded-xl flex items-center justify-center mb-2 border border-slate-700/60"><Users className="w-5 h-5" /></div>
            <p className="text-2xl font-black text-white">{totalMarked}</p>
            <p className="text-xs text-slate-400 font-medium">Total Marked</p>
          </div>
          <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center justify-center hover:border-emerald-500/30 transition-all">
            <div className="w-10 h-10 bg-emerald-950/60 text-emerald-400 rounded-xl flex items-center justify-center mb-2 border border-emerald-500/30"><UserCheck className="w-5 h-5" /></div>
            <p className="text-2xl font-black text-emerald-400">{presentCount}</p>
            <p className="text-xs text-slate-400 font-medium">Present</p>
          </div>
          <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center justify-center hover:border-amber-500/30 transition-all">
            <div className="w-10 h-10 bg-amber-950/60 text-amber-400 rounded-xl flex items-center justify-center mb-2 border border-amber-500/30"><Clock className="w-5 h-5" /></div>
            <p className="text-2xl font-black text-amber-300">{lateCount}</p>
            <p className="text-xs text-slate-400 font-medium">Late</p>
          </div>
          <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center justify-center hover:border-red-500/30 transition-all">
            <div className="w-10 h-10 bg-red-950/60 text-red-400 rounded-xl flex items-center justify-center mb-2 border border-red-500/30"><UserX className="w-5 h-5" /></div>
            <p className="text-2xl font-black text-red-400">{absentCount}</p>
            <p className="text-xs text-slate-400 font-medium">Absent</p>
          </div>
          <div className="bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-col items-center justify-center hover:border-slate-700 transition-all">
            <div className="w-10 h-10 bg-slate-800 text-slate-300 rounded-xl flex items-center justify-center mb-2 border border-slate-700/60"><UserX className="w-5 h-5" /></div>
            <p className="text-2xl font-black text-slate-300">{excusedCount}</p>
            <p className="text-xs text-slate-400 font-medium">Excused</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-600/20 p-4 rounded-2xl border border-amber-500/40 shadow-xl flex flex-col items-center justify-center text-white backdrop-blur-md">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mb-2 text-amber-300 border border-amber-500/30"><Activity className="w-5 h-5" /></div>
            <p className="text-2xl font-black text-amber-300">{presentRate}%</p>
            <p className="text-xs text-amber-400/90 font-medium">Attendance Rate</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Batchwise Breakdown */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" /> Batchwise Breakdown
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Batch Name</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Enrolled</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Present</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Absent</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {batchBreakdown.length > 0 ? batchBreakdown.map(b => (
                    <tr key={b.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-white">{b.name}</td>
                      <td className="px-4 py-3.5 text-right text-slate-400 font-mono">{b.enrolled}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-400 font-bold font-mono">{b.present}</td>
                      <td className="px-4 py-3.5 text-right text-red-400 font-bold font-mono">{b.absent}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${b.rate >= 80 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : b.rate >= 50 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30'}`}>
                          {b.rate}%
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No attendance marked for today yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Attendance Trends */}
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" /> Last 7 Days Trend
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Date</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Total Marked</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Present</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Absent</th>
                    <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {trendsArray.length > 0 ? trendsArray.map(t => (
                    <tr key={t.date} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-200">{formatDate(t.date)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-400 font-mono">{t.total}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-400 font-bold font-mono">{t.present}</td>
                      <td className="px-4 py-3.5 text-right text-red-400 font-bold font-mono">{t.absent}</td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        <span className={`font-bold ${t.rate >= 80 ? 'text-emerald-400' : t.rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{t.rate}%</span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No attendance data for the last 7 days.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Leaderboard Section */}
      <section>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-400" /> Student Attendance Leaderboard
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-3.5 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-emerald-300">Top 10 Best Attendance</h4>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-slate-100/70">
                {top10.length > 0 ? top10.map((s, idx) => (
                  <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-amber-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-500 font-mono w-5">{idx + 1}.</span>
                      <span className="font-bold text-slate-900">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{s.total} classes</span>
                      <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-lg min-w-[3rem] font-mono">{s.rate}%</span>
                    </div>
                  </li>
                )) : (
                  <li className="px-4 py-8 text-center text-slate-500 text-sm">Not enough data to calculate leaderboard.</li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="bg-red-950/40 border-b border-red-500/20 px-4 py-3.5 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h4 className="font-bold text-red-300">Bottom 10 Worst Attendance</h4>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-slate-100/70">
                {bottom10.length > 0 ? bottom10.map((s, idx) => (
                  <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-amber-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-500 font-mono w-5">{idx + 1}.</span>
                      <span className="font-bold text-slate-900">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{s.total} classes</span>
                      <span className="inline-flex items-center justify-center px-2.5 py-1 bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-bold rounded-lg min-w-[3rem] font-mono">{s.rate}%</span>
                    </div>
                  </li>
                )) : (
                  <li className="px-4 py-8 text-center text-slate-500 text-sm">Not enough data to calculate leaderboard.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
