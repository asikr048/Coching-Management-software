import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils"
import { CheckCircle2, XCircle, GraduationCap, Building2, Calendar, Phone, ShieldCheck, User, Award } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function StudentVerifyPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawCode = typeof params.code === "string" ? params.code.trim() : ""

  const admin = createAdminClient()
  const supabase = await createClient()

  let student: any = null
  let matchedEnrollment: any = null

  if (rawCode) {
    // 1. Check students by qr_code
    const { data: byQr } = await admin
      .from("students")
      .select("*, branch:branches(id, name, address), enrollments(*, batch:batches(*))")
      .eq("qr_code", rawCode)
      .maybeSingle()

    if (byQr) {
      student = byQr
    } else {
      // 2. Check enrollments by qr_code
      const { data: byEnr } = await admin
        .from("enrollments")
        .select("*, student:students(*, branch:branches(id, name, address), enrollments(*, batch:batches(*))), batch:batches(*)")
        .eq("qr_code", rawCode)
        .maybeSingle()

      if (byEnr && byEnr.student) {
        student = byEnr.student
        matchedEnrollment = byEnr
      }
    }

    // 3. Check by student_id or UUID
    if (!student) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCode)
      let q = admin.from("students").select("*, branch:branches(id, name, address), enrollments(*, batch:batches(*))")
      if (isUuid) {
        q = q.or(`id.eq.${rawCode},student_id.ilike.${rawCode}`)
      } else {
        q = q.ilike("student_id", rawCode)
      }
      const { data: byId } = await q.maybeSingle()
      if (byId) student = byId
    }
  }

  const activeEnrollments = (student?.enrollments || []).filter(
    (e: any) => !e.status || e.status === "active" || e.status === "approved" || e.status === "enrolled"
  )
  const primaryEnrollment = matchedEnrollment || activeEnrollments[0]
  const displayRoll = primaryEnrollment?.roll_no ?? student?.roll_no ?? student?.batch_roll ?? 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md mb-2 shadow-inner">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight">MedhaShiree Coaching</h1>
          <p className="text-emerald-100 text-xs font-medium mt-0.5">Official Student Verification System</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-md border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Verifiable Digital Identity</span>
          </div>
        </div>

        {/* Verification Result */}
        <div className="p-6">
          {student ? (
            <div className="space-y-5">
              {/* Verified Status Banner */}
              <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                    Verified Active Student
                  </div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    This Student ID Card is authentic & verified on medhashiree.vercel.app
                  </div>
                </div>
              </div>

              {/* Student Identity Card Content */}
              <div className="flex items-center gap-4">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.name}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-600/30 shadow-md shrink-0 bg-slate-100"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-md shrink-0">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-900 truncate leading-tight">
                    {student.name}
                  </h2>
                  <div className="text-xs font-bold text-indigo-600 mt-0.5">
                    ID: {student.student_id}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <Award className="w-3 h-3 text-amber-500" />
                    <span>Roll #{displayRoll}</span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Class / Level</span>
                  <span className="font-bold text-slate-800">{student.class_level || "Not specified"}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Branch</span>
                  <span className="font-bold text-slate-800">{student.branch?.name || "Main Branch"}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Enrolled Batch(es)</span>
                  <div className="font-bold text-indigo-700">
                    {activeEnrollments.length > 0
                      ? activeEnrollments.map((e: any) => e.batch?.name || "Batch").join(", ")
                      : "Active Student"}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Admission Date</span>
                  <span className="font-semibold text-slate-700">
                    {student.enrollment_date || student.created_at ? formatDate(student.enrollment_date || student.created_at) : "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Status</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Enrolled
                  </span>
                </div>
              </div>

              {/* Security QR Code Info */}
              <div className="pt-2 border-t border-slate-100 text-center">
                <div className="text-[10px] font-mono text-slate-400">
                  Security Token: <span className="font-bold text-slate-600">{student.qr_code || rawCode}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-100">
                <XCircle className="w-8 h-8" />
              </div>
              <h2 className="text-base font-black text-slate-900">Student Record Not Found</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No active student was found matching the scanned QR code ({rawCode || "empty"}).
              </p>
            </div>
          )}

          {/* Action Links */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm"
            >
              Go to MedhaShiree Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
