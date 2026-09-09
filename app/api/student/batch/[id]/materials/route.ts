import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const batchId = resolvedParams.id
    if (!batchId) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch batch information (or course information if ID is a course)
    const { data: bData } = await admin
      .from("batches")
      .select("id, name, subject, branch_id")
      .eq("id", batchId)
      .maybeSingle()

    let batchData = bData
    let courseData: any = null
    if (!batchData) {
      const { data: cData } = await admin
        .from("courses")
        .select("id, title, category, branch_id")
        .eq("id", batchId)
        .maybeSingle()
      courseData = cData
    }

    const batchName = batchData?.name || courseData?.title || ""
    const batchNameLower = batchName.trim().toLowerCase()
    const branchId = batchData?.branch_id || courseData?.branch_id || null

    // 2. Fetch all materials
    const { data: allMats, error: matErr } = await admin
      .from("materials")
      .select("*")
      .order("created_at", { ascending: false })

    if (matErr) {
      console.error("Error fetching materials for batch:", matErr)
      return NextResponse.json({ error: matErr.message }, { status: 500 })
    }

    const candidateMaterials = allMats || []
    const bIdStr = String(batchId)

    // Filter materials for this batch or course
    const batchMaterials = candidateMaterials.filter((m: any) => {
      if (!m) return false

      // Direct single batch match
      if (m.batch_id && String(m.batch_id) === bIdStr) return true

      // Multi batch match via batch_ids (JSONB or array or string)
      if (m.batch_ids) {
        if (Array.isArray(m.batch_ids)) {
          if (m.batch_ids.some((bid: any) => String(bid) === bIdStr)) return true
        } else if (typeof m.batch_ids === "string") {
          try {
            const parsed = JSON.parse(m.batch_ids)
            if (Array.isArray(parsed) && parsed.some((bid: any) => String(bid) === bIdStr)) return true
          } catch {
            if (m.batch_ids.includes(bIdStr)) return true
          }
        }
      }

      // Direct Course Match
      if (m.course_id && (String(m.course_id) === bIdStr || (courseData && String(m.course_id) === String(courseData.id)))) return true

      // Course Title Match
      if (courseData?.title) {
        const cTitleLower = courseData.title.trim().toLowerCase()
        if (m.subject && String(m.subject).trim().toLowerCase() === cTitleLower) return true
        if (m.name && String(m.name).trim().toLowerCase().includes(cTitleLower)) return true
      }

      // Batch Name Match (e.g. "Asik")
      if (batchNameLower) {
        if (m.batch_name && String(m.batch_name).trim().toLowerCase() === batchNameLower) return true
        if (m.subject && String(m.subject).trim().toLowerCase() === batchNameLower) return true
        if (Array.isArray(m.batch_names) && m.batch_names.some((bn: any) => String(bn).trim().toLowerCase() === batchNameLower)) return true
      }

      // Material with no specific batch or course (general material for branch or coaching)
      const hasNoTarget = (!m.batch_id || m.batch_id === "" || m.batch_id === "all") &&
        (!m.batch_ids || (Array.isArray(m.batch_ids) && m.batch_ids.length === 0) || m.batch_ids === "[]") &&
        !m.course_id

      if (hasNoTarget) {
        if (m.branch_id && branchId) {
          return String(m.branch_id) === String(branchId)
        }
        return true
      }

      return false
    })

    // 3. Resolve student identity to check distribution records (material_issues)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const candidateStudentUuids = new Set<string>()
    const candidateCodes = new Set<string>()
    const candidateEmails = new Set<string>()
    const candidatePhones = new Set<string>()
    const studentNames = new Set<string>()

    // Accept student_id, code, email, phone, and name directly from query parameters if provided
    const paramStudentId = req.nextUrl.searchParams.get("student_id")
    const paramCode = req.nextUrl.searchParams.get("code")
    const paramEmail = req.nextUrl.searchParams.get("email")
    const paramPhone = req.nextUrl.searchParams.get("phone")
    const paramName = req.nextUrl.searchParams.get("name")

    if (paramStudentId) {
      const s = paramStudentId.trim()
      if (uuidRegex.test(s)) candidateStudentUuids.add(s)
      else candidateCodes.add(s)
    }
    if (paramCode) candidateCodes.add(paramCode.trim())
    if (paramEmail) candidateEmails.add(paramEmail.trim().toLowerCase())
    if (paramPhone) candidatePhones.add(paramPhone.trim())
    if (paramName) studentNames.add(paramName.trim().toLowerCase())

    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        if (user.email) candidateEmails.add(user.email.trim().toLowerCase())
        if (user.user_metadata?.phone) candidatePhones.add(String(user.user_metadata.phone).trim())
        if (user.user_metadata?.user_id) candidateCodes.add(String(user.user_metadata.user_id).trim())
        if (user.user_metadata?.full_name) studentNames.add(String(user.user_metadata.full_name).trim().toLowerCase())

        const { data: up } = await admin.from("user_profiles").select("user_id, email, phone, name").eq("auth_user_id", user.id).maybeSingle()
        if (up?.user_id) candidateCodes.add(String(up.user_id).trim())
        if (up?.email) candidateEmails.add(String(up.email).trim().toLowerCase())
        if (up?.phone) candidatePhones.add(String(up.phone).trim())
        if (up?.name) studentNames.add(String(up.name).trim().toLowerCase())

        // Directly query students by auth_user_id
        const { data: authStudents } = await admin.from("students").select("id, student_id, email, phone, name, batch_id").eq("auth_user_id", user.id)
        if (authStudents) {
          authStudents.forEach((s: any) => {
            if (s.id && uuidRegex.test(s.id)) candidateStudentUuids.add(s.id)
            if (s.student_id) candidateCodes.add(s.student_id.trim())
            if (s.phone) candidatePhones.add(s.phone.trim())
            if (s.email) candidateEmails.add(s.email.trim().toLowerCase())
            if (s.name) studentNames.add(s.name.trim().toLowerCase())
          })
        }
      }
    } catch {}

    // Find all student records in database matching any candidate identifier
    const lookupQueries: any[] = []
    if (candidateStudentUuids.size > 0) {
      lookupQueries.push(
        admin.from("students").select("id, student_id, email, phone, name, auth_user_id, batch_id").in("id", Array.from(candidateStudentUuids))
      )
    }
    if (candidateCodes.size > 0) {
      lookupQueries.push(
        admin.from("students").select("id, student_id, email, phone, name, auth_user_id, batch_id").in("student_id", Array.from(candidateCodes))
      )
    }
    if (candidateEmails.size > 0) {
      const emailList = Array.from(candidateEmails)
      lookupQueries.push(
        admin.from("students").select("id, student_id, email, phone, name, auth_user_id, batch_id").or(emailList.map(e => `email.ilike.${e}`).join(","))
      )
    }
    if (candidatePhones.size > 0) {
      lookupQueries.push(
        admin.from("students").select("id, student_id, email, phone, name, auth_user_id, batch_id").in("phone", Array.from(candidatePhones))
      )
    }

    try {
      if (lookupQueries.length > 0) {
        const results = await Promise.all(lookupQueries)
        for (const res of results) {
          if (res.data) {
            for (const s of res.data) {
              if (s.id && uuidRegex.test(s.id)) candidateStudentUuids.add(s.id)
              if (s.student_id) candidateCodes.add(s.student_id.trim())
              if (s.email) candidateEmails.add(s.email.toLowerCase())
              if (s.phone) candidatePhones.add(s.phone)
              if (s.name) studentNames.add(s.name.trim().toLowerCase())
            }
          }
        }
      }

      // Find all students in this batch matching candidate phone, email, or name
      if (batchId) {
        const { data: batchStudents } = await admin
          .from("students")
          .select("id, name, student_id, phone, email")
          .eq("batch_id", batchId)

        if (batchStudents) {
          for (const bs of batchStudents) {
            const bsName = String(bs.name || "").trim().toLowerCase()
            const bsPhone = String(bs.phone || "").trim()
            const bsEmail = String(bs.email || "").trim().toLowerCase()
            const bsCode = String(bs.student_id || "").trim()

            const isMatch = (bsName && studentNames.has(bsName)) ||
              (bsPhone && candidatePhones.has(bsPhone)) ||
              (bsEmail && candidateEmails.has(bsEmail)) ||
              (bsCode && candidateCodes.has(bsCode))

            if (isMatch && bs.id && uuidRegex.test(bs.id)) {
              candidateStudentUuids.add(bs.id)
              if (bs.student_id) candidateCodes.add(bs.student_id)
              if (bs.phone) candidatePhones.add(bs.phone)
              if (bs.name) studentNames.add(bsName)
            }
          }
        }
      }
    } catch {}

    // Strictly ensure only valid UUIDs are ever queried against material_issues.student_id
    const cleanStudentUuids = Array.from(candidateStudentUuids).filter(id => uuidRegex.test(id))

    let studentIssues: any[] = []
    const seenIssueIds = new Set<string>()

    // 1. Load direct issues for verified student UUIDs
    if (cleanStudentUuids.length > 0) {
      const { data: issueData, error: issErr } = await admin
        .from("material_issues")
        .select("*, material:materials(*)")
        .in("student_id", cleanStudentUuids)

      if (issErr) {
        console.warn("material_issues query warning in batch materials route:", issErr)
      }
      if (issueData) {
        issueData.forEach(iss => {
          studentIssues.push(iss)
          seenIssueIds.add(iss.id)
        })
      }
    }

    // 2. Also load all issues for this batch and match by student name / phone / code
    if (batchId) {
      try {
        const { data: batchIssues } = await admin
          .from("material_issues")
          .select("*, material:materials(*), student:students(id, name, student_id, phone, email)")
          .eq("batch_id", batchId)
          .eq("status", "issued")

        if (batchIssues) {
          for (const bi of batchIssues) {
            if (seenIssueIds.has(bi.id)) continue

            const st = bi.student || {}
            const stId = st.id || bi.student_id
            const stCode = (st.student_id || "").trim().toLowerCase()
            const stPhone = (st.phone || "").trim()
            const stEmail = (st.email || "").trim().toLowerCase()
            const stName = (st.name || "").trim().toLowerCase()

            let isMatch = false
            if (stId && cleanStudentUuids.includes(stId)) isMatch = true
            if (stCode && candidateCodes.has(stCode)) isMatch = true
            if (stPhone && candidatePhones.has(stPhone)) isMatch = true
            if (stEmail && candidateEmails.has(stEmail)) isMatch = true
            if (stName && (studentNames.has(stName) || (paramName && stName === paramName.trim().toLowerCase()))) isMatch = true

            if (isMatch) {
              studentIssues.push(bi)
              seenIssueIds.add(bi.id)
            }
          }
        }
      } catch (bErr) {
        console.warn("Batch material_issues fetch note:", bErr)
      }
    }

    const isIssueMatchingMat = (iss: any, mat: any) => {
      if (!iss || !mat) return false
      if (iss.material_id && String(iss.material_id) === String(mat.id)) return true
      const issName = String(iss.material?.name || iss.material_name || iss.name || "").trim().toLowerCase()
      const matName = String(mat.name || "").trim().toLowerCase()
      if (issName && matName && issName === matName) return true
      return false
    }

    const combinedMaterials = batchMaterials.map((mat: any) => {
      const iss = studentIssues.find((i: any) => isIssueMatchingMat(i, mat))
      return {
        id: mat.id,
        material: mat,
        is_received: !!iss && iss.status !== "returned",
        is_returned: !!iss?.returned_at || iss?.status === "returned",
        issue_record: iss || null,
        issued_at: iss?.issued_at || null,
        return_due_date: iss?.return_due_date || null,
        returned_at: iss?.returned_at || null,
      }
    })

    // Also include any materials that the student was directly issued for this batch
    const seenMatIds = new Set(batchMaterials.map((m: any) => String(m.id)))
    studentIssues.forEach((iss: any) => {
      if (iss.material_id && !seenMatIds.has(String(iss.material_id))) {
        const mat = iss.material
        const isThisBatch = iss.batch_id === batchId ||
          mat?.batch_id === batchId ||
          mat?.course_id === batchId ||
          (Array.isArray(mat?.batch_ids) && mat.batch_ids.includes(batchId))

        if (isThisBatch && mat) {
          seenMatIds.add(String(iss.material_id))
          combinedMaterials.push({
            id: mat.id,
            material: mat,
            is_received: iss.status !== "returned",
            is_returned: !!iss.returned_at || iss.status === "returned",
            issue_record: iss,
            issued_at: iss.issued_at,
            return_due_date: iss.return_due_date,
            returned_at: iss.returned_at,
          })
        }
      }
    })

    // Deduplicate materials by ID and by signature (name + type + subject), preserving received status
    const dedupedMaterials: any[] = []

    for (const item of combinedMaterials) {
      const mat = item.material || item
      const mId = String(mat.id || item.id || "")
      const sig = `${String(mat.name || "").trim().toLowerCase()}::${String(mat.type || "").trim()}::${String(mat.subject || "").trim().toLowerCase()}`

      const existingIdx = dedupedMaterials.findIndex(d => {
        const dMat = d.material || d
        const dId = String(dMat.id || d.id || "")
        const dSig = `${String(dMat.name || "").trim().toLowerCase()}::${String(dMat.type || "").trim()}::${String(dMat.subject || "").trim().toLowerCase()}`
        return (mId && dId && mId === dId) || (sig !== "::::" && dSig !== "::::" && sig === dSig)
      })

      if (existingIdx >= 0) {
        if (item.is_received && !dedupedMaterials[existingIdx].is_received) {
          dedupedMaterials[existingIdx] = item
        }
      } else {
        dedupedMaterials.push(item)
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      batch_name: batchName,
      materials: dedupedMaterials,
      total_count: dedupedMaterials.length,
      received_count: dedupedMaterials.filter(m => m.is_received).length,
      pending_count: dedupedMaterials.filter(m => !m.is_received).length,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  } catch (err: any) {
    console.error("Error in /api/student/batch/[id]/materials:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
