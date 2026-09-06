"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { CheckCircle, Clock, User, Loader2, LayoutDashboard, GraduationCap, ArrowRight } from "lucide-react"

import { getUserEnrollments, getCachedUserEnrollments } from "@/lib/user-enrollments"

export default function EnrollButton({ 
  batchId, 
  isFull,
  batchStatus = "ongoing" 
}: { 
  batchId: string; 
  isFull: boolean;
  batchStatus?: string;
}) {
  const supabase = createClient()
  const [status, setStatus] = useState<"loading" | "not_logged_in" | "is_staff" | "enrolled" | "pending" | "can_enroll">(() => {
    if (typeof window !== "undefined") {
      const cached = getCachedUserEnrollments()
      if (cached.enrolledBatchIds.has(batchId)) return "enrolled"
      if (cached.pendingBatchIds.has(batchId)) return "pending"
    }
    return "loading"
  })
  const [staffRole, setStaffRole] = useState("")

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

      // 1. Primary check: unified student enrollment resolver (handles student_id, phone, email, auth_user_id)
      const enrollState = await getUserEnrollments()
      if (enrollState.enrolledBatchIds.has(batchId)) {
        setStatus("enrolled")
        return
      }
      if (enrollState.pendingBatchIds.has(batchId)) {
        setStatus("pending")
        return
      }

      // 2. Direct fallback check in Supabase tables
      const studentEmail = user.email || ""
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .or(`email.eq.${studentEmail},auth_user_id.eq.${user.id}`)
        .maybeSingle()

      if (student) {
        const { data: enrollment } = await supabase
          .from("enrollments").select("id, status")
          .eq("student_id", student.id).eq("batch_id", batchId).maybeSingle()
        if (enrollment?.status === "active") { setStatus("enrolled"); return }

        const { data: pendingPayment } = await supabase
          .from("payment_submissions").select("id, status")
          .eq("student_id", student.id).eq("batch_id", batchId).eq("status", "pending").maybeSingle()
        if (pendingPayment) { setStatus("pending"); return }
      }

      setStatus("can_enroll")
    }
    check()
  }, [batchId])

  if (status === "loading") return (
    <div className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl font-semibold text-center flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Checking...
    </div>
  )

  // Enrolled student always gets direct access to classroom regardless of admission status
  if (status === "enrolled") return (
    <div className="space-y-3">
      <div className="w-full py-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 rounded-xl font-bold text-center flex items-center justify-center gap-2">
        <CheckCircle className="w-5 h-5 text-emerald-600" /> Already Enrolled (ভর্তি সম্পন্ন)
      </div>
      <Link 
        href={`/student/batch/${batchId}`} 
        className="block w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-center hover:shadow-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
      >
        <GraduationCap className="w-5 h-5" /> Go to Batch Classroom
      </Link>
      <Link 
        href="/student/profile" 
        className="block w-full py-1 text-gray-500 hover:text-gray-700 text-xs font-medium text-center"
      >
        View My Profile
      </Link>
    </div>
  )

  if (status === "pending") return (
    <div className="space-y-3">
      <div className="w-full py-3.5 bg-amber-50 border-2 border-amber-300 text-amber-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2">
        <Clock className="w-5 h-5" /> Payment Pending Approval (অপেক্ষমাণ)
      </div>
      <p className="text-xs text-center text-amber-600">Your payment is being reviewed. You&apos;ll be enrolled once approved.</p>
      <Link href="/student/profile" className="block w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all flex items-center justify-center gap-2">
        <User className="w-4 h-4" /> View My Profile
      </Link>
    </div>
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

  if (batchStatus === "admission_closed") return (
    <div className="w-full py-3.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl font-bold text-center text-sm">
      Admission Closed for this Batch
    </div>
  )

  if (batchStatus === "finished") return (
    <div className="w-full py-3.5 bg-gray-100 border border-gray-200 text-gray-600 rounded-xl font-bold text-center text-sm">
      Batch Program Finished
    </div>
  )

  if (isFull) return (
    <div className="w-full py-3.5 bg-gray-200 text-gray-500 rounded-xl font-semibold text-center">Batch Full</div>
  )

  // not_logged_in or can_enroll
  return (
    <div className="space-y-2">
      <Link
        href={`/enroll?batchId=${batchId}`}
        className="group relative w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-center rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2.5 text-base"
      >
        <GraduationCap className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span>Enroll Now</span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Link>
      <p className="text-xs text-center text-gray-500">
        Click to complete admission form &amp; online payment
      </p>
    </div>
  )
}
