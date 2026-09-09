import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

function getWeeklyMarks(ex: any, recDays: any[]) {
  const note = ex?.result_note || ""
  const isWeekly =
    ex?.exam_schedule_type === "weekly" ||
    (Array.isArray(recDays) && recDays.length > 0) ||
    ex?.is_weekly_published === true ||
    Boolean(ex?.title?.includes("সাপ্তাহিক"))

  if (!isWeekly) {
    return {
      isWeekly: false,
      totalMarks: Number(ex?.total_marks) || 100,
      passMarks: Number(ex?.pass_marks) || 33,
    }
  }

  const confMap: Record<string, any> = {}
  const candidateDays = Array.isArray(recDays) ? recDays : []
  for (const d of candidateDays) {
    const isObj = typeof d === "object" && d !== null
    const rawKey = isObj ? (d.day || d.day_bn || d.day_en || "") : String(d)
    const lowerKey = String(rawKey).toLowerCase()
    const matched = ALL_WEEK_DAYS.find((w) => w.id === lowerKey || w.bn === rawKey || w.en.toLowerCase() === lowerKey)
    const canonicalKey = matched?.id || lowerKey
    confMap[canonicalKey] = d
  }

  let sumTotal = 0
  let sumPass = 0
  for (const w of ALL_WEEK_DAYS) {
    const conf = confMap[w.id]
    const dTotal = conf && typeof conf === "object" && conf.total_marks ? Number(conf.total_marks) : 50
    const dPass = conf && typeof conf === "object" && conf.pass_marks ? Number(conf.pass_marks) : 20
    sumTotal += dTotal
    sumPass += dPass
  }

  return {
    isWeekly: true,
    totalMarks: sumTotal > 0 ? sumTotal : 350,
    passMarks: sumPass > 0 ? sumPass : 140,
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // 1. Fetch user_profile and active payment_accounts simultaneously in parallel
    const [userProfRes, acctRes] = await Promise.all([
      admin
        .from("user_profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      admin
        .from("payment_accounts")
        .select("*")
        .eq("is_active", true),
    ])

    let userProf = userProfRes.data
    const paymentAccounts = acctRes.data || []

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

    // Run high-confidence student identity lookups in parallel
    const studentQueries: any[] = [
      admin.from("students").select("*").eq("auth_user_id", user.id),
    ]
    if (candidateCodes.size > 0) {
      studentQueries.push(
        admin.from("students").select("*").in("student_id", Array.from(candidateCodes))
      )
    }
    if (candidateEmails.size > 0) {
      const emailList = Array.from(candidateEmails)
      studentQueries.push(
        admin.from("students").select("*").or(emailList.map(e => `email.ilike.${e}`).join(","))
      )
    }

    const matchedStudentsMap = new Map<string, any>()
    const studentResults = await Promise.all(studentQueries)
    for (const res of studentResults) {
      res.data?.forEach((s: any) => matchedStudentsMap.set(s.id, s))
    }

    // Always include students matching candidate phones
    if (candidatePhones.size > 0) {
      const { data: phoneStudents } = await admin
        .from("students")
        .select("*")
        .in("phone", Array.from(candidatePhones))

      if (phoneStudents && phoneStudents.length > 0) {
        for (const s of phoneStudents) {
          if (!s.auth_user_id || s.auth_user_id === user.id) {
            matchedStudentsMap.set(s.id, s)
          }
        }
      }
    }

    const matchedStudents = Array.from(matchedStudentsMap.values())

    let primaryStudent: any = null
    if (matchedStudents.length > 0) {
      primaryStudent =
        matchedStudents.find(s => s.auth_user_id === user.id) ||
        matchedStudents.find(s => s.student_id && candidateCodes.has(s.student_id)) ||
        matchedStudents.find(s => s.email && candidateEmails.has(s.email.toLowerCase())) ||
        matchedStudents[0]

      if (primaryStudent.student_id) candidateCodes.add(primaryStudent.student_id)
      if (primaryStudent.phone) registerPhone(primaryStudent.phone)
      if (primaryStudent.email) candidateEmails.add(primaryStudent.email.toLowerCase())

      currentProfile.user_id = primaryStudent.student_id || currentProfile.user_id
      currentProfile.name = primaryStudent.name || currentProfile.name
      currentProfile.email = primaryStudent.email || currentProfile.email
      currentProfile.phone = primaryStudent.phone || currentProfile.phone

      // Background link auth_user_id (non-blocking)
      if (!primaryStudent.auth_user_id) {
        admin.from("students").update({ auth_user_id: user.id }).eq("id", primaryStudent.id).then()
      }
    }

    // Also find any sibling student records in the student's enrolled batches sharing the same name
    const studentNames = new Set<string>()
    if (primaryStudent?.name) studentNames.add(primaryStudent.name.trim().toLowerCase())
    if (currentProfile?.name) studentNames.add(currentProfile.name.trim().toLowerCase())
    matchedStudents.forEach((s: any) => {
      if (s.name) studentNames.add(s.name.trim().toLowerCase())
    })

    const studentBatchIds = Array.from(new Set([
      primaryStudent?.batch_id,
      ...matchedStudents.map((s: any) => s.batch_id)
    ].filter(Boolean)))

    if (studentNames.size > 0 && studentBatchIds.length > 0) {
      try {
        const { data: batchSiblingStudents } = await admin
          .from("students")
          .select("*")
          .in("batch_id", studentBatchIds)

        if (batchSiblingStudents) {
          for (const bs of batchSiblingStudents) {
            const bsName = String(bs.name || "").trim().toLowerCase()
            if (bsName && studentNames.has(bsName)) {
              if (!bs.auth_user_id || bs.auth_user_id === user.id) {
                matchedStudentsMap.set(bs.id, bs)
                if (bs.student_id) candidateCodes.add(bs.student_id)
              }
            }
          }
        }
      } catch {}
    }

    // Ensure candidateDbIds ONLY contains records that belong to THIS student
    const candidateDbIds = new Set<string>()
    if (primaryStudent?.id) {
      candidateDbIds.add(primaryStudent.id)
    }
    for (const s of matchedStudents) {
      // Must not belong to a different student code (prevent cross-student data leakage)
      if (primaryStudent?.student_id && s.student_id && s.student_id !== primaryStudent.student_id) {
        continue
      }
      if (
        (primaryStudent?.student_id && s.student_id === primaryStudent.student_id) ||
        (s.auth_user_id && s.auth_user_id === user.id) ||
        (primaryStudent?.email && s.email && s.email.toLowerCase() === primaryStudent.email.toLowerCase())
      ) {
        candidateDbIds.add(s.id)
      }
    }

    const sid = primaryStudent?.id || null
    const studentDbIdArray = Array.from(candidateDbIds)

    // 3. Parallel Batch Execution of all core datasets
    const subQueries: any[] = []
    if (studentDbIdArray.length > 0) {
      subQueries.push(admin.from("payment_submissions").select("*").in("student_id", studentDbIdArray))
    }
    if (candidateCodes.size > 0) {
      const codeArray = Array.from(candidateCodes)
      // Check if student_id column directly stored student code (e.g. MS-98422)
      subQueries.push(admin.from("payment_submissions").select("*").in("student_id", codeArray))
      // Check if notes specifically contains the unique student ID
      subQueries.push(
        admin.from("payment_submissions").select("*").or(codeArray.map(c => `notes.ilike.%${c}%`).join(","))
      )
    }

    const [
      enrResult,
      attResult,
      dueResult,
      examResult,
      examSubResult,
      cpSidResult,
      cpEmailResult,
      ...subResults
    ] = await Promise.all([
      studentDbIdArray.length > 0
        ? admin
            .from("enrollments")
            .select("*, batch:batches(*, teacher:staff(name, subject), room:rooms(name))")
            .in("student_id", studentDbIdArray)
            .eq("status", "active")
        : Promise.resolve({ data: [] }),

      studentDbIdArray.length > 0
        ? admin
            .from("attendance")
            .select("*")
            .in("student_id", studentDbIdArray)
            .order("date", { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] }),

      studentDbIdArray.length > 0
        ? admin
            .from("fee_dues")
            .select("*, batch:batches(name)")
            .in("student_id", studentDbIdArray)
            .in("status", ["pending", "partial", "paid", "waived"])
            .order("due_month", { ascending: false })
        : Promise.resolve({ data: [] }),

      studentDbIdArray.length > 0
        ? admin
            .from("exam_results")
            .select("*, exam:exams(*)")
            .in("student_id", studentDbIdArray)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),

      studentDbIdArray.length > 0
        ? admin
            .from("exam_submissions")
            .select("*, exam:exams(id, title, total_marks, pass_marks, exam_date, subject, batch_id, show_all_results, result_note)")
            .in("student_id", studentDbIdArray)
            .eq("is_submitted", true)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [] }),

      studentDbIdArray.length > 0
        ? admin
            .from("course_purchases")
            .select("*, course:courses(*, teacher:staff(name, subject))")
            .in("student_id", studentDbIdArray)
        : Promise.resolve({ data: [] }),

      candidateEmails.size > 0
        ? admin
            .from("course_purchases")
            .select("*, course:courses(*, teacher:staff(name, subject))")
            .in("buyer_email", Array.from(candidateEmails))
        : Promise.resolve({ data: [] }),

      ...subQueries,
    ])

    let enrollments: any[] = enrResult.data || []
    let attendance: any[] = attResult.data || []
    let dues: any[] = dueResult.data || []

    // 4. Fast Dues Auto-Heal in 1 Batched Query
    if (enrollments.length > 0) {
      const enrsNeedingDueCheck = enrollments.filter(enr => {
        const b = enr.batch
        if (!b) return false
        const feeTotal = (Number(b.monthly_fee) || 0) + (Number(b.admission_fee) || 0) || Number(b.monthly_fee) || 0
        if (feeTotal <= 0) return false
        return !dues.some(d => d.batch_id === enr.batch_id)
      })

      if (enrsNeedingDueCheck.length > 0) {
        const checkBatchIds = enrsNeedingDueCheck.map(e => e.batch_id)
        const { data: payList } = await admin
          .from("payments")
          .select("batch_id, amount, total_paid")
          .in("student_id", studentDbIdArray)
          .in("batch_id", checkBatchIds)

        const paymentsByBatch = new Map<string, number>()
        payList?.forEach((p: any) => {
          const prev = paymentsByBatch.get(p.batch_id) || 0
          paymentsByBatch.set(p.batch_id, prev + (Number(p.total_paid) || Number(p.amount) || 0))
        })

        const targetDueDate = (() => {
          const d = new Date()
          d.setMonth(d.getMonth() + 1)
          d.setDate(10)
          return d.toISOString().split("T")[0]
        })()
        const nowMonth = new Date().toISOString().slice(0, 7)

        const duesToInsert: any[] = []
        for (const enr of enrsNeedingDueCheck) {
          const b = enr.batch
          const feeTotal = (Number(b.monthly_fee) || 0) + (Number(b.admission_fee) || 0) || Number(b.monthly_fee) || 0
          const paidTotal = paymentsByBatch.get(enr.batch_id) || 0
          if (paidTotal < feeTotal) {
            duesToInsert.push({
              student_id: enr.student_id || studentDbIdArray[0],
              batch_id: enr.batch_id,
              due_month: enr.created_at ? new Date(enr.created_at).toISOString().slice(0, 7) : nowMonth,
              due_amount: feeTotal,
              paid_amount: paidTotal,
              due_date: targetDueDate,
              status: paidTotal > 0 ? "partial" : "pending",
            })
          }
        }

        if (duesToInsert.length > 0) {
          const { data: insertedDues } = await admin
            .from("fee_dues")
            .insert(duesToInsert)
            .select("*, batch:batches(name)")
          if (insertedDues) {
            dues.push(...insertedDues)
          }
        }
      }
    }

    // 5. Exam Results & Online Submissions
    let examResults: any[] = (examResult as any)?.data || []
    if ((examResult as any)?.error) {
      // Fallback without show_all_results if column missing in DB schema
      const { data: fbData } = await admin
        .from("exam_results")
        .select("*, exam:exams(id, title, total_marks, pass_marks, exam_date, subject, batch_id, result_note)")
        .in("student_id", studentDbIdArray)
        .order("created_at", { ascending: false })
      if (fbData) examResults = fbData
    }

    const subExams: any[] = examSubResult.data || []
    if (subExams.length > 0) {
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

    examResults = examResults.map((r: any) => {
      const raw = r.obtained_marks ?? r.marks_obtained
      const obt = raw != null && raw !== "" ? Number(raw) : 0

      // Extract fallback day marks from exam.result_note if needed
      let sDayMarks = r.day_marks
      if (
        (!sDayMarks || typeof sDayMarks !== "object" || Object.keys(sDayMarks).length === 0) &&
        r.exam?.result_note?.includes("[STUDENT_DAY_MARKS:")
      ) {
        try {
          const match = r.exam.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
          if (match && match[1]) {
            const parsed = JSON.parse(match[1])
            if (parsed[r.student_id]) {
              sDayMarks = parsed[r.student_id]
            }
          }
        } catch {}
      }

      // Normalize exam inside result
      let normalizedExam = r.exam
      if (normalizedExam) {
        const note = normalizedExam.result_note || ""
        let recDays = normalizedExam.recurring_days
        if ((!recDays || (Array.isArray(recDays) && recDays.length === 0)) && note.includes("[RECURRING_DAYS:")) {
          try {
            const match = note.match(/\[RECURRING_DAYS:(.*?)\]/)
            if (match && match[1]) recDays = JSON.parse(match[1])
          } catch {}
        }
        const isWeeklyPub = normalizedExam.is_weekly_published === true || note.includes("[IS_WEEKLY_PUBLISHED:true]")
        const isPubRes = normalizedExam.is_public_result === true || note.includes("[PUBLIC_RESULT:true]") || isWeeklyPub
        let pubDays = normalizedExam.published_days || []
        if (note.includes("[PUBLISHED_DAYS:")) {
          try {
            const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
            if (match && match[1]) pubDays = match[1].split(",").filter(Boolean)
          } catch {}
        }

        const marksInfo = getWeeklyMarks(normalizedExam, recDays)

        normalizedExam = {
          ...normalizedExam,
          total_marks: marksInfo.totalMarks,
          pass_marks: marksInfo.passMarks,
          recurring_days: recDays,
          is_weekly_published: isWeeklyPub,
          is_public_result: isPubRes,
          published_days: pubDays,
          is_published: normalizedExam.is_published === true || isWeeklyPub || isPubRes || pubDays.length > 0,
          exam_schedule_type: marksInfo.isWeekly ? "weekly" : (normalizedExam.exam_schedule_type || "one_time"),
        }
      }

      // Check day marks sum
      let finalObt = obt
      if (normalizedExam?.exam_schedule_type === "weekly" && sDayMarks && typeof sDayMarks === "object") {
        let daySum = 0
        for (const v of Object.values(sDayMarks)) {
          const m = typeof v === "object" && v !== null ? Number((v as any).marks) : Number(v)
          if (!isNaN(m) && m > 0) daySum += m
        }
        if (daySum > 0 && (finalObt === 0 || daySum > finalObt)) {
          finalObt = daySum
        }
      }

      const totalMarks = Number(normalizedExam?.total_marks) || 100
      const pct = totalMarks > 0 ? Math.round((finalObt / totalMarks) * 100) : 0
      let autoGrade = r.grade
      if (!autoGrade || autoGrade === "Pass" || autoGrade === "Fail") {
        if (pct >= 80) autoGrade = "A+"
        else if (pct >= 70) autoGrade = "A"
        else if (pct >= 60) autoGrade = "A-"
        else if (pct >= 50) autoGrade = "B"
        else if (pct >= 40) autoGrade = "C"
        else if (pct >= 33) autoGrade = "D"
        else autoGrade = "F"
      }

      return {
        ...r,
        obtained_marks: finalObt,
        marks_obtained: finalObt,
        grade: autoGrade,
        day_marks: sDayMarks || {},
        exam: normalizedExam,
      }
    })

    // Dynamic Rank Computation
    if (examResults.length > 0) {
      const examIds = Array.from(new Set(examResults.map((r: any) => r.exam_id).filter(Boolean)))
      if (examIds.length > 0) {
        try {
          const { data: allExamMarks } = await admin
            .from("exam_results")
            .select("exam_id, student_id, obtained_marks")
            .in("exam_id", examIds)

          if (allExamMarks && allExamMarks.length > 0) {
            const examToRankMap = new Map<string, Map<string, number>>()
            for (const eid of examIds) {
              const marksForExam = allExamMarks
                .filter((m: any) => m.exam_id === eid)
                .sort((a: any, b: any) => (Number(b.obtained_marks) || 0) - (Number(a.obtained_marks) || 0))

              const studentRank = new Map<string, number>()
              let curRank = 1
              marksForExam.forEach((item: any, idx: number) => {
                if (idx > 0) {
                  const prev = Number(marksForExam[idx - 1].obtained_marks) || 0
                  const cur = Number(item.obtained_marks) || 0
                  if (cur < prev) curRank = idx + 1
                }
                studentRank.set(item.student_id, curRank)
              })
              examToRankMap.set(eid, studentRank)
            }

            examResults = examResults.map((r: any) => {
              const rMap = examToRankMap.get(r.exam_id)
              const computed = rMap ? rMap.get(r.student_id) : null
              return {
                ...r,
                rank: computed !== undefined && computed !== null ? computed : r.rank,
              }
            })
          }
        } catch (rankErr) {
          console.warn("Rank computation note in profile route:", rankErr)
        }
      }
    }

    // 5b. Fetch scheduled batch exams & materials for enrolled batches
    const studentEnrolledBatchIds = Array.from(new Set([
      ...enrollments.map((e: any) => e.batch_id || e.batch?.id).filter(Boolean),
      ...(primaryStudent?.batch_id ? [primaryStudent.batch_id] : []),
      ...matchedStudents.map((s: any) => s.batch_id).filter(Boolean),
      ...subResults.flatMap((sr: any) => sr.data || []).filter((s: any) => s.batch_id).map((s: any) => s.batch_id),
    ]))
    const studentBatchIdSet = new Set(studentEnrolledBatchIds.map(String))
    let batchExams: any[] = []
    let batchMaterials: any[] = []
    let materialIssues: any[] = []

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const allStudentUuidsSet = new Set<string>()
    if (primaryStudent?.id && uuidRegex.test(String(primaryStudent.id))) {
      allStudentUuidsSet.add(String(primaryStudent.id))
    }
    studentDbIdArray.forEach(id => {
      if (id && uuidRegex.test(String(id))) allStudentUuidsSet.add(String(id))
    })
    matchedStudents.forEach((s: any) => {
      if (s?.id && uuidRegex.test(String(s.id))) allStudentUuidsSet.add(String(s.id))
    })
    const cleanIssueStudentUuids = Array.from(allStudentUuidsSet)

    try {
      const [bExamsRes, bMatsRes, mIssRes] = await Promise.all([
        studentEnrolledBatchIds.length > 0
          ? admin
              .from("exams")
              .select("*, teacher:staff(name)")
              .order("exam_date", { ascending: false })
          : Promise.resolve({ data: [] }),
        admin
          .from("materials")
          .select("*")
          .order("created_at", { ascending: false }),
        cleanIssueStudentUuids.length > 0
          ? admin
              .from("material_issues")
              .select("*, material:materials(*)")
              .in("student_id", cleanIssueStudentUuids)
              .order("issued_at", { ascending: false })
            : Promise.resolve({ data: [] })
      ])

      if (bExamsRes.data) {
        const rawExams = bExamsRes.data || []
        batchExams = rawExams
          .filter((ex: any) => {
            if (ex.batch_id && studentBatchIdSet.has(String(ex.batch_id))) return true
            if (ex.batch_ids) {
              if (Array.isArray(ex.batch_ids)) {
                if (ex.batch_ids.some((bid: any) => studentBatchIdSet.has(String(bid)))) return true
              } else if (typeof ex.batch_ids === "string") {
                try {
                  const parsed = JSON.parse(ex.batch_ids)
                  if (Array.isArray(parsed) && parsed.some((bid: any) => studentBatchIdSet.has(String(bid)))) return true
                } catch {
                  if (Array.from(studentBatchIdSet).some((bid) => ex.batch_ids.includes(bid))) return true
                }
              }
            }
            return false
          })
          .map((ex: any) => {
            const note = ex.result_note || ""
            let recDays = ex.recurring_days
            if ((!recDays || (Array.isArray(recDays) && recDays.length === 0)) && note.includes("[RECURRING_DAYS:")) {
              try {
                const match = note.match(/\[RECURRING_DAYS:(.*?)\]/)
                if (match && match[1]) recDays = JSON.parse(match[1])
              } catch {}
            }
            const isWeeklyPub = ex.is_weekly_published === true || note.includes("[IS_WEEKLY_PUBLISHED:true]")
            const isPubRes = ex.is_public_result === true || note.includes("[PUBLIC_RESULT:true]") || isWeeklyPub
            let pubDays = ex.published_days || []
            if (note.includes("[PUBLISHED_DAYS:")) {
              try {
                const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
                if (match && match[1]) pubDays = match[1].split(",").filter(Boolean)
              } catch {}
            }
            const marksInfo = getWeeklyMarks(ex, recDays)
            return {
              ...ex,
              total_marks: marksInfo.totalMarks,
              pass_marks: marksInfo.passMarks,
              recurring_days: recDays,
              is_weekly_published: isWeeklyPub,
              is_public_result: isPubRes,
              published_days: pubDays,
              is_published: ex.is_published === true || isWeeklyPub || isPubRes || pubDays.length > 0,
              exam_schedule_type:
                marksInfo.isWeekly
                  ? "weekly"
                  : ex.exam_schedule_type || "one_time",
            }
          })
      }
      if (mIssRes.data) {
        materialIssues = mIssRes.data.filter((iss: any) => iss.status !== "returned")
      }

      // Also check issues in enrolled batches where student name, phone, or code matches
      if (studentEnrolledBatchIds.length > 0) {
        try {
          const { data: bIssues } = await admin
            .from("material_issues")
            .select("*, material:materials(*), student:students(id, name, student_id, phone, email)")
            .in("batch_id", studentEnrolledBatchIds)
            .eq("status", "issued")

          if (bIssues) {
            const seenIds = new Set(materialIssues.map((i: any) => i.id))
            for (const bi of bIssues) {
              if (seenIds.has(bi.id)) continue
              const st = bi.student || {}
              const stId = st.id || bi.student_id
              const stCode = (st.student_id || "").trim()
              const stPhone = (st.phone || "").trim()
              const stName = (st.name || "").trim().toLowerCase()

              let isMatch = false
              if (stId && cleanIssueStudentUuids.includes(stId)) isMatch = true
              if (stCode && candidateCodes.has(stCode)) isMatch = true
              if (stPhone && candidatePhones.has(stPhone)) isMatch = true
              if (stName && studentNames.has(stName)) isMatch = true

              if (isMatch) {
                materialIssues.push(bi)
                seenIds.add(bi.id)
              }
            }
          }
        } catch (bErr) {
          console.warn("Batch material issues lookup note:", bErr)
        }
      }

      const rawMats = bMatsRes.data || []
      const issuedMatIds = new Set(materialIssues.map((iss: any) => String(iss.material_id)).filter(Boolean))
      const issuedMatNames = new Set(
        materialIssues.map((iss: any) => String(iss.material?.name || iss.material_name || iss.name || "").trim().toLowerCase()).filter(Boolean)
      )

      const studentBranchIdSet = new Set(
        enrollments.map((e: any) => e.batch?.branch_id).filter(Boolean).map(String)
      )
      if (primaryStudent?.branch_id) studentBranchIdSet.add(String(primaryStudent.branch_id))

      const enrolledBatchNames = new Set(
        enrollments.map((e: any) => e.batch?.name).filter(Boolean).map(n => String(n).trim().toLowerCase())
      )

      // Collect any enrolled or purchased course IDs and titles
      const enrolledCourseIdSet = new Set<string>()
      const enrolledCourseTitles = new Set<string>()
      const allCoursePurchases = [ ...(cpSidResult?.data || []), ...(cpEmailResult?.data || []) ]
      allCoursePurchases.forEach((cp: any) => {
        if (cp.course_id) enrolledCourseIdSet.add(String(cp.course_id))
        if (cp.course?.title) enrolledCourseTitles.add(String(cp.course.title).trim().toLowerCase())
      })

      // Also include any approved payment submissions for courses
      for (const sr of subResults) {
        sr.data?.forEach((sub: any) => {
          if (sub.status === "approved" && sub.course_id) {
            enrolledCourseIdSet.add(String(sub.course_id))
            if (sub.course?.title) enrolledCourseTitles.add(String(sub.course.title).trim().toLowerCase())
          }
        })
      }

      batchMaterials = rawMats.filter((m: any) => {
        // 1. If student was issued this material directly (by ID or by name), always show
        if (issuedMatIds.has(m.id) || (m.name && issuedMatNames.has(m.name.trim().toLowerCase()))) return true

        // 2. Direct single batch match
        if (m.batch_id && studentBatchIdSet.has(String(m.batch_id))) return true

        // 3. Multi-batch match via batch_ids (JSONB or array or string)
        if (m.batch_ids) {
          if (Array.isArray(m.batch_ids)) {
            if (m.batch_ids.some((bid: any) => studentBatchIdSet.has(String(bid)))) return true
          } else if (typeof m.batch_ids === 'string') {
            try {
              const parsed = JSON.parse(m.batch_ids)
              if (Array.isArray(parsed) && parsed.some((bid: any) => studentBatchIdSet.has(String(bid)))) return true
            } catch {
              if (Array.from(studentBatchIdSet).some(bid => m.batch_ids.includes(bid))) return true
            }
          }
        }

        // 3.5. Batch Name Match (e.g. "Class 9")
        if (enrolledBatchNames.size > 0) {
          if (m.batch_name && enrolledBatchNames.has(String(m.batch_name).trim().toLowerCase())) return true
          if (m.subject && enrolledBatchNames.has(String(m.subject).trim().toLowerCase())) return true
          if (Array.isArray(m.batch_names) && m.batch_names.some((bn: any) => enrolledBatchNames.has(String(bn).trim().toLowerCase()))) return true
        }

        // 3.8. Course Match (for online course materials)
        if (m.course_id && enrolledCourseIdSet.has(String(m.course_id))) return true
        if (enrolledCourseTitles.size > 0) {
          if (m.subject && enrolledCourseTitles.has(String(m.subject).trim().toLowerCase())) return true
          if (m.name && Array.from(enrolledCourseTitles).some(ct => m.name.toLowerCase().includes(ct))) return true
        }

        // 4. If material has NO specific batch or course specified (general batch material)
        const hasNoBatch = (!m.batch_id || m.batch_id === "" || m.batch_id === "all") &&
          (!m.batch_ids || (Array.isArray(m.batch_ids) && m.batch_ids.length === 0) || m.batch_ids === "[]") &&
          !m.course_id

        if (hasNoBatch) {
          if (m.branch_id && studentBranchIdSet.size > 0) {
            return studentBranchIdSet.has(String(m.branch_id))
          }
          return true
        }

        // 5. If student has only 1 batch enrolled and the material has 1 batch (fallback safeguard)
        if (studentBatchIdSet.size === 1 && m.batch_id && studentBatchIdSet.has(String(m.batch_id))) {
          return true
        }

        return false
      }).map((m: any) => {
        const iss = materialIssues.find((i: any) => {
          if (i.status === "returned") return false
          if (i.material_id && String(i.material_id) === String(m.id)) return true
          const iName = String(i.material?.name || i.material_name || i.name || "").trim().toLowerCase()
          const mName = String(m.name || "").trim().toLowerCase()
          return iName && mName && iName === mName
        })
        return {
          ...m,
          is_received: !!iss && iss.status !== "returned",
          issued_at: iss?.issued_at || null,
          issue_record: iss || null,
        }
      })
    } catch (extraErr) {
      console.warn("Scheduled exams & materials profile fetch notice:", extraErr)
    }

    // 6. Course Purchases
    const courseMap = new Map<string, any>()
    const addCoursePurchase = (cp: any) => {
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
    cpSidResult.data?.forEach(addCoursePurchase)
    cpEmailResult.data?.forEach(addCoursePurchase)

    // 7. Payment Submissions Aggregation
    const submissionMap = new Map<string, any>()
    for (const sr of subResults) {
      sr.data?.forEach((s: any) => submissionMap.set(s.id, s))
    }
    const allSubmissions = Array.from(submissionMap.values())
    const enrolledBatchIds = new Set(enrollments.map(e => e.batch_id).filter(Boolean))
    const targetStudentId = sid || (studentDbIdArray.length > 0 ? studentDbIdArray[0] : null)

    // Batch fetch any missing batch or course details needed for submissions in 1 parallel query
    const approvedMissingBatchIds = Array.from(new Set(
      allSubmissions
        .filter(s => s.status === "approved" && s.batch_id && !enrolledBatchIds.has(s.batch_id))
        .map(s => s.batch_id)
    ))

    const approvedMissingCourseIds = Array.from(new Set(
      allSubmissions
        .filter(s => s.status === "approved" && s.course_id && !courseMap.has(s.course_id))
        .map(s => s.course_id)
    ))

    const pendingSubs = allSubmissions.filter(s => {
      if (s.status !== "pending") return false

      // Guard: strictly ensure submission belongs to this student
      const codeList = Array.from(candidateCodes)
      const belongsToStudent =
        (s.student_id && (candidateDbIds.has(s.student_id) || candidateCodes.has(s.student_id))) ||
        (s.notes && codeList.some(c => s.notes.includes(c)))

      if (!belongsToStudent && (candidateDbIds.size > 0 || candidateCodes.size > 0)) {
        return false
      }

      if (s.batch_id && !enrolledBatchIds.has(s.batch_id)) return true
      if (s.course_id && !courseMap.has(s.course_id)) return true
      return false
    })

    const pendingBatchIds = Array.from(new Set(pendingSubs.filter(s => s.batch_id).map(s => s.batch_id)))
    const pendingCourseIds = Array.from(new Set(pendingSubs.filter(s => s.course_id).map(s => s.course_id)))

    const allNeededBatchIds = Array.from(new Set([...approvedMissingBatchIds, ...pendingBatchIds]))
    const allNeededCourseIds = Array.from(new Set([...approvedMissingCourseIds, ...pendingCourseIds]))

    const [neededBatchesRes, neededCoursesRes] = await Promise.all([
      allNeededBatchIds.length > 0
        ? admin.from("batches").select("*, teacher:staff(name, subject), room:rooms(name)").in("id", allNeededBatchIds)
        : Promise.resolve({ data: [] }),
      allNeededCourseIds.length > 0
        ? admin.from("courses").select("*, teacher:staff(name, subject)").in("id", allNeededCourseIds)
        : Promise.resolve({ data: [] }),
    ])

    const batchMap = new Map<string, any>()
    neededBatchesRes.data?.forEach((b: any) => batchMap.set(b.id, b))

    const courseInfoMap = new Map<string, any>()
    neededCoursesRes.data?.forEach((c: any) => courseInfoMap.set(c.id, c))

    // Process approved submissions
    for (const sub of allSubmissions) {
      if (sub.status === "approved" && sub.batch_id && !enrolledBatchIds.has(sub.batch_id)) {
        const batchData = batchMap.get(sub.batch_id)
        if (batchData) {
          enrolledBatchIds.add(sub.batch_id)
          enrollments.push({
            id: "synth-" + sub.id,
            student_id: targetStudentId || sub.student_id,
            batch_id: sub.batch_id,
            status: "active",
            enrollment_date: (sub.approved_at || sub.created_at || new Date().toISOString()).slice(0, 10),
            created_at: sub.approved_at || sub.created_at || new Date().toISOString(),
            batch: batchData,
          })

          const finalStudentId = targetStudentId || sub.student_id
          if (finalStudentId) {
            // Background upsert (non-blocking)
            admin.from("enrollments").upsert({
              student_id: finalStudentId,
              batch_id: sub.batch_id,
              status: "active",
            }, { onConflict: "student_id,batch_id" }).then()
          }
        }
      }

      if (sub.status === "approved" && sub.course_id && !courseMap.has(sub.course_id)) {
        const courseInfo = courseInfoMap.get(sub.course_id)
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

          const finalStudentId = targetStudentId || sub.student_id
          if (finalStudentId) {
            // Background insert (non-blocking)
            admin.from("course_purchases").insert({
              course_id: sub.course_id,
              student_id: finalStudentId,
              buyer_name: currentProfile.name || "Student",
              buyer_phone: currentProfile.phone || sub.sender_number || null,
              buyer_email: currentProfile.email || null,
              amount_paid: sub.amount,
              payment_method: sub.payment_method || "online",
              transaction_id: sub.transaction_id || sub.trx_id,
            }).then()
          }
        }
      }
    }

    const enrichedPendingSubmissions = pendingSubs.map(s => ({
      ...s,
      batch: s.batch_id ? batchMap.get(s.batch_id) || null : null,
      course: s.course_id ? courseInfoMap.get(s.course_id) || null : null,
    }))

    const purchasedCourses = Array.from(courseMap.values())

    const enrichedMaterials = batchMaterials.map((m: any) => {
      if (m.course_id && !m.course) {
        return { ...m, course: courseInfoMap.get(m.course_id) || null }
      }
      return m
    })

    // Deduplicate materials by ID and content signature, preserving received status
    const dedupedMaterials: any[] = []

    for (const m of enrichedMaterials) {
      const mId = String(m.id || "")
      const sig = `${String(m.name || "").trim().toLowerCase()}::${String(m.type || "").trim()}::${String(m.subject || "").trim().toLowerCase()}`

      const existingIdx = dedupedMaterials.findIndex(d => {
        const dId = String(d.id || "")
        const dSig = `${String(d.name || "").trim().toLowerCase()}::${String(d.type || "").trim()}::${String(d.subject || "").trim().toLowerCase()}`
        return (mId && dId && mId === dId) || (sig !== "::::" && dSig !== "::::" && sig === dSig)
      })

      if (existingIdx >= 0) {
        if (m.is_received && !dedupedMaterials[existingIdx].is_received) {
          dedupedMaterials[existingIdx] = m
        }
      } else {
        dedupedMaterials.push(m)
      }
    }

    return NextResponse.json({
      success: true,
      profile: currentProfile,
      student: primaryStudent,
      allStudentIds: cleanIssueStudentUuids,
      enrollments,
      courses: purchasedCourses,
      pendingSubmissions: enrichedPendingSubmissions,
      attendance,
      dues,
      examResults,
      batchExams,
      materials: dedupedMaterials,
      materialIssues,
      paymentAccounts,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  } catch (error: any) {
    console.error("Student profile API exception:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load profile data" },
      { status: 500 }
    )
  }
}
