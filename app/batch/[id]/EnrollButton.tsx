"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { CheckCircle, Clock, User, Loader2, LayoutDashboard } from "lucide-react"

export default function EnrollButton({ batchId, isFull }: { batchId: string; isFull: boolean }) {
  const supabase = createClient()
  const [status, setStatus] = useState<"loading" | "not_logged_in" | "is_staff" | "enrolled" | "pending" | "can_enroll">("loading")
  const [staffRole, setStaffRole] = useState("")
  const [studentDbId, setStudentDbId] = useState("")
  const [studentCode, setStudentCode] = useState("")
  const [studentName, setStudentName] = useState("")

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus("not_logged_in"); return }

      // Check if user is staff — admins don't enroll as students
      const { data: staffRecord } = await supabase
        .from("staff").select("id, role").eq("auth_user_id", user.id).maybeSingle()
      if (staffRecord) { 
        setStaffRole(staffRecord.role || "")
        setStatus("is_staff")
        return 
      }

      // Find student record by email
      const studentEmail = user.email || ""
      const { data: student } = await supabase
        .from("students").select("id, student_id, name").eq("email", studentEmail).maybeSingle()

      if (!student) { setStatus("can_enroll"); return }

      setStudentDbId(student.id)
      setStudentCode(student.student_id)
      setStudentName(student.name)

      // Check active enrollment in this batch
      const { data: enrollment } = await supabase
        .from("enrollments").select("id, status")
        .eq("student_id", student.id).eq("batch_id", batchId).maybeSingle()
      if (enrollment?.status === "active") { setStatus("enrolled"); return }

      // Check pending payment submission for this batch
      const { data: pendingPayment } = await supabase
        .from("payment_submissions").select("id, status")
        .eq("student_id", student.id).eq("batch_id", batchId).eq("status", "pending").maybeSingle()
      if (pendingPayment) { setStatus("pending"); return }

      setStatus("can_enroll")
    }
    check()
  }, [batchId])

  if (status === "loading") return (
    <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl font-semibold text-center flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking...
    </div>
  )

  if (isFull) return (
    <div className="w-full py-3.5 bg-gray-200 text-gray-500 rounded-xl font-semibold text-center">Batch Full</div>
  )

  // Admin/staff account — show dashboard link, not enroll
  if (status === "is_staff") {
    const dashboardHref = ["owner", "super_manager", "manager"].includes(staffRole)
      ? "/dashboard/owner"
      : staffRole === "teacher"
      ? "/dashboard/teacher"
      : staffRole === "receptionist"
      ? "/dashboard/reception"
      : staffRole === "accountant"
      ? "/dashboard/accountant"
      : "/dashboard/owner"

    return (
      <div className="space-y-3">
        <div className="w-full py-3 bg-violet-50 border-2 border-violet-200 text-violet-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2 text-sm">
          <LayoutDashboard className="w-4 h-4" /> Admin Account
        </div>
        <Link href={dashboardHref} className="block w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm">
          <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
        </Link>
      </div>
    )
  }

  if (status === "enrolled") return (
    <div className="space-y-3">
      <div className="w-full py-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2">
        <CheckCircle className="w-5 h-5" /> Already Enrolled
      </div>
      <Link href="/student/profile" className="block w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all flex items-center justify-center gap-2">
        <User className="w-4 h-4" /> Go to My Profile
      </Link>
    </div>
  )

  if (status === "pending") return (
    <div className="space-y-3">
      <div className="w-full py-3.5 bg-amber-50 border-2 border-amber-300 text-amber-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2">
        <Clock className="w-5 h-5" /> Payment Pending Approval
      </div>
      <p className="text-xs text-center text-amber-600">Your payment is being reviewed. You&apos;ll be enrolled once approved.</p>
      <Link href="/student/profile" className="block w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all flex items-center justify-center gap-2">
        <User className="w-4 h-4" /> View My Profile
      </Link>
    </div>
  )

  // not_logged_in or can_enroll
  return (
    <Link
      href={
        status === "not_logged_in"
          ? "/login"
          : `/enroll/payment?student_id=${studentDbId}&student_code=${studentCode}&name=${encodeURIComponent(studentName)}&batch=${batchId}`
      }
      className="block w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-center hover:shadow-lg hover:shadow-indigo-200 transition-all"
    >
      {status === "not_logged_in" ? "Sign In to Enroll" : "Enroll in This Batch"}
    </Link>
  )
}
