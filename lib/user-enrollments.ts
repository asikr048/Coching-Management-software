import { createClient } from "@/lib/supabase/client"

export interface UserEnrollmentsState {
  enrolledBatchIds: Set<string>
  pendingBatchIds: Set<string>
  enrolledCourseIds: Set<string>
  pendingCourseIds: Set<string>
  isStaff: boolean
  user: any | null
}

const EMPTY_STATE: UserEnrollmentsState = {
  enrolledBatchIds: new Set<string>(),
  pendingBatchIds: new Set<string>(),
  enrolledCourseIds: new Set<string>(),
  pendingCourseIds: new Set<string>(),
  isStaff: false,
  user: null,
}

export function getCachedUserEnrollments(): UserEnrollmentsState {
  if (typeof window === "undefined") return EMPTY_STATE
  try {
    const raw = sessionStorage.getItem("ms_user_enrollments_cache")
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw)
    // 5 min cache validity
    if (Date.now() - (parsed.timestamp || 0) > 5 * 60 * 1000) return EMPTY_STATE
    return {
      enrolledBatchIds: new Set<string>(parsed.enrolledBatchIds || []),
      pendingBatchIds: new Set<string>(parsed.pendingBatchIds || []),
      enrolledCourseIds: new Set<string>(parsed.enrolledCourseIds || []),
      pendingCourseIds: new Set<string>(parsed.pendingCourseIds || []),
      isStaff: false,
      user: { id: parsed.userId },
    }
  } catch {
    return EMPTY_STATE
  }
}

export async function getUserEnrollments(): Promise<UserEnrollmentsState> {
  if (typeof window === "undefined") return EMPTY_STATE

  const supabase = createClient()
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      try {
        sessionStorage.removeItem("ms_user_enrollments_cache")
      } catch {}
      return EMPTY_STATE
    }

    // Check if staff
    const { data: staff } = await supabase
      .from("staff")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (staff) {
      return {
        ...EMPTY_STATE,
        isStaff: true,
        user,
      }
    }

    // 1. Fetch from /api/student/profile (has full admin multi-candidate identity resolution)
    try {
      const res = await fetch("/api/student/profile", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const enrolledBatchIds = new Set<string>()
        const pendingBatchIds = new Set<string>()
        const enrolledCourseIds = new Set<string>()
        const pendingCourseIds = new Set<string>()

        if (Array.isArray(data.enrollments)) {
          data.enrollments.forEach((e: any) => {
            if (e.status === "active") {
              if (e.batch_id) enrolledBatchIds.add(String(e.batch_id))
              if (e.batch?.id) enrolledBatchIds.add(String(e.batch.id))
            }
          })
        }

        if (Array.isArray(data.courses)) {
          data.courses.forEach((c: any) => {
            if (c.id) enrolledCourseIds.add(String(c.id))
            if (c.course_id) enrolledCourseIds.add(String(c.course_id))
          })
        }

        if (Array.isArray(data.pendingSubmissions)) {
          data.pendingSubmissions.forEach((s: any) => {
            if (s.status === "pending") {
              if (s.batch_id) pendingBatchIds.add(String(s.batch_id))
              if (s.course_id) pendingCourseIds.add(String(s.course_id))
            }
          })
        }

        const state: UserEnrollmentsState = {
          enrolledBatchIds,
          pendingBatchIds,
          enrolledCourseIds,
          pendingCourseIds,
          isStaff: false,
          user,
        }

        try {
          sessionStorage.setItem(
            "ms_user_enrollments_cache",
            JSON.stringify({
              userId: user.id,
              enrolledBatchIds: Array.from(enrolledBatchIds),
              pendingBatchIds: Array.from(pendingBatchIds),
              enrolledCourseIds: Array.from(enrolledCourseIds),
              pendingCourseIds: Array.from(pendingCourseIds),
              timestamp: Date.now(),
            })
          )
        } catch {}

        return state
      }
    } catch (apiErr) {
      console.warn("Could not load /api/student/profile, falling back to direct queries:", apiErr)
    }

    // 2. Direct Supabase query fallback
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .or(`auth_user_id.eq.${user.id},email.eq.${user.email || ""},student_id.eq.${user.user_metadata?.user_id || ""}`)
      .maybeSingle()

    if (student) {
      const [enrRes, cpRes, psRes] = await Promise.all([
        supabase.from("enrollments").select("batch_id, status").eq("student_id", student.id).eq("status", "active"),
        supabase.from("course_purchases").select("course_id").eq("student_id", student.id),
        supabase.from("payment_submissions").select("batch_id, course_id, status").eq("student_id", student.id).eq("status", "pending"),
      ])

      const enrolledBatchIds = new Set<string>((enrRes.data || []).map((e: any) => String(e.batch_id)))
      const enrolledCourseIds = new Set<string>((cpRes.data || []).map((c: any) => String(c.course_id)))
      const pendingBatchIds = new Set<string>((psRes.data || []).filter((p: any) => p.batch_id).map((p: any) => String(p.batch_id)))
      const pendingCourseIds = new Set<string>((psRes.data || []).filter((p: any) => p.course_id).map((p: any) => String(p.course_id)))

      return {
        enrolledBatchIds,
        pendingBatchIds,
        enrolledCourseIds,
        pendingCourseIds,
        isStaff: false,
        user,
      }
    }
  } catch (err) {
    console.warn("Error getting user enrollments:", err)
  }

  return EMPTY_STATE
}
