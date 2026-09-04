import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // 1. Fetch user_profile
    let userProf: any = null
    const { data: byId } = await admin
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    userProf = byId

    if (!userProf && user.email) {
      const { data: byEmail } = await admin
        .from("user_profiles")
        .select("*")
        .ilike("email", user.email)
        .maybeSingle()
      userProf = byEmail
    }

    const currentProfile = userProf || {
      user_id: user.user_metadata?.user_id || "MS-" + user.id.slice(0, 5).toUpperCase(),
      name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Student",
      email: user.email,
      phone: user.user_metadata?.phone || "",
    }

    // 2. Multi-field Candidate Identity Gathering
    const candidateCodes = new Set<string>()
    if (currentProfile.user_id) candidateCodes.add(String(currentProfile.user_id).trim())
    if (user.user_metadata?.user_id) candidateCodes.add(String(user.user_metadata.user_id).trim())

    const candidateEmails = new Set<string>()
    if (currentProfile.email) candidateEmails.add(String(currentProfile.email).trim().toLowerCase())
    if (user.email) candidateEmails.add(String(user.email).trim().toLowerCase())

    const candidatePhones = new Set<string>()
    const registerPhone = (raw?: string | null) => {
      if (!raw) return
      const p = String(raw).trim()
      if (p) {
        candidatePhones.add(p)
        if (p.startsWith("+880")) candidatePhones.add(p.replace("+880", "0"))
        if (p.startsWith("+88")) candidatePhones.add(p.replace("+88", ""))
        if (p.startsWith("880")) candidatePhones.add(p.replace(/^880/, "0"))
        if (!p.startsWith("0") && p.length === 10) candidatePhones.add("0" + p)
      }
    }
    registerPhone(currentProfile.phone)
    registerPhone(user.user_metadata?.phone)

    // Query all matching students
    const matchedStudentsMap = new Map<string, any>()

    // Lookup 2a: by auth_user_id
    try {
      const { data: sAuth } = await admin
        .from("students")
        .select("*")
        .eq("auth_user_id", user.id)
      sAuth?.forEach(s => matchedStudentsMap.set(s.id, s))
    } catch {}

    // Lookup 2b: by student_id code (e.g. MS-98419)
    if (candidateCodes.size > 0) {
      try {
        const { data: sCodes } = await admin
          .from("students")
          .select("*")
          .in("student_id", Array.from(candidateCodes))
        sCodes?.forEach(s => matchedStudentsMap.set(s.id, s))
      } catch {}
    }

    // Lookup 2c: by phone numbers
    if (candidatePhones.size > 0) {
      try {
        const { data: sPhones } = await admin
          .from("students")
          .select("*")
          .in("phone", Array.from(candidatePhones))
        sPhones?.forEach(s => matchedStudentsMap.set(s.id, s))
      } catch {}
    }

    // Lookup 2d: by emails
    for (const email of candidateEmails) {
      try {
        const { data: sEmails } = await admin
          .from("students")
          .select("*")
          .ilike("email", email)
        sEmails?.forEach(s => matchedStudentsMap.set(s.id, s))
      } catch {}
    }

    const matchedStudents = Array.from(matchedStudentsMap.values())
    const candidateDbIds = new Set<string>(matchedStudents.map(s => s.id))

    // Determine primary student record
    let primaryStudent: any = null
    if (matchedStudents.length > 0) {
      primaryStudent = matchedStudents.find(s => s.student_id === currentProfile.user_id) || matchedStudents[0]
      
      if (primaryStudent.student_id) candidateCodes.add(primaryStudent.student_id)
      if (primaryStudent.phone) registerPhone(primaryStudent.phone)
      if (primaryStudent.email) candidateEmails.add(primaryStudent.email.toLowerCase())

      // Sync canonical profile
      currentProfile.user_id = primaryStudent.student_id || currentProfile.user_id
      currentProfile.name = primaryStudent.name || currentProfile.name
      currentProfile.email = primaryStudent.email || currentProfile.email
      currentProfile.phone = primaryStudent.phone || currentProfile.phone

      // Link auth_user_id to student if unlinked
      if (!primaryStudent.auth_user_id) {
        admin.from("students").update({ auth_user_id: user.id }).eq("id", primaryStudent.id).then()
      }
    }

    const sid = primaryStudent?.id || null
    const studentDbIdArray = Array.from(candidateDbIds)

    let enrollments: any[] = []
    let purchasedCourses: any[] = []
    let pendingSubmissions: any[] = []
    let attendance: any[] = []
    let dues: any[] = []
    let examResults: any[] = []

    // 3. Batch Enrollments (query across all candidate student DB IDs)
    if (studentDbIdArray.length > 0) {
      try {
        const { data: enrData } = await admin
          .from("enrollments")
          .select("*, batch:batches(*, teacher:staff(name, subject), room:rooms(name))")
          .in("student_id", studentDbIdArray)
          .eq("status", "active")
        if (enrData) enrollments = enrData
      } catch (err) {
        console.warn("Enrollments query note:", err)
      }

      // 4. Attendance
      try {
        const { data: attData } = await admin
          .from("attendance")
          .select("*")
          .in("student_id", studentDbIdArray)
        if (attData) attendance = attData
      } catch (err) {
        console.warn("Attendance query note:", err)
      }

      // 5. Dues
      try {
        const { data: dueData } = await admin
          .from("fee_dues")
          .select("*, batch:batches(name)")
          .in("student_id", studentDbIdArray)
          .in("status", ["pending", "partial"])
        if (dueData) dues = dueData
      } catch (err) {
        console.warn("Dues query note:", err)
      }

      // 6. Exam results (from exam_results and online exam_submissions)
      try {
        const { data: examData } = await admin
          .from("exam_results")
          .select("*, exam:exams(id, title, total_marks, pass_marks, exam_date, subject, batch_id)")
          .in("student_id", studentDbIdArray)
          .order("created_at", { ascending: false })
        if (examData) examResults = examData
      } catch (err) {
        console.warn("Exam results query note:", err)
      }

      // Check online exam submissions if any
      try {
        const { data: subExams } = await admin
          .from("exam_submissions")
          .select("*, exam:exams(id, title, total_marks, pass_marks, exam_date, subject, batch_id)")
          .in("student_id", studentDbIdArray)
          .eq("is_submitted", true)
          .order("submitted_at", { ascending: false })

        if (subExams && subExams.length > 0) {
          const recordedExamIds = new Set(examResults.map((r: any) => r.exam_id))
          for (const sub of subExams) {
            if (!recordedExamIds.has(sub.exam_id)) {
              const total = Number(sub.exam?.total_marks) || 100
              const obt = Number(sub.total_obtained) || 0
              const grade = obt >= total * 0.8 ? "A+" : obt >= total * 0.7 ? "A" : obt >= total * 0.6 ? "B" : obt >= total * 0.5 ? "C" : obt >= total * 0.33 ? "D" : "F"
              examResults.push({
                id: `online-${sub.id}`,
                exam_id: sub.exam_id,
                student_id: sub.student_id,
                obtained_marks: obt,
                marks_obtained: obt,
                grade: grade,
                rank: null,
                exam: sub.exam,
                created_at: sub.submitted_at || sub.created_at,
              })
            }
          }
        }
      } catch (subExamErr) {
        console.warn("Online exam submissions query note:", subExamErr)
      }

      // Normalize obtained marks fields across all items
      examResults = examResults.map((r: any) => {
        const raw = r.obtained_marks ?? r.marks_obtained
        const obt = raw != null && raw !== "" ? Number(raw) : 0
        return {
          ...r,
          obtained_marks: obt,
          marks_obtained: obt,
        }
      })
    }

    // 7. Course Purchases lookup (by student_id, buyer_email, buyer_phone)
    const courseMap = new Map<string, any>()

    if (studentDbIdArray.length > 0) {
      try {
        const { data: cpList } = await admin
          .from("course_purchases")
          .select("*, course:courses(*, teacher:staff(name, subject))")
          .in("student_id", studentDbIdArray)

        if (cpList && cpList.length > 0) {
          for (const cp of cpList) {
            if (cp.course_id) {
              courseMap.set(cp.course_id, {
                purchase_id: cp.id,
                course_id: cp.course_id,
                amount_paid: cp.amount_paid,
                payment_method: cp.payment_method,
                transaction_id: cp.transaction_id,
                purchased_at: cp.purchased_at,
                access_expires_at: cp.access_expires_at,
                course: cp.course,
              })
            }
          }
        }
      } catch (err) {
        console.warn("Course purchases by sid query note:", err)
      }
    }

    // Also check course purchases by email
    for (const email of candidateEmails) {
      try {
        const { data: cpByEmail } = await admin
          .from("course_purchases")
          .select("*, course:courses(*, teacher:staff(name, subject))")
          .ilike("buyer_email", email)

        if (cpByEmail && cpByEmail.length > 0) {
          for (const cp of cpByEmail) {
            if (cp.course_id && !courseMap.has(cp.course_id)) {
              courseMap.set(cp.course_id, {
                purchase_id: cp.id,
                course_id: cp.course_id,
                amount_paid: cp.amount_paid,
                payment_method: cp.payment_method,
                transaction_id: cp.transaction_id,
                purchased_at: cp.purchased_at,
                access_expires_at: cp.access_expires_at,
                course: cp.course,
              })
            }
          }
        }
      } catch (err) {
        console.warn("Course purchases by email query note:", err)
      }
    }

    // 8. Resilient Payment Submissions Lookup (Matches by candidate student IDs, phone, and notes)
    const submissionMap = new Map<string, any>()

    // 8a. Submissions by student DB ID
    if (studentDbIdArray.length > 0) {
      try {
        const { data: subsById } = await admin
          .from("payment_submissions")
          .select("*")
          .in("student_id", studentDbIdArray)
        subsById?.forEach(s => submissionMap.set(s.id, s))
      } catch (err) {
        console.warn("Submissions by student_id note:", err)
      }
    }

    // 8b. Submissions by sender phone number
    if (candidatePhones.size > 0) {
      try {
        const { data: subsByPhone } = await admin
          .from("payment_submissions")
          .select("*")
          .in("sender_number", Array.from(candidatePhones))
        subsByPhone?.forEach(s => submissionMap.set(s.id, s))
      } catch (err) {
        console.warn("Submissions by sender_number note:", err)
      }
    }

    // 8c. Submissions by student code or phone in notes
    for (const code of candidateCodes) {
      try {
        const { data: subsByNoteCode } = await admin
          .from("payment_submissions")
          .select("*")
          .ilike("notes", "%" + code + "%")
        subsByNoteCode?.forEach(s => submissionMap.set(s.id, s))
      } catch {}
    }

    for (const phone of candidatePhones) {
      if (phone.length >= 10) {
        try {
          const { data: subsByNotePhone } = await admin
            .from("payment_submissions")
            .select("*")
            .ilike("notes", "%" + phone + "%")
          subsByNotePhone?.forEach(s => submissionMap.set(s.id, s))
        } catch {}
      }
    }

    const allSubmissions = Array.from(submissionMap.values())
    const enrolledBatchIds = new Set(enrollments.map(e => e.batch_id).filter(Boolean))
    const targetStudentId = sid || (studentDbIdArray.length > 0 ? studentDbIdArray[0] : null)

    // 9. Process Submissions: Auto-heal approved batches/courses and collect pending
    for (const sub of allSubmissions) {
      // 9a. Approved Batch Submissions Auto-Healing
      if (sub.status === "approved" && sub.batch_id) {
        if (!enrolledBatchIds.has(sub.batch_id)) {
          const { data: batchData } = await admin
            .from("batches")
            .select("*, teacher:staff(name, subject), room:rooms(name)")
            .eq("id", sub.batch_id)
            .maybeSingle()

          if (batchData) {
            enrolledBatchIds.add(sub.batch_id)
            const synthEnrollment = {
              id: "synth-" + sub.id,
              student_id: targetStudentId || sub.student_id,
              batch_id: sub.batch_id,
              status: "active",
              enrollment_date: (sub.approved_at || sub.created_at || new Date().toISOString()).slice(0, 10),
              created_at: sub.approved_at || sub.created_at || new Date().toISOString(),
              batch: batchData,
            }
            enrollments.push(synthEnrollment)

            // Auto-heal permanently in PostgreSQL enrollments table
            const finalStudentId = targetStudentId || sub.student_id
            if (finalStudentId) {
              try {
                await admin.from("enrollments").upsert({
                  student_id: finalStudentId,
                  batch_id: sub.batch_id,
                  status: "active",
                }, { onConflict: "student_id,batch_id" })
              } catch (upsertErr) {
                console.warn("Enrollment auto-heal upsert note, trying fallback insert:", upsertErr)
                try {
                  const { data: checkExisting } = await admin
                    .from("enrollments")
                    .select("id, status")
                    .eq("student_id", finalStudentId)
                    .eq("batch_id", sub.batch_id)
                    .maybeSingle()

                  if (!checkExisting) {
                    await admin.from("enrollments").insert({
                      student_id: finalStudentId,
                      batch_id: sub.batch_id,
                      status: "active",
                    })
                  } else if (checkExisting.status !== "active") {
                    await admin.from("enrollments").update({ status: "active" }).eq("id", checkExisting.id)
                  }
                } catch (fallbackErr) {
                  console.warn("Enrollment auto-heal fallback note:", fallbackErr)
                }
              }
            }
          }
        }
      }

      // 9b. Approved Course Submissions Auto-Healing
      if (sub.status === "approved" && sub.course_id) {
        if (!courseMap.has(sub.course_id)) {
          const { data: courseInfo } = await admin
            .from("courses")
            .select("*, teacher:staff(name, subject)")
            .eq("id", sub.course_id)
            .maybeSingle()

          if (courseInfo) {
            courseMap.set(sub.course_id, {
              purchase_id: sub.id,
              course_id: sub.course_id,
              amount_paid: sub.amount,
              payment_method: sub.payment_method,
              transaction_id: sub.transaction_id || sub.trx_id,
              purchased_at: sub.approved_at || sub.created_at,
              access_expires_at: null,
              course: courseInfo,
            })

            // Auto-heal in course_purchases table if missing
            const finalStudentId = targetStudentId || sub.student_id
            if (finalStudentId) {
              try {
                const { data: existingCp } = await admin
                  .from("course_purchases")
                  .select("id")
                  .eq("course_id", sub.course_id)
                  .eq("student_id", finalStudentId)
                  .maybeSingle()

                if (!existingCp) {
                  await admin.from("course_purchases").insert({
                    course_id: sub.course_id,
                    student_id: finalStudentId,
                    buyer_name: currentProfile.name || "Student",
                    buyer_phone: currentProfile.phone || sub.sender_number || null,
                    buyer_email: currentProfile.email || null,
                    amount_paid: sub.amount,
                    payment_method: sub.payment_method || "online",
                    transaction_id: sub.transaction_id || sub.trx_id,
                  })
                }
              } catch (cpErr) {
                console.warn("Course purchase auto-heal note:", cpErr)
              }
            }
          }
        }
      }

      // 9c. Pending Submissions (both batches and courses)
      if (sub.status === "pending") {
        if (sub.batch_id && !enrolledBatchIds.has(sub.batch_id)) {
          pendingSubmissions.push(sub)
        } else if (sub.course_id && !courseMap.has(sub.course_id)) {
          pendingSubmissions.push(sub)
        }
      }
    }

    // Enrich pending submissions with batch or course data
    if (pendingSubmissions.length > 0) {
      const batchIds = pendingSubmissions.filter(s => s.batch_id).map(s => s.batch_id)
      const courseIds = pendingSubmissions.filter(s => s.course_id).map(s => s.course_id)

      const batchMap = new Map<string, any>()
      const courseInfoMap = new Map<string, any>()

      if (batchIds.length > 0) {
        const { data: bList } = await admin
          .from("batches")
          .select("id, name, subject, monthly_fee, teacher:staff(name)")
          .in("id", batchIds)
        bList?.forEach(b => batchMap.set(b.id, b))
      }

      if (courseIds.length > 0) {
        const { data: cList } = await admin
          .from("courses")
          .select("id, title, category, price, thumbnail_url, teacher:staff(name)")
          .in("id", courseIds)
        cList?.forEach(c => courseInfoMap.set(c.id, c))
      }

      pendingSubmissions = pendingSubmissions.map(s => ({
        ...s,
        batch: s.batch_id ? batchMap.get(s.batch_id) || null : null,
        course: s.course_id ? courseInfoMap.get(s.course_id) || null : null,
      }))
    }

    purchasedCourses = Array.from(courseMap.values())

    return NextResponse.json({
      success: true,
      profile: currentProfile,
      student: primaryStudent,
      enrollments,
      courses: purchasedCourses,
      pendingSubmissions,
      attendance,
      dues,
      examResults,
    })
  } catch (error: any) {
    console.error("Student profile API exception:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load profile data" },
      { status: 500 }
    )
  }
}
