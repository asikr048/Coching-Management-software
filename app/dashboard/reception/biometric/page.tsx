"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Fingerprint, CheckCircle, XCircle, AlertTriangle, Volume2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default function BiometricPage() {
  const [studentId, setStudentId] = useState("")
  const [status, setStatus] = useState<"idle" | "scanning" | "granted" | "denied" | "alert">("idle")
  const [student, setStudent] = useState<any>(null)
  const [hasDue, setHasDue] = useState(false)
  const [dueAmount, setDueAmount] = useState(0)
  const supabase = createClient()

  async function handleScan() {
    if (!studentId.trim()) return
    setStatus("scanning")
    try {
      const { data: s } = await supabase.from("students").select("*").eq("student_id", studentId.trim()).single()
      if (!s) { setStatus("denied"); setStudent(null); return }
      setStudent(s)

      const { data: dues } = await supabase.from("fee_dues").select("due_amount, paid_amount").eq("student_id", s.id).in("status", ["pending", "partial"])
      const totalDue = (dues || []).reduce((sum, d) => sum + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

      await supabase.from("biometric_logs").insert({ student_id: s.id, recognized: true, fee_alert: totalDue > 0, entry_granted: true })

      if (totalDue > 0) { setHasDue(true); setDueAmount(totalDue); setStatus("alert") }
      else { setHasDue(false); setDueAmount(0); setStatus("granted") }

      const today = new Date().toISOString().split("T")[0]
      const { data: existing } = await supabase.from("attendance").select("id").eq("student_id", s.id).eq("date", today).limit(1)
      if (!existing || existing.length === 0) {
        const { data: enrollment } = await supabase.from("enrollments").select("batch_id").eq("student_id", s.id).eq("status", "active").limit(1).single()
        if (enrollment) {
          await supabase.from("attendance").insert({ student_id: s.id, batch_id: enrollment.batch_id, entry_method: "fingerprint", fee_alert_triggered: totalDue > 0 })
        }
      }
    } catch { setStatus("denied") }
  }

  useEffect(() => { if (status !== "idle" && status !== "scanning") { const t = setTimeout(() => { setStatus("idle"); setStudentId("") }, 5000); return () => clearTimeout(t) } }, [status])

  const bgColor = status === "granted" ? "from-emerald-500 to-emerald-700" : status === "denied" ? "from-red-500 to-red-700" : status === "alert" ? "from-yellow-500 to-orange-600" : status === "scanning" ? "from-blue-500 to-blue-700" : "from-gray-800 to-gray-900"

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Biometric Entry System</h2><p className="text-sm text-gray-500 mt-1">Fingerprint scan simulation with fee alert</p></div>
      <div className={`bg-gradient-to-br ${bgColor} rounded-2xl p-8 text-white text-center min-h-[400px] flex flex-col items-center justify-center transition-all duration-500`}>
        {status === "idle" && (
          <>
            <Fingerprint className="w-20 h-20 text-white/30 mb-6" />
            <h3 className="text-2xl font-bold mb-2">Ready to Scan</h3>
            <p className="text-white/70 mb-6">Enter student ID or scan fingerprint</p>
            <div className="flex gap-3 max-w-sm w-full">
              <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Student ID (e.g., EDU-2024-0001)"
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 text-center" onKeyDown={e => e.key === "Enter" && handleScan()} />
              <button onClick={handleScan} className="px-6 py-3 bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-100">Scan</button>
            </div>
          </>
        )}
        {status === "scanning" && (
          <>
            <Fingerprint className="w-20 h-20 text-white animate-pulse mb-6" />
            <h3 className="text-2xl font-bold">Scanning...</h3>
          </>
        )}
        {status === "granted" && student && (
          <>
            <CheckCircle className="w-20 h-20 text-white mb-4" />
            <h3 className="text-3xl font-bold mb-2">ENTRY GRANTED</h3>
            <p className="text-xl">{student.name}</p>
            <p className="text-white/70">{student.student_id}</p>
            <p className="text-emerald-200 mt-2">No pending dues ✓</p>
          </>
        )}
        {status === "denied" && (
          <>
            <XCircle className="w-20 h-20 text-white mb-4" />
            <h3 className="text-3xl font-bold mb-2">UNRECOGNIZED</h3>
            <p className="text-white/70">Student not found. Please check the ID.</p>
          </>
        )}
        {status === "alert" && student && (
          <>
            <AlertTriangle className="w-20 h-20 text-white animate-bounce mb-4" />
            <h3 className="text-3xl font-bold mb-2">⚠ FEE ALERT</h3>
            <p className="text-xl">{student.name} ({student.student_id})</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(dueAmount)} OUTSTANDING</p>
            <div className="flex items-center gap-2 mt-4 text-yellow-200"><Volume2 className="w-5 h-5 animate-pulse" /><span>Alert siren activated</span></div>
            <p className="text-white/60 text-sm mt-2">Entry granted - please collect payment</p>
          </>
        )}
      </div>
    </div>
  )
}
