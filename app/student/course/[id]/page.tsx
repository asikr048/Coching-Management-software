"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  ArrowLeft, BookOpen, PlayCircle, CheckCircle2, CheckCircle, Clock,
  User, Award, Star, FileText, Video, Sparkles, AlertCircle,
  Loader2, Check, ExternalLink, ShieldCheck, Package
} from "lucide-react"

export default function StudentCoursePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState<any>(null)
  const [contents, setContents] = useState<any[]>([])
  const [activeLesson, setActiveLesson] = useState<any>(null)
  const [purchaseInfo, setPurchaseInfo] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [materialIssues, setMaterialIssues] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadCourseData() {
      try {
        setLoading(true)
        setError(null)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        // Fetch course profile via dedicated student API
        const profileRes = await fetch("/api/student/profile", { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
        if (!profileRes.ok) {
          throw new Error("Failed to verify course enrollment")
        }

        const profileData = await profileRes.json()
        const userCourses = profileData.courses || []
        const found = userCourses.find((c: any) => c.course_id === courseId || c.course?.id === courseId)

        if (!found) {
          setError("You do not have active access to this course. Please purchase or verify payment approval.")
          setLoading(false)
          return
        }

        if (Array.isArray(profileData.materials)) {
          setMaterials(profileData.materials)
        } else {
          try {
            const { data: dbMats } = await supabase
              .from("materials")
              .select("*")
              .order("created_at", { ascending: false })
            if (dbMats) {
              const seenIds = new Set<string>()
              const seenSigs = new Set<string>()
              const deduped: any[] = []
              for (const m of dbMats) {
                const idStr = String(m.id || "")
                const sig = `${(m.name || "").trim().toLowerCase()}::${(m.type || "").trim().toLowerCase()}::${(m.subject || "").trim().toLowerCase()}`
                if (idStr && seenIds.has(idStr)) continue
                if (sig !== "::::" && seenSigs.has(sig)) continue
                if (idStr) seenIds.add(idStr)
                if (sig !== "::::") seenSigs.add(sig)
                deduped.push(m)
              }
              setMaterials(deduped)
            }
          } catch (mErr) {
            console.warn("Course direct materials fetch note:", mErr)
          }
        }

        let currentCourseIssues: any[] = Array.isArray(profileData.materialIssues) ? [...profileData.materialIssues] : []

        // Merge local issues from localStorage
        try {
          const rawLocal = localStorage.getItem("medhashiree_material_issues")
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal)
            if (Array.isArray(parsed)) {
              const studentCandidates = [
                profileData.student?.id,
                profileData.student?.student_id,
                profileData.profile?.user_id,
                profileData.profile?.email,
              ].filter(Boolean).map(x => String(x).toLowerCase())

              parsed.forEach((li: any) => {
                if (li.status === "returned") return
                const liSid = String(li.student_id || "").toLowerCase()
                const liCode = String(li.student?.student_id || "").toLowerCase()
                if (studentCandidates.includes(liSid) || studentCandidates.includes(liCode)) {
                  currentCourseIssues.push(li)
                }
              })
            }
          }
        } catch {}

        if (currentCourseIssues.length === 0) {
          try {
            const { data: dbIssues } = await supabase.from("material_issues").select("*")
            if (dbIssues) currentCourseIssues = dbIssues
          } catch {}
        }

        setMaterialIssues(currentCourseIssues)

        // Helper to match issue with material by both ID and Name
        const isIssueMatch = (iss: any, mat: any) => {
          if (!iss || !mat) return false
          const matId = String(mat.id || "").trim()
          if (iss.material_id && matId && String(iss.material_id).trim() === matId) return true
          const issMatName = String(iss.material?.name || iss.material_name || iss.name || "").trim().toLowerCase()
          const targetName = String(mat.name || "").trim().toLowerCase()
          if (issMatName && targetName && issMatName === targetName) return true
          return false
        }

        // Enrich course materials with received status
        setMaterials((prevMats) =>
          prevMats.map((m: any) => {
            const matched = currentCourseIssues.find((iss: any) => isIssueMatch(iss, m))
            return {
              ...m,
              is_received: m.is_received || !!matched,
              issue_record: matched || m.issue_record || null,
              issued_at: matched?.issued_at || m.issued_at || null,
            }
          })
        )

        // Fetch course details & lessons from Supabase
        const { data: courseData, error: cErr } = await supabase
          .from("courses")
          .select("*, teacher:staff(name, subject, email)")
          .eq("id", courseId)
          .maybeSingle()

        if (cErr || !courseData) {
          setCourse(found.course || null)
        } else {
          setCourse(courseData)
        }

        // Fetch course contents / lessons
        try {
          const { data: lessonData } = await supabase
            .from("course_content")
            .select("*")
            .eq("course_id", courseId)
            .order("sort_order", { ascending: true })

          if (lessonData && lessonData.length > 0) {
            setContents(lessonData)
            setActiveLesson(lessonData[0])
          }
        } catch (lErr) {
          console.warn("Course content fetch note:", lErr)
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load course")
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      loadCourseData()
    }

    // Instant cross-tab sync when a material is deleted or distributed from admin panel
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === "medhashiree_material_deleted" && e.newValue) {
        try {
          const { id } = JSON.parse(e.newValue)
          if (id) {
            const idStr = String(id)
            setMaterials(prev => prev.filter(m => String(m.id) !== idStr))
            setMaterialIssues(prev => prev.filter(i => String(i.material_id) !== idStr))
          }
        } catch {}
      }
      if (e.key === "medhashiree_material_distributed" || e.key === "medhashiree_material_issues") {
        loadCourseData()
      }
    }
    window.addEventListener("storage", onStorageChange)

    // Real-time Supabase subscriptions for materials
    const courseMatsChannel = supabase
      .channel("student-course-materials-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "materials" },
        () => {
          loadCourseData()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_issues" },
        () => {
          loadCourseData()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener("storage", onStorageChange)
      supabase.removeChannel(courseMatsChannel)
    }
  }, [courseId, router])

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
        <p className="text-gray-500 font-medium text-sm">Opening course room...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="max-w-xl mx-auto my-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
        <p className="text-sm text-gray-600">{error || "Course details could not be found."}</p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/student/profile"
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Profile
          </Link>
          <Link
            href="/marketplace"
            className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>
    )
  }

  const teacherName = course.teacher?.name || "Senior Faculty"

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/student/profile"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Return to Student Profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                  {course.category || "Online Course"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Enrolled & Verified
                </span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 line-clamp-1 mt-0.5">{course.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-gray-400" /> {teacherName}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video & Lesson Content View (2 Columns on large screens) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video / Player Container */}
            <div className="bg-black rounded-2xl overflow-hidden aspect-video relative flex items-center justify-center shadow-lg">
              {activeLesson?.content_url ? (
                activeLesson.content_url.includes("youtube.com") || activeLesson.content_url.includes("youtu.be") ? (
                  <iframe
                    src={
                      activeLesson.content_url.includes("embed")
                        ? activeLesson.content_url
                        : `https://www.youtube.com/embed/${activeLesson.content_url.split("v=")[1]?.split("&")[0] || activeLesson.content_url.split("/").pop()}`
                    }
                    title={activeLesson.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={activeLesson.content_url}
                    controls
                    className="w-full h-full object-contain"
                    poster={course.thumbnail_url || undefined}
                  />
                )
              ) : (
                <div className="text-center p-8 text-white space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto text-indigo-400">
                    <PlayCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold">Course Learning Room</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {contents.length > 0
                      ? "Select a lesson from the curriculum to begin streaming."
                      : "Lessons are currently being organized by faculty. Video links will appear here."}
                  </p>
                </div>
              )}
            </div>

            {/* Lesson Title & Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {activeLesson?.title || course.title}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {activeLesson?.duration_minutes ? `${activeLesson.duration_minutes} mins` : "Self-paced"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    {course.level || "All Levels"}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Instructor: <strong>{teacherName}</strong>
                  </span>
                </div>
              </div>

              {/* Course Description */}
              {course.description && (
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">About This Course</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{course.description}</p>
                </div>
              )}
            </div>

            {/* Course Study Materials & Handouts Section */}
            {(() => {
              const receivedMatIds = new Set(
                materialIssues
                  .filter((mi: any) => mi.status !== "returned")
                  .map((mi: any) => String(mi.material_id))
                  .filter(Boolean)
              )
              const relevantMaterials = materials.filter((m: any) => {
                if (m.course_id && (m.course_id === courseId || m.course_id === course?.id)) return true
                if (course?.title && (m.subject?.toLowerCase() === course.title.toLowerCase() || m.name?.toLowerCase().includes(course.title.toLowerCase()))) return true
                if (course?.batch_id && (m.batch_id === course.batch_id || (Array.isArray(m.batch_ids) && m.batch_ids.includes(course.batch_id)))) return true
                if (course?.category && m.subject && m.subject.toLowerCase() === course.category.toLowerCase()) return true
                return false
              })

              const receivedCount = relevantMaterials.filter((m: any) => receivedMatIds.has(String(m.id)) || m.is_received).length

              return (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Course Study Materials & Handouts</h3>
                        <p className="text-xs text-gray-500">Lecture sheets, books, and practice materials for this course</p>
                      </div>
                    </div>
                    {relevantMaterials.length > 0 && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        receivedCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-teal-50 text-teal-700 border-teal-200"
                      }`}>
                        {receivedCount}/{relevantMaterials.length} Got
                      </span>
                    )}
                  </div>

                  {relevantMaterials.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs space-y-1">
                      <Package className="w-8 h-8 mx-auto text-gray-300 mb-1" />
                      <p className="font-semibold text-gray-600">No physical study materials assigned yet</p>
                      <p className="text-gray-400">Class notes and study materials will appear here when distributed by the teacher.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {relevantMaterials.map((m: any) => {
                        const isReceived = receivedMatIds.has(String(m.id)) || m.is_received === true
                        const issueRecord = materialIssues.find((mi: any) => String(mi.material_id) === String(m.id)) || m.issue_record

                        return (
                          <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                                {m.type && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                    {m.type}
                                  </span>
                                )}
                                {isReceived ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" /> ✓ Got / Received (সংগৃহীত)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" /> Available (সংগ্রহ বাকি)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                {m.subject && <span>Subject: <strong>{m.subject}</strong></span>}
                                {isReceived && issueRecord?.issued_at && (
                                  <span className="text-emerald-700 font-medium">Received on {formatDate(issueRecord.issued_at)}</span>
                                )}
                                {!isReceived && (
                                  <span className="text-amber-700">🏢 Collect from coaching office</span>
                                )}
                              </div>
                            </div>

                            {m.file_url && (
                              <a
                                href={m.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="self-start sm:self-center px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs border border-gray-200 transition-colors shadow-2xs flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3 text-slate-500" /> Download
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Sidebar: Curriculum & Access Info (1 Column) */}
          <div className="space-y-6">
            {/* Enrollment Status Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Access Status</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Active
                </span>
              </div>
              <p className="text-xl font-extrabold text-white">Full Course Access</p>
              <div className="space-y-1 text-xs text-indigo-200 divide-y divide-white/10 pt-1">
                {purchaseInfo?.amount_paid && (
                  <div className="flex justify-between py-1">
                    <span>Paid Amount:</span>
                    <strong className="text-white">{formatCurrency(purchaseInfo.amount_paid)}</strong>
                  </div>
                )}
                {purchaseInfo?.payment_method && (
                  <div className="flex justify-between py-1">
                    <span>Payment Method:</span>
                    <strong className="text-white uppercase">{purchaseInfo.payment_method}</strong>
                  </div>
                )}
                {purchaseInfo?.purchased_at && (
                  <div className="flex justify-between py-1">
                    <span>Enrolled On:</span>
                    <strong className="text-white">{formatDate(purchaseInfo.purchased_at)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Curriculum Lessons List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" /> Course Curriculum
                </h3>
                <span className="text-xs font-semibold text-gray-500">{contents.length} Lessons</span>
              </div>

              {contents.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="font-semibold text-gray-600">No lessons uploaded yet</p>
                  <p className="text-gray-400">The teacher is uploading recorded lectures and learning materials.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {contents.map((lesson, idx) => {
                    const isSelected = activeLesson?.id === lesson.id
                    return (
                      <button
                        key={lesson.id || idx}
                        onClick={() => setActiveLesson(lesson)}
                        className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected ? "bg-indigo-50 border-l-4 border-l-indigo-600" : "hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ${
                            isSelected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold line-clamp-1 ${isSelected ? "text-indigo-950 font-bold" : "text-gray-800"}`}>
                            {lesson.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                            {lesson.duration_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {lesson.duration_minutes}m
                              </span>
                            )}
                            <span className="capitalize">{lesson.content_type || "video"}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
