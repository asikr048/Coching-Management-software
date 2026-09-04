import { createClient } from "@/lib/supabase/server"
import ReferralsClient, { ReferralItem } from "./ReferralsClient"

export default async function ReferralsPage() {
  const supabase = await createClient()

  // 1. Fetch all referrals table records
  const { data: dbReferrals, error: refErr } = await supabase
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false })

  if (refErr) {
    console.warn("Could not query referrals table:", refErr.message)
  }

  // 2. Fetch all students to build lookup map and extract students enrolled via referral
  const { data: allStudents } = await supabase
    .from("students")
    .select("id, name, student_id, phone, email, enrollment_date, created_at, referral_code, referred_by_code, referred_by_student_id")
    .order("created_at", { ascending: false })

  // 3. Fetch enrollments with batch info
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, batch_id, created_at, batch:batches(id, name, monthly_fee, admission_fee)")

  // Maps for fast lookup
  const studentById = new Map<string, any>()
  const studentByCode = new Map<string, any>()
  const studentByStudentId = new Map<string, any>()
  const studentByPhone = new Map<string, any>()
  const studentByName = new Map<string, any>()

  for (const s of allStudents || []) {
    studentById.set(s.id, s)
    if (s.referral_code) studentByCode.set(s.referral_code.trim().toUpperCase(), s)
    if (s.student_id) studentByStudentId.set(s.student_id.trim().toUpperCase(), s)
    if (s.phone) studentByPhone.set(s.phone.trim(), s)
    if (s.name) studentByName.set(s.name.trim().toLowerCase(), s)
  }

  const enrollmentByStudent = new Map<string, any>()
  for (const e of enrollments || []) {
    if (!enrollmentByStudent.has(e.student_id)) {
      enrollmentByStudent.set(e.student_id, e)
    }
  }

  const referralByReferee = new Map<string, any>()
  for (const r of dbReferrals || []) {
    if (r.referee_id && !referralByReferee.has(r.referee_id)) {
      referralByReferee.set(r.referee_id, r)
    }
  }

  // Build unified list of referrals
  const unifiedReferrals: ReferralItem[] = []
  const processedRefereeIds = new Set<string>()

  // A. First, iterate through all students who have a referral written or linked
  for (const student of allStudents || []) {
    const writtenCode = (student.referred_by_code || "").trim()
    const linkedStudentId = student.referred_by_student_id

    // Check if this student was enrolled via a referral
    if (writtenCode || linkedStudentId) {
      processedRefereeIds.add(student.id)

      // Find if there is an existing database referral row
      const existingRef = referralByReferee.get(student.id)

      // Resolve referrer
      let matchedStudent = linkedStudentId ? studentById.get(linkedStudentId) : null
      if (!matchedStudent && writtenCode) {
        const upperCode = writtenCode.toUpperCase()
        const lowerCode = writtenCode.toLowerCase()
        matchedStudent =
          studentByCode.get(upperCode) ||
          studentByStudentId.get(upperCode) ||
          studentByPhone.get(writtenCode) ||
          studentByName.get(lowerCode)
      }

      // Check if existingRef has a referrer_id that matches a student
      if (!matchedStudent && existingRef?.referrer_id) {
        matchedStudent = studentById.get(existingRef.referrer_id)
      }

      const enr = enrollmentByStudent.get(student.id)
      const batchData = enr?.batch
      const batchFee = batchData
        ? Number(batchData.monthly_fee || 0) + Number(batchData.admission_fee || 0)
        : 0

      // Commission calculations
      const defaultCommission = batchFee > 0 ? Math.round(batchFee * 0.1) : 500
      const commissionAmount =
        existingRef?.commission_amount != null
          ? Number(existingRef.commission_amount)
          : defaultCommission

      const referrerName = matchedStudent
        ? matchedStudent.name
        : existingRef?.referrer_name || writtenCode || "Unknown Referrer"

      unifiedReferrals.push({
        id: existingRef?.id || `student_${student.id}`,
        referral_db_id: existingRef?.id,
        referrer_name: referrerName,
        referrer_code: matchedStudent?.referral_code || writtenCode || undefined,
        referrer_student_id: matchedStudent?.student_id,
        referrer_phone: matchedStudent?.phone,
        referrer_id: matchedStudent?.id || existingRef?.referrer_id,
        is_matched_student: !!matchedStudent,
        written_referral_name: writtenCode || referrerName,
        referee_id: student.id,
        referee_name: student.name,
        referee_student_id: student.student_id,
        referee_phone: student.phone,
        referee_email: student.email,
        batch_name: batchData?.name,
        batch_fee: batchFee > 0 ? batchFee : undefined,
        commission_amount: commissionAmount,
        commission_rate: Number(existingRef?.commission_rate || 10),
        status: (existingRef?.status as "pending" | "approved" | "paid") || "pending",
        notes: existingRef?.notes || undefined,
        payment_method: existingRef?.payment_method || undefined,
        created_at: existingRef?.created_at || student.created_at || student.enrollment_date,
        paid_at: existingRef?.paid_at || undefined,
      })
    }
  }

  // B. Include any remaining referrals from the referrals table that weren't captured above
  for (const r of dbReferrals || []) {
    if (r.referee_id && !processedRefereeIds.has(r.referee_id)) {
      processedRefereeIds.add(r.referee_id)
      const referee = studentById.get(r.referee_id)
      const referrer = r.referrer_id ? studentById.get(r.referrer_id) : null
      const enr = enrollmentByStudent.get(r.referee_id)
      const batchData = enr?.batch
      const batchFee = batchData
        ? Number(batchData.monthly_fee || 0) + Number(batchData.admission_fee || 0)
        : 0

      const referrerName = referrer
        ? referrer.name
        : r.referrer_name || referee?.referred_by_code || "Unknown Referrer"

      unifiedReferrals.push({
        id: r.id,
        referral_db_id: r.id,
        referrer_name: referrerName,
        referrer_code: referrer?.referral_code || referee?.referred_by_code || undefined,
        referrer_student_id: referrer?.student_id,
        referrer_phone: referrer?.phone,
        referrer_id: r.referrer_id,
        is_matched_student: !!referrer,
        written_referral_name: referee?.referred_by_code || referrerName,
        referee_id: r.referee_id,
        referee_name: referee?.name || "Student #" + r.referee_id.slice(0, 8),
        referee_student_id: referee?.student_id || "N/A",
        referee_phone: referee?.phone,
        referee_email: referee?.email,
        batch_name: batchData?.name,
        batch_fee: batchFee > 0 ? batchFee : undefined,
        commission_amount: Number(r.commission_amount || 0),
        commission_rate: Number(r.commission_rate || 10),
        status: (r.status as "pending" | "approved" | "paid") || "pending",
        notes: r.notes || undefined,
        payment_method: r.payment_method || undefined,
        created_at: r.created_at,
        paid_at: r.paid_at || undefined,
      })
    }
  }

  return <ReferralsClient initialReferrals={unifiedReferrals} />
}
