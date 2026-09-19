import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffRole, isAuthError } from "@/lib/api-auth"
import { generateStudentQrCode } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Cybersecurity Defense: Sanitize cell content against CSV Formula Injection (CWE-1236)
 * If a cell begins with =, +, -, @, \t, or \r, prepend an apostrophe (') so Excel / Calc
 * treats it strictly as literal text, preventing malicious arbitrary command execution.
 */
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return ""
  let str = String(value).trim()

  // Prevent CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }

  // Wrap in double quotes and escape internal quotes if needed
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Build UTF-8 CSV string with BOM (\uFEFF) for native Excel Bengali/Unicode support
 */
function buildCsvString(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",")
  const bodyLines = rows.map((row) => row.map(sanitizeCsvCell).join(","))
  return "\uFEFF" + [headerLine, ...bodyLines].join("\r\n")
}

export async function GET(req: NextRequest) {
  // 1. Verify Role Authorization: Only authorized administrative roles can export data
  const auth = await requireStaffRole(["owner", "super_manager", "manager", "reception"])
  if (isAuthError(auth)) return auth

  const userRole = (auth as any)?.user?.role || "owner"

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || "students"
    const branchFilter = searchParams.get("branch_id")
    const batchFilter = searchParams.get("batch_id")

    const admin = createAdminClient()
    const todayStr = new Date().toISOString().split("T")[0]

    // -------------------------------------------------------------
    // BUILD STUDENTS & ENROLLMENTS CSV
    // -------------------------------------------------------------
    const generateStudentsCsv = async () => {
      let query = admin
        .from("students")
        .select(`
          *,
          branch:branches(id, name),
          enrollments(
            id,
            roll_no,
            status,
            enrollment_date,
            batch:batches(
              id,
              name,
              subject,
              class_level,
              monthly_fee,
              branch:branches(id, name)
            )
          ),
          fee_dues(
            id,
            batch_id,
            due_month,
            due_amount,
            paid_amount,
            due_date,
            status
          )
        `)
        .order("created_at", { ascending: true })

      if (branchFilter && branchFilter !== "all") {
        query = query.eq("branch_id", branchFilter)
      }

      let rawStudents: any[] = []
      const { data: primaryData, error: sErr } = await query
      if (sErr) {
        console.warn("Primary student export query error, falling back to schema-safe query:", sErr.message)
        // Schema-safe fallback query without explicit optional fields
        let fallbackQuery = admin
          .from("students")
          .select(`
            *,
            branch:branches(id, name),
            enrollments(
              id,
              status,
              enrollment_date,
              batch:batches(
                id,
                name,
                subject,
                class_level,
                monthly_fee,
                branch:branches(id, name)
              )
            ),
            fee_dues(
              id,
              due_month,
              due_amount,
              paid_amount,
              due_date,
              status
            )
          `)
          .order("created_at", { ascending: true })

        if (branchFilter && branchFilter !== "all") {
          fallbackQuery = fallbackQuery.eq("branch_id", branchFilter)
        }

        const { data: fbData, error: fbErr } = await fallbackQuery
        if (fbErr) {
          console.warn("Fallback query failed, using direct students query:", fbErr.message)
          let simpleQuery = admin.from("students").select("*, branch:branches(name)")
          if (branchFilter && branchFilter !== "all") {
            simpleQuery = simpleQuery.eq("branch_id", branchFilter)
          }
          const { data: simpleData, error: simpleErr } = await simpleQuery
          if (simpleErr) throw new Error(simpleErr.message)
          rawStudents = simpleData || []
        } else {
          rawStudents = fbData || []
        }
      } else {
        rawStudents = primaryData || []
      }

      const headers = [
        "Student ID",
        "Full Name",
        "Guardian Phone",
        "Student Phone",
        "Guardian Name",
        "Guardian Relation",
        "Due Amount",
        "Due Date",
        "Batch Name",
        "Batch Roll",
        "Class Level",
        "Subject",
        "Branch Name",
        "Gender",
        "Date of Birth",
        "School / College",
        "Address",
        "Email",
        "Monthly Fee",
        "Enrollment Date",
        "Enrollment Status",
        "QR Code",
        "Student Status"
      ]

      const rows: any[][] = []

      for (const s of rawStudents || []) {
        const studentEnrollments = (s.enrollments || []).filter((e: any) => {
          if (!batchFilter || batchFilter === "all") return true
          return e.batch?.id === batchFilter
        })

        // Calculate dues
        const activeDues = (s.fee_dues || []).filter(
          (d: any) => d.status === "pending" || d.status === "partial"
        )
        const totalDue = activeDues.reduce(
          (sum: number, d: any) =>
            sum + Math.max(0, (Number(d.due_amount) || 0) - (Number(d.paid_amount) || 0)),
          0
        )
        const earliestDueDate = activeDues.map((d: any) => d.due_date).filter(Boolean).sort()[0] || ""

        if (studentEnrollments.length > 0) {
          for (const enr of studentEnrollments) {
            const batchObj = enr.batch || {}
            const enrBranchName = batchObj.branch?.name || s.branch?.name || ""
            const effectiveRoll = enr.roll_no ?? s.roll_no ?? s.batch_roll ?? ""
            const effectiveQr = s.qr_code || (enr as any).qr_code || generateStudentQrCode({
              studentId: s.student_id,
              admissionDate: enr.enrollment_date || s.enrollment_date || s.created_at,
              rollNo: effectiveRoll,
              studentUuid: s.id,
            })

            rows.push([
              s.student_id || "",
              s.name || "",
              s.guardian_phone || "",
              s.phone || "",
              s.guardian_name || "",
              s.guardian_relation || "Parent",
              totalDue,
              earliestDueDate,
              batchObj.name || "",
              effectiveRoll,
              s.class_level || batchObj.class_level || "",
              batchObj.subject || "",
              enrBranchName,
              s.gender || "male",
              s.date_of_birth || "",
              s.school_college || "",
              s.address || "",
              s.email || "",
              batchObj.monthly_fee || 0,
              enr.enrollment_date || s.enrollment_date || todayStr,
              enr.status || "active",
              effectiveQr,
              s.is_active ? "Active" : "Inactive"
            ])
          }
        } else {
          // Student without enrollments
          const studentRoll = s.roll_no || s.batch_roll || ""
          const studentQr = s.qr_code || generateStudentQrCode({
            studentId: s.student_id,
            admissionDate: s.enrollment_date || s.created_at,
            rollNo: studentRoll,
            studentUuid: s.id,
          })

          rows.push([
            s.student_id || "",
            s.name || "",
            s.guardian_phone || "",
            s.phone || "",
            s.guardian_name || "",
            s.guardian_relation || "Parent",
            totalDue,
            earliestDueDate,
            "", // Batch Name
            studentRoll,
            s.class_level || "",
            "", // Subject
            s.branch?.name || "",
            s.gender || "male",
            s.date_of_birth || "",
            s.school_college || "",
            s.address || "",
            s.email || "",
            0,
            s.enrollment_date || todayStr,
            "not_enrolled",
            studentQr,
            s.is_active ? "Active" : "Inactive"
          ])
        }
      }

      return buildCsvString(headers, rows)
    }

    // -------------------------------------------------------------
    // BUILD BATCHES CSV
    // -------------------------------------------------------------
    const generateBatchesCsv = async () => {
      let bQuery = admin
        .from("batches")
        .select("*, branch:branches(id, name)")
        .order("name")

      if (branchFilter && branchFilter !== "all") {
        bQuery = bQuery.eq("branch_id", branchFilter)
      }

      const { data: batches, error: bErr } = await bQuery
      if (bErr) throw new Error(bErr.message)

      const headers = [
        "Batch ID",
        "Batch Name",
        "Subject",
        "Class Level",
        "Branch Name",
        "Monthly Fee",
        "Admission Fee",
        "Fee Type",
        "Classroom",
        "Current Seats",
        "Max Seats",
        "Status",
        "Is Active",
        "Created At"
      ]

      const rows = (batches || []).map((b) => [
        b.id,
        b.name || "",
        b.subject || "",
        b.class_level || "",
        b.branch?.name || "",
        b.monthly_fee || 0,
        b.admission_fee || 0,
        b.fee_type || "monthly",
        b.classroom || "",
        b.current_seats || 0,
        b.max_seats || 50,
        b.status || "active",
        b.is_active ? "Yes" : "No",
        b.created_at || ""
      ])

      return buildCsvString(headers, rows)
    }

    // -------------------------------------------------------------
    // BUILD BRANCHES CSV
    // -------------------------------------------------------------
    const generateBranchesCsv = async () => {
      const { data: branches, error: brErr } = await admin
        .from("branches")
        .select("*")
        .order("name")
      if (brErr) throw new Error(brErr.message)

      const headers = [
        "Branch ID",
        "Branch Name",
        "Address",
        "Location",
        "Phone",
        "Email",
        "Branch Director",
        "Director Phone",
        "Manager",
        "Manager Phone",
        "Established Year",
        "Is Active",
        "Created At"
      ]

      const rows = (branches || []).map((br) => [
        br.id,
        br.name || "",
        br.address || "",
        br.location || "",
        br.phone || "",
        br.email || "",
        br.branch_director || "",
        br.director_phone || "",
        br.manager || "",
        br.manager_phone || "",
        br.established_year || "",
        br.is_active ? "Yes" : "No",
        br.created_at || ""
      ])

      return buildCsvString(headers, rows)
    }

    // -------------------------------------------------------------
    // BUILD STAFF CSV (Strict Data Security: NEVER export passwords/tokens)
    // -------------------------------------------------------------
    const generateStaffCsv = async () => {
      // Reception is restricted from exporting full staff payroll
      if (userRole === "receptionist" || userRole === "reception") {
        throw new Error("Access denied: Only managers and owners can export staff records.")
      }

      let stQuery = admin
        .from("staff")
        .select("*, branch:branches(name)")
        .order("name")

      if (branchFilter && branchFilter !== "all") {
        stQuery = stQuery.eq("branch_id", branchFilter)
      }

      const { data: staffList, error: stErr } = await stQuery
      if (stErr) throw new Error(stErr.message)

      const headers = [
        "Staff ID",
        "Full Name",
        "Email",
        "Phone",
        "Role",
        "Branch Name",
        "Salary",
        "Commission Rate",
        "Subject",
        "Is Active",
        "Joined Date",
        "Created At"
      ]

      const rows = (staffList || []).map((st) => [
        st.id,
        st.name || "",
        st.email || "",
        st.phone || "",
        st.role || "",
        (st as any).branch?.name || "",
        st.salary || 0,
        st.commission_rate || 0,
        st.subject || "",
        st.is_active ? "Active" : "Inactive",
        st.joined_at || "",
        st.created_at || ""
      ])

      return buildCsvString(headers, rows)
    }

    // -------------------------------------------------------------
    // RETURN REQUESTED FORMAT
    // -------------------------------------------------------------
    if (type === "all") {
      const [studentsCsv, batchesCsv, branchesCsv] = await Promise.all([
        generateStudentsCsv(),
        generateBatchesCsv(),
        generateBranchesCsv(),
      ])

      let staffCsv = ""
      if (userRole === "owner" || userRole === "super_manager" || userRole === "manager") {
        try {
          staffCsv = await generateStaffCsv()
        } catch {}
      }

      return NextResponse.json({
        success: true,
        exported_at: new Date().toISOString(),
        files: {
          students: {
            filename: `medhashiree_students_${todayStr}.csv`,
            content: studentsCsv
          },
          batches: {
            filename: `medhashiree_batches_${todayStr}.csv`,
            content: batchesCsv
          },
          branches: {
            filename: `medhashiree_branches_${todayStr}.csv`,
            content: branchesCsv
          },
          ...(staffCsv ? {
            staff: {
              filename: `medhashiree_staff_${todayStr}.csv`,
              content: staffCsv
            }
          } : {})
        }
      })
    }

    let csvContent = ""
    let filename = `medhashiree_export_${todayStr}.csv`

    if (type === "batches") {
      csvContent = await generateBatchesCsv()
      filename = `medhashiree_batches_${todayStr}.csv`
    } else if (type === "branches") {
      csvContent = await generateBranchesCsv()
      filename = `medhashiree_branches_${todayStr}.csv`
    } else if (type === "staff") {
      csvContent = await generateStaffCsv()
      filename = `medhashiree_staff_${todayStr}.csv`
    } else {
      // Default to students
      csvContent = await generateStudentsCsv()
      filename = `medhashiree_students_${todayStr}.csv`
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0"
      }
    })
  } catch (err: any) {
    console.error("CSV Export API Error:", err)
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate CSV export" },
      { status: 500 }
    )
  }
}
