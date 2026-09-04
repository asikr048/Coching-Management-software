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

    // 2. Fetch linked student record with robust multi-field lookup
    let studentRecord: any = null
    if (currentProfile.user_id) {
      const { data: sByCode } = await admin
        .from("students")
        .select("*")
        .eq("student_id", currentProfile.user_id)
        .maybeSingle()
      if (sByCode) studentRecord = sByCode
    }

    if (!studentRecord && currentProfile.email) {
      const { data: sByEmail } = await admin
        .from("students")
        .select("*")
        .ilike("email", currentProfile.email)
        .maybeSingle()
      if (sByEmail) studentRecord = sByEmail
    }

    if (!studentRecord && currentProfile.phone) {
      const { data: sByPhone } = await admin
        .from("students")
        .select("*")
        .eq("phone", currentProfile.phone)
        .maybeSingle()
      if (sByPhone) studentRecord = sByPhone
    }

    // If student record found, synchronize canonical profile
    if (studentRecord) {
      currentProfile.user_id = studentRecord.student_id || currentProfile.user_id
      currentProfile.name = studentRecord.name || currentProfile.name
      currentProfile.email = studentRecord.email || currentProfile.email
      currentProfile.phone = studentRecord.phone || currentProfile.phone
    }

    const sid = studentRecord?.id || null
    const studentCode = currentProfile.user_id
    const userEmail = currentProfile.email || user.email
    const userPhone = currentProfile.phone || user.user_metadata?.phone

    let enrollments: any[] = []
    let purchasedCourses: any[] = []
    let pendingSubmissions: any[] = []
    let attendance: any[] = []
    let dues: any[] = []
    let examResults: any[] = []

    if (sid) {
      // 3. Batch Enrollments
      try {
        const { data: enrData } = await admin
          .from("enrollments")
          .select("*, batch:batches(*, teacher:staff(name, subject), room:rooms(name))")
          .eq("student_id", sid)
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
          .eq("student_id", sid)
        if (attData) attendance = attData
      } catch (err) {
        console.warn("Attendance query note:", err)
      }

      // 5. Dues
      try {
        const { data: dueData } = await admin
          .from("fee_dues")
          .select("*, batch:batches(name)")
          .eq("student_id", sid)
          .in("status", ["pending", "partial"])
        if (dueData) dues = dueData
      } catch (err) {
        console.warn("Dues query note:", err)
      }

      // 6. Exam results
      try {
        const { data: examData } = await admin
          .from("exam_results")
          .select("*, exam:exams(title, total_marks, pass_marks)")
          .eq("student_id", sid)
        if (examData) examResults = examData
      } catch (err) {
        console.warn("Exam results query note:", err)
      }
    }

    // 7. Course Purchases lookup (by student_id, buyer_email, or buyer_phone)
    const courseMap = new Map<string, any>()

    if (sid) {
      try {
        const { data: cpList } = await admin
          .from("course_purchases")
          .select("*, course:courses(*, teacher:staff(name, subject))")
          .eq("student_id", sid)

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
    if (userEmail) {
      try {
        const { data: cpByEmail } = await admin
          .from("course_purchases")
          .select("*, course:courses(*, teacher:staff(name, subject))")
          .ilike("buyer_email", userEmail)

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

    // 8. Payment Submissions: Approved courses & pending items
    if (sid || studentCode) {
      try {
        // Query submissions belonging to this student
        let subQuery = admin.from("payment_submissions").select("*")
        if (sid) {
          subQuery = subQuery.eq("student_id", sid)
        }

        const { data: allSubmissions } = await subQuery.order("created_at", { ascending: false })

        if (allSubmissions && allSubmissions.length > 0) {
          // Identify approved course submissions and guarantee course access
          for (const sub of allSubmissions) {
            if (sub.status === "approved" && sub.course_id) {
              if (!courseMap.has(sub.course_id)) {
                // Fetch course details
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
                }
              }
            }

            // Identify pending submissions (both batches and courses)
            if (sub.status === "pending") {
              pendingSubmissions.push(sub)
            }
          }
        }
      } catch (err) {
        console.warn("Payment submissions check note:", err)
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
      student: studentRecord,
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
