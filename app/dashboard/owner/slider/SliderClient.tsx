"use client"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus, Trash2, Image, Loader2, X, Eye, EyeOff, Pencil, Sparkles,
  Phone, Mail, MapPin, MessageSquare, Save, Sliders, Info, ExternalLink,
  Globe, Bell, Trophy, BookOpen, Award, Tag, Calendar, User, CheckCircle2,
  Landmark, ArrowUpRight, Star, Search, CalendarDays
} from "lucide-react"
import type { Branch, Blog, Achievement, Notice } from "@/lib/supabase/types"

interface Slide {
  id: string
  title: string
  subtitle: string
  image_url: string
  link_url: string
  sort_order: number
  is_active: boolean
  branch_id?: string | null
}

interface HomepageResultCard {
  id: string
  parentExam: any
  type: "one_time" | "weekly" | "daily"
  title: string
  subTitle: string
  subject: string
  batchName: string
  branchName?: string
  branchId?: string
  routineText: string
  totalMarks: number
  passMarks: number
  dayKey?: string | null
  dayLabel?: string
  isLive: boolean
}

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

function getExamDaysList(ex: any) {
  const note = ex.result_note || ""
  let recDays: any[] = []
  if (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) {
    recDays = ex.recurring_days
  } else if (note.includes("[RECURRING_DAYS:")) {
    try {
      const match = note.match(/\[RECURRING_DAYS:(.*?)\]/)
      if (match && match[1]) recDays = JSON.parse(match[1])
    } catch {}
  } else if (note.includes("[WEEKLY_SCHEDULE:")) {
    try {
      const match = note.match(/\[WEEKLY_SCHEDULE:(.*?)\]/)
      if (match && match[1]) recDays = JSON.parse(match[1])
    } catch {}
  }

  // Parse published days strictly from ex.published_days if array, otherwise note
  let pubDays: string[] = []
  if (Array.isArray(ex.published_days)) {
    pubDays = ex.published_days.map((d: any) => String(d).toLowerCase().trim())
  } else if (typeof ex.published_days === "string" && ex.published_days.trim()) {
    try {
      const parsed = JSON.parse(ex.published_days)
      if (Array.isArray(parsed)) pubDays = parsed.map((d: any) => String(d).toLowerCase().trim())
      else pubDays = ex.published_days.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    } catch {
      pubDays = ex.published_days.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    }
  } else if (note.includes("[PUBLISHED_DAYS:")) {
    try {
      const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
      if (match && match[1]) {
        pubDays = match[1].split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      }
    } catch {}
  }

  const dayMap: Record<string, any> = {}
  for (const item of recDays) {
    const isObj = typeof item === "object" && item !== null
    const rawKey = isObj ? (item.day || item.day_bn || item.day_en || "") : String(item)
    const lowerKey = String(rawKey).toLowerCase().trim()
    const matched = ALL_WEEK_DAYS.find((d) => d.id === lowerKey || d.bn === rawKey || d.en.toLowerCase() === lowerKey)
    const canonicalKey = matched ? matched.id : lowerKey
    dayMap[canonicalKey] = {
      key: canonicalKey,
      day_bn: matched?.bn || (isObj ? item.day_bn : rawKey),
      subject: isObj && item.subject ? item.subject : ex.subject || "",
      total_marks: isObj && item.total_marks ? Number(item.total_marks) : 50,
      pass_marks: isObj && item.pass_marks ? Number(item.pass_marks) : 20,
    }
  }

  return ALL_WEEK_DAYS.map((w) => {
    const conf = dayMap[w.id]
    const isPub = pubDays.some((p) => p === w.id || p === w.bn.toLowerCase() || p === w.en.toLowerCase())
    return {
      id: w.id,
      day_bn: w.bn,
      day_en: w.en,
      subject: conf?.subject || ex.subject || "",
      total_marks: conf?.total_marks || 50,
      pass_marks: conf?.pass_marks || 20,
      is_published: isPub,
    }
  })
}

interface SliderClientProps {
  slides: Slide[]
  initialSettings?: Record<string, string>
  initialBlogs?: any[]
  initialAchievements?: any[]
  initialNotices?: any[]
  initialFeedback?: any[]
  initialExams?: any[]
  branches: Branch[]
}

export default function SliderClient({
  slides: initialSlides,
  initialSettings = {},
  initialBlogs = [],
  initialAchievements = [],
  initialNotices = [],
  initialFeedback = [],
  initialExams = [],
  branches,
}: SliderClientProps) {
  const [activeTab, setActiveTab] = useState<'slider' | 'notices' | 'exams' | 'achievements' | 'blogs' | 'feedback' | 'contact'>('slider')
  const supabase = createClient()

  // --- EXAMS & NOTIFICATIONS STATE ---
  const [exams, setExams] = useState<any[]>(initialExams)
  const [examSearch, setExamSearch] = useState("")
  const [examBranchFilter, setExamBranchFilter] = useState("all")
  const [examStatusFilter, setExamStatusFilter] = useState<"all" | "published" | "unpublished">("published")
  const [unpublishingExamId, setUnpublishingExamId] = useState<string | null>(null)
  const [noticeFilter, setNoticeFilter] = useState<"all" | "exam" | "general">("all")

  // --- SLIDER STATE ---
  const [slides, setSlides] = useState<Slide[]>(initialSlides)
  const [showSlideForm, setShowSlideForm] = useState(false)
  const [editSlide, setEditSlide] = useState<Slide | null>(null)
  const [slideLoading, setSlideLoading] = useState(false)
  const [slideForm, setSlideForm] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_url: "",
    branch_id: "",
  })

  // --- NOTICES STATE ---
  const [notices, setNotices] = useState<any[]>(initialNotices)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [editNotice, setEditNotice] = useState<any | null>(null)
  const [noticeLoading, setNoticeLoading] = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    branch_id: "",
    is_active: true,
  })

  // --- ACHIEVEMENTS STATE ---
  const [achievements, setAchievements] = useState<any[]>(initialAchievements)
  const [showAchModal, setShowAchModal] = useState(false)
  const [editAch, setEditAch] = useState<any | null>(null)
  const [achLoading, setAchLoading] = useState(false)
  const [achForm, setAchForm] = useState({
    student_name: "",
    title: "",
    description: "",
    photo_url: "",
    exam_year: "2025",
    branch_id: "",
    is_active: true,
  })

  // --- BLOGS STATE ---
  const [blogs, setBlogs] = useState<any[]>(initialBlogs)
  const [showBlogModal, setShowBlogModal] = useState(false)
  const [editBlog, setEditBlog] = useState<any | null>(null)
  const [blogLoading, setBlogLoading] = useState(false)
  const [blogForm, setBlogForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    author_name: "MedhaShiree Editorial Team",
    cover_image: "",
    tags: "পরীক্ষার প্রস্তুতি, মোটিভেশন",
    branch_id: "",
    is_published: true,
  })

  // --- CONTACT / BRANDING STATE ---
  const [contactPhone, setContactPhone] = useState(initialSettings['contact_phone'] || '01302201431')
  const [contactEmail, setContactEmail] = useState(initialSettings['contact_email'] || 'info@medhashiree.com')
  const [contactAddress, setContactAddress] = useState(initialSettings['contact_address'] || 'Rajshahi, Bangladesh')
  const [contactLink, setContactLink] = useState(initialSettings['contact_link'] || 'https://wa.me/8801302201431')
  const [contactLabel, setContactLabel] = useState(initialSettings['contact_label'] || 'WhatsApp Us')
  const [footerAbout, setFooterAbout] = useState(
    initialSettings['footer_about'] ||
    "Rajshahi's premier coaching center. Quality education, expert teachers, and a proven track record of student success."
  )
  const [savingContact, setSavingContact] = useState(false)

  // --- FEEDBACK STATE ---
  const [feedback, setFeedback] = useState<any[]>(initialFeedback)
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'unread'>('all')

  async function handleMarkFeedbackRead(id: string) {
    try {
      const { error } = await supabase.from("feedback").update({ is_read: true }).eq("id", id)
      if (error) throw error
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, is_read: true } : f))
      toast.success("Feedback marked as read")
    } catch (err: any) {
      toast.error(err.message || "Failed to mark feedback")
    }
  }

  async function handleDeleteFeedback(id: string) {
    if (!confirm("Are you sure you want to delete this feedback submission?")) return
    try {
      const { error } = await supabase.from("feedback").delete().eq("id", id)
      if (error) throw error
      setFeedback(prev => prev.filter(f => f.id !== id))
      toast.success("Feedback deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete feedback")
    }
  }

  // ----------------------------------------------------
  // SLIDER ACTIONS
  // ----------------------------------------------------
  async function handleSlideSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!slideForm.image_url) {
      toast.error("Image URL is required")
      return
    }
    setSlideLoading(true)
    try {
      if (editSlide) {
        const updatePayload: Record<string, any> = {
          title: slideForm.title,
          subtitle: slideForm.subtitle,
          image_url: slideForm.image_url,
          link_url: slideForm.link_url,
        }
        if (slideForm.branch_id) {
          updatePayload.branch_id = slideForm.branch_id
        }

        let { error } = await supabase.from("slider_images").update(updatePayload).eq("id", editSlide.id)
        if (error && (
          error.message?.includes("branch_id") || 
          error.message?.includes("schema cache") || 
          (error as any).code === "PGRST204"
        )) {
          delete updatePayload.branch_id
          const retry = await supabase.from("slider_images").update(updatePayload).eq("id", editSlide.id)
          error = retry.error
        }
        if (error) throw error
        setSlides(prev => prev.map(s => s.id === editSlide.id ? { ...s, ...slideForm, branch_id: slideForm.branch_id || null } : s))
        toast.success("Slide updated successfully")
      } else {
        const nextOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) + 1 : 1
        const insertPayload: Record<string, any> = {
          title: slideForm.title || "",
          subtitle: slideForm.subtitle || "",
          image_url: slideForm.image_url,
          link_url: slideForm.link_url || "",
          sort_order: nextOrder,
          is_active: true,
        }
        if (slideForm.branch_id) {
          insertPayload.branch_id = slideForm.branch_id
        }

        let { data, error } = await supabase.from("slider_images").insert([insertPayload]).select().single()
        if (error && (
          error.message?.includes("branch_id") || 
          error.message?.includes("schema cache") || 
          (error as any).code === "PGRST204"
        )) {
          delete insertPayload.branch_id
          const retry = await supabase.from("slider_images").insert([insertPayload]).select().single()
          data = retry.data
          error = retry.error
        }
        if (error) throw error
        setSlides(prev => [...prev, data || { ...insertPayload, id: String(Date.now()) }])
        toast.success("Slide added successfully")
      }
      setShowSlideForm(false)
      setEditSlide(null)
      setSlideForm({ title: "", subtitle: "", image_url: "", link_url: "", branch_id: "" })
    } catch (err: any) {
      toast.error(err.message || "Failed to save slide")
    } finally {
      setSlideLoading(false)
    }
  }

  async function handleDeleteSlide(id: string) {
    if (!confirm("Are you sure you want to delete this slide?")) return
    try {
      const { error } = await supabase.from("slider_images").delete().eq("id", id)
      if (error) throw error
      setSlides(prev => prev.filter(s => s.id !== id))
      toast.success("Slide deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete slide")
    }
  }

  async function handleToggleSlideActive(id: string, current: boolean) {
    try {
      const { error } = await supabase.from("slider_images").update({ is_active: !current }).eq("id", id)
      if (error) throw error
      setSlides(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle slide")
    }
  }

  // ----------------------------------------------------
  // NOTICE ACTIONS (For Notice Book)
  // ----------------------------------------------------
  function openCreateNotice() {
    setEditNotice(null)
    setNoticeForm({ title: "", content: "", branch_id: "", is_active: true })
    setShowNoticeModal(true)
  }

  function openEditNotice(n: any) {
    setEditNotice(n)
    setNoticeForm({
      title: n.title || "",
      content: n.content || "",
      branch_id: n.branch_id || "",
      is_active: n.is_active ?? true,
    })
    setShowNoticeModal(true)
  }

  async function handleNoticeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!noticeForm.title.trim()) {
      toast.error("Notice title is required")
      return
    }
    setNoticeLoading(true)
    try {
      const payload = {
        id: editNotice?.id,
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        branch_ids: noticeForm.branch_id ? [noticeForm.branch_id] : [],
        is_global: !noticeForm.branch_id,
        is_active: noticeForm.is_active,
      }
      const res = await fetch("/api/notices/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save notice")

      if (editNotice) {
        setNotices(prev => prev.map(n => n.id === editNotice.id ? data.notice : n))
        toast.success("Notice updated")
      } else {
        setNotices(prev => [data.notice, ...prev])
        toast.success("Notice published to Notice Book")
      }
      setShowNoticeModal(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save notice")
    } finally {
      setNoticeLoading(false)
    }
  }

  async function handleDeleteNotice(id: string) {
    if (!confirm("Are you sure you want to delete this notice?")) return
    try {
      const res = await fetch("/api/notices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete notice")

      setNotices(prev => prev.filter(n => n.id !== id))
      toast.success("Notice deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notice")
    }
  }

  // ----------------------------------------------------
  // EXAM NOTIFICATIONS & RESULTS ACTIONS
  // ----------------------------------------------------
  async function handleUnpublishExam(examId: string, examTitle: string, skipConfirm = false) {
    if (!skipConfirm && !confirm(`আপনি কি নিশ্চিত যে "${examTitle}" এর নোটিফিকেশন ও রেজাল্ট কার্ড ওয়েবসাইট হোমপেজ ও নোটিশ বোর্ড থেকে মুছে ফেলতে চান? (মূল পরীক্ষার ডাটাবেজ সুরক্ষিত থাকবে)`)) {
      return
    }

    setUnpublishingExamId(examId)
    try {
      const res = await fetch("/api/exams/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          action: "unpublish",
          delete_notices: true,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete exam notification")

      setExams(prev => prev.map(e => {
        if (e.id === examId) {
          return {
            ...e,
            is_public_result: false,
            is_published: false,
            is_weekly_published: false,
            published_days: [],
            result_note: (e.result_note || "")
              .replace(/\[PUBLIC_RESULT:[^\]]*\]/g, "")
              .replace(/\[IS_WEEKLY_PUBLISHED:[^\]]*\]/g, "")
              .replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "")
              .trim() + " [PUBLIC_RESULT:false] [IS_WEEKLY_PUBLISHED:false] [PUBLISHED_DAYS:]",
          }
        }
        return e
      }))

      setNotices(prev => prev.filter(n => !(n.title?.includes(examTitle) || n.content?.includes(examTitle))))

      toast.success(data.message || "✓ হোমপেজ ও নোটিশ বোর্ড থেকে পরীক্ষার নোটিফিকেশন সফলভাবে মুছে ফেলা হয়েছে!")
    } catch (err: any) {
      toast.error(err.message || "Failed to unpublish exam")
    } finally {
      setUnpublishingExamId(null)
    }
  }

  async function handlePublishExam(examId: string, examTitle: string) {
    try {
      const res = await fetch(`/api/exams/${examId}/publish-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "results" }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to publish exam")

      setExams(prev => prev.map(e => {
        if (e.id === examId) {
          return {
            ...e,
            is_public_result: true,
            is_published: true,
            is_weekly_published: true,
          }
        }
        return e
      }))

      if (data.notice) {
        setNotices(prev => [data.notice, ...prev])
      }

      toast.success("✓ পরীক্ষা সফলভাবে হোমপেজ ও নোটিশ বোর্ডে প্রকাশ করা হয়েছে!")
    } catch (err: any) {
      toast.error(err.message || "Failed to publish exam")
    }
  }

  async function handleDeleteSpecificDay(examId: string, dayKey: string, dayLabel: string, skipConfirm = false) {
    if (!skipConfirm && !confirm(`আপনি কি নিশ্চিত যে "${dayLabel}" এর নোটিফিকেশন ও রেজাল্ট হোমপেজ থেকে মুছে ফেলতে চান?`)) {
      return
    }

    try {
      const res = await fetch("/api/exams/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          action: "delete_day",
          day_key: dayKey,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to remove day notification")

      setExams(prev => prev.map(e => {
        if (e.id === examId) {
          const currentDays = Array.isArray(e.published_days) ? e.published_days : []
          const filtered = currentDays.filter((d: any) => String(d).toLowerCase() !== dayKey.toLowerCase())
          let updatedNote = e.result_note || ""
          updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
          if (filtered.length > 0) updatedNote = `${updatedNote} [PUBLISHED_DAYS:${filtered.join(",")}]`.trim()
          else updatedNote = `${updatedNote} [PUBLISHED_DAYS:]`.trim()

          return {
            ...e,
            published_days: filtered,
            result_note: updatedNote,
            is_public_result: filtered.length > 0 || e.is_weekly_published,
          }
        }
        return e
      }))

      setNotices(prev => prev.filter(n => !(n.title?.includes(dayLabel) || n.content?.includes(dayLabel))))

      toast.success(data.message || `✓ ${dayLabel} এর নোটিফিকেশন হোমপেজ থেকে সফলভাবে মুছে ফেলা হয়েছে!`)
    } catch (err: any) {
      toast.error(err.message || "Failed to remove day")
    }
  }

  async function handlePublishSpecificDay(examId: string, dayKey: string, dayLabel: string) {
    try {
      const res = await fetch("/api/exams/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          action: "publish_day",
          day_key: dayKey,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to publish day notification")

      setExams(prev => prev.map(e => {
        if (e.id === examId) {
          const currentDays = Array.isArray(e.published_days) ? e.published_days : []
          const newDays = Array.from(new Set([...currentDays, dayKey.toLowerCase()]))
          let updatedNote = e.result_note || ""
          updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
          updatedNote = `${updatedNote} [PUBLISHED_DAYS:${newDays.join(",")}]`.trim()

          return {
            ...e,
            published_days: newDays,
            result_note: updatedNote,
            is_public_result: true,
            is_published: true,
          }
        }
        return e
      }))

      toast.success(data.message || `${dayLabel} results published to online portal!`)
    } catch (err: any) {
      toast.error(err.message || "Failed to publish day")
    }
  }

  async function handleToggleWeeklyTotal(examId: string, isWeeklyPub: boolean) {
    try {
      const res = await fetch("/api/exams/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          action: "toggle_weekly_total",
          is_weekly_published: isWeeklyPub,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update weekly aggregate")

      setExams(prev => prev.map(e => {
        if (e.id === examId) {
          return {
            ...e,
            is_weekly_published: isWeeklyPub,
            is_public_result: isWeeklyPub || (Array.isArray(e.published_days) && e.published_days.length > 0),
          }
        }
        return e
      }))

      toast.success(data.message || "Weekly aggregate status updated!")
    } catch (err: any) {
      toast.error(err.message || "Failed to update weekly aggregate")
    }
  }

  async function handleDeleteExamPermanently(examId: string, examTitle: string) {
    if (!confirm(`🔴 DANGER: Are you completely certain you want to permanently delete the exam "${examTitle}" and all its records and results from the database?`)) {
      return
    }

    try {
      const res = await fetch("/api/exams/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: examId,
          action: "delete_exam",
          delete_notices: true,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete exam")

      setExams(prev => prev.filter(e => e.id !== examId))
      setNotices(prev => prev.filter(n => !(n.title?.includes(examTitle) || n.content?.includes(examTitle))))

      toast.success(data.message || `Exam "${examTitle}" permanently deleted!`)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete exam")
    }
  }

  async function handleDeleteCard(card: HomepageResultCard) {
    if (!confirm(`আপনি কি নিশ্চিত যে "${card.title}" এর ফলাফল ও নোটিফিকেশন হোমপেজ থেকে মুছে ফেলতে চান? (ডাটাবেজের মূল মার্কস নিরাপদ থাকবে)`)) {
      return
    }

    setUnpublishingExamId(card.id)
    try {
      if (card.type === "weekly") {
        await handleToggleWeeklyTotal(card.parentExam.id, false)
      } else if (card.type === "daily") {
        await handleDeleteSpecificDay(card.parentExam.id, card.dayKey!, card.dayLabel || card.title, true)
      } else {
        await handleUnpublishExam(card.parentExam.id, card.title, true)
      }
    } finally {
      setUnpublishingExamId(null)
    }
  }

  async function handlePublishCard(card: HomepageResultCard) {
    setUnpublishingExamId(card.id)
    try {
      if (card.type === "weekly") {
        await handleToggleWeeklyTotal(card.parentExam.id, true)
      } else if (card.type === "daily") {
        await handlePublishSpecificDay(card.parentExam.id, card.dayKey!, card.dayLabel || card.title)
      } else {
        await handlePublishExam(card.parentExam.id, card.title)
      }
    } finally {
      setUnpublishingExamId(null)
    }
  }

  // ----------------------------------------------------
  // ACHIEVEMENTS ACTIONS
  // ----------------------------------------------------
  function openCreateAch() {
    setEditAch(null)
    setAchForm({
      student_name: "",
      title: "",
      description: "",
      photo_url: "",
      exam_year: "2025",
      branch_id: "",
      is_active: true,
    })
    setShowAchModal(true)
  }

  function openEditAch(a: any) {
    setEditAch(a)
    setAchForm({
      student_name: a.student_name || "",
      title: a.title || "",
      description: a.description || a.result_details || "",
      photo_url: a.photo_url || a.image_url || "",
      exam_year: a.exam_year || a.year || "2025",
      branch_id: a.branch_id || "",
      is_active: a.is_active ?? true,
    })
    setShowAchModal(true)
  }

  async function handleAchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!achForm.student_name.trim() || !achForm.title.trim()) {
      toast.error("Student name and title are required")
      return
    }
    setAchLoading(true)
    try {
      const payload: any = {
        student_name: achForm.student_name.trim(),
        title: achForm.title.trim(),
        description: achForm.description.trim(),
        photo_url: achForm.photo_url.trim() || null,
        exam_year: achForm.exam_year.trim() || null,
        branch_id: achForm.branch_id || null,
        is_active: achForm.is_active,
      }
      if (editAch) {
        let { error } = await supabase.from("achievements").update(payload).eq("id", editAch.id)
        if (error && (error.message?.includes("photo_url") || error.code === "42703")) {
          delete payload.photo_url
          payload.image_url = achForm.photo_url.trim() || null
          error = (await supabase.from("achievements").update(payload).eq("id", editAch.id)).error
        }
        if (error) throw error
        setAchievements(prev => prev.map(a => a.id === editAch.id ? { ...a, ...payload } : a))
        toast.success("Achievement updated")
      } else {
        let { data, error } = await supabase.from("achievements").insert([payload]).select().single()
        if (error && (error.message?.includes("photo_url") || error.code === "42703")) {
          delete payload.photo_url
          payload.image_url = achForm.photo_url.trim() || null
          const retry = await supabase.from("achievements").insert([payload]).select().single()
          data = retry.data
          error = retry.error
        }
        if (error) throw error
        setAchievements(prev => [data, ...prev])
        toast.success("Achievement added")
      }
      setShowAchModal(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save achievement")
    } finally {
      setAchLoading(false)
    }
  }

  async function handleDeleteAch(id: string) {
    if (!confirm("Are you sure you want to delete this achievement?")) return
    try {
      const { error } = await supabase.from("achievements").delete().eq("id", id)
      if (error) throw error
      setAchievements(prev => prev.filter(a => a.id !== id))
      toast.success("Achievement deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete achievement")
    }
  }

  // ----------------------------------------------------
  // BLOG POST ACTIONS
  // ----------------------------------------------------
  function openCreateBlog() {
    setEditBlog(null)
    setBlogForm({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      author_name: "MedhaShiree Editorial Team",
      cover_image: "",
      tags: "পড়াশোনা, এইচএসসি, টিপস",
      branch_id: "",
      is_published: true,
    })
    setShowBlogModal(true)
  }

  function openEditBlog(b: any) {
    setEditBlog(b)
    setBlogForm({
      title: b.title || "",
      slug: b.slug || "",
      excerpt: b.excerpt || b.summary || "",
      content: b.content || "",
      author_name: b.author_name || "MedhaShiree Editorial Team",
      cover_image: b.cover_image || b.cover_image_url || "",
      tags: Array.isArray(b.tags) ? b.tags.join(", ") : (b.tags || ""),
      branch_id: b.branch_id || "",
      is_published: b.is_published ?? true,
    })
    setShowBlogModal(true)
  }

  async function handleBlogSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!blogForm.title.trim()) {
      toast.error("Blog title is required")
      return
    }
    setBlogLoading(true)
    try {
      const slug = blogForm.slug.trim() || blogForm.title.trim().toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, "-") + "-" + Date.now()
      const tagsArray = blogForm.tags.split(",").map(t => t.trim()).filter(Boolean)
      const payload: any = {
        title: blogForm.title.trim(),
        slug,
        excerpt: blogForm.excerpt.trim() || null,
        content: blogForm.content.trim(),
        author_name: blogForm.author_name.trim() || null,
        cover_image: blogForm.cover_image.trim() || null,
        tags: tagsArray,
        branch_id: blogForm.branch_id || null,
        is_published: blogForm.is_published,
        published_at: new Date().toISOString(),
      }
      if (editBlog) {
        let { error } = await supabase.from("blogs").update(payload).eq("id", editBlog.id)
        if (error && (error.message?.includes("cover_image") || error.code === "42703")) {
          delete payload.cover_image
          payload.cover_image_url = blogForm.cover_image.trim() || null
          error = (await supabase.from("blogs").update(payload).eq("id", editBlog.id)).error
        }
        if (error) throw error
        setBlogs(prev => prev.map(b => b.id === editBlog.id ? { ...b, ...payload } : b))
        toast.success("Blog updated")
      } else {
        let { data, error } = await supabase.from("blogs").insert([payload]).select().single()
        if (error && (error.message?.includes("cover_image") || error.code === "42703")) {
          delete payload.cover_image
          payload.cover_image_url = blogForm.cover_image.trim() || null
          const retry = await supabase.from("blogs").insert([payload]).select().single()
          data = retry.data
          error = retry.error
        }
        if (error) throw error
        setBlogs(prev => [data, ...prev])
        toast.success("Blog post published")
      }
      setShowBlogModal(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save blog post")
    } finally {
      setBlogLoading(false)
    }
  }

  async function handleDeleteBlog(id: string) {
    if (!confirm("Are you sure you want to delete this blog post?")) return
    try {
      const { error } = await supabase.from("blogs").delete().eq("id", id)
      if (error) throw error
      setBlogs(prev => prev.filter(b => b.id !== id))
      toast.success("Blog post deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete blog post")
    }
  }

  // ----------------------------------------------------
  // CONTACT INFO SAVE
  // ----------------------------------------------------
  async function handleSaveContact() {
    setSavingContact(true)
    try {
      const pairs = [
        { key: 'contact_phone', value: contactPhone },
        { key: 'contact_email', value: contactEmail },
        { key: 'contact_address', value: contactAddress },
        { key: 'contact_link', value: contactLink },
        { key: 'contact_label', value: contactLabel },
        { key: 'footer_about', value: footerAbout },
      ]
      for (const p of pairs) {
        await supabase.from("site_settings").upsert(p, { onConflict: 'key' })
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('medhashiree_contact_phone', contactPhone)
        localStorage.setItem('medhashiree_contact_email', contactEmail)
        localStorage.setItem('medhashiree_contact_address', contactAddress)
        localStorage.setItem('medhashiree_contact_link', contactLink)
        localStorage.setItem('medhashiree_contact_label', contactLabel)
        localStorage.setItem('medhashiree_footer_about', footerAbout)
      }
      toast.success("Institutional settings saved successfully!")
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings")
    } finally {
      setSavingContact(false)
    }
  }

  const allResultCards = useMemo(() => {
    const cards: HomepageResultCard[] = []

    for (const ex of exams) {
      const isWeekly =
        ex.exam_schedule_type === "weekly" ||
        (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) ||
        Boolean(ex.title?.includes("সাপ্তাহিক"))

      if (!isWeekly) {
        const isLive = Boolean(ex.is_public_result || ex.is_published)
        cards.push({
          id: `${ex.id}-single`,
          parentExam: ex,
          type: "one_time",
          title: ex.title,
          subTitle: ex.subject ? `বিষয়: ${ex.subject}` : "এককালীন সাধারণ পরীক্ষা",
          subject: ex.subject || "",
          batchName: ex.batch?.name || "All Enrolled Batches",
          branchName: ex.branch?.name,
          branchId: ex.branch?.id || ex.branch_id,
          routineText: ex.exam_date ? new Date(ex.exam_date).toLocaleDateString("en-GB") : "তারিখ নির্ধারিত",
          totalMarks: ex.total_marks || 100,
          passMarks: ex.pass_marks || 40,
          dayKey: null,
          isLive,
        })
      } else {
        const days = getExamDaysList(ex)
        const totalMarks = days.reduce((acc, d) => acc + (d.total_marks || 0), 0) || (ex.total_marks || 350)
        const passMarks = days.reduce((acc, d) => acc + (d.pass_marks || 0), 0) || (ex.pass_marks || 140)

        const note = ex.result_note || ""
        const isWeeklyExplicitlyFalse = note.includes("[IS_WEEKLY_PUBLISHED:false]") || ex.is_weekly_published === false
        const isWeeklyPub = (ex.is_weekly_published === true || note.includes("[IS_WEEKLY_PUBLISHED:true]")) && !isWeeklyExplicitlyFalse

        // 1. Weekly Consolidated Card (350 marks)
        cards.push({
          id: `${ex.id}-weekly`,
          parentExam: ex,
          type: "weekly",
          title: ex.title,
          subTitle: "সাপ্তাহিক সামগ্রিক মূল্যায়ন ও সকল দিনের সম্মিলিত ফলাফল",
          subject: ex.subject || "সকল বিষয়",
          batchName: ex.batch?.name || "All Enrolled Batches",
          branchName: ex.branch?.name,
          branchId: ex.branch?.id || ex.branch_id,
          routineText: "সাপ্তাহিক পূর্ণাঙ্গ সূচি (শনিবার হতে শুক্রবার)",
          totalMarks,
          passMarks,
          dayKey: null,
          isLive: isWeeklyPub,
        })

        // 2. 7 Daily Cards (Saturday through Friday)
        for (const d of days) {
          cards.push({
            id: `${ex.id}-day-${d.id}`,
            parentExam: ex,
            type: "daily",
            title: `${ex.title} - ${d.day_bn}`,
            subTitle: d.subject ? `${d.subject} (${d.day_bn}ের পরীক্ষা)` : `${d.day_bn}ের পরীক্ষা`,
            subject: d.subject || ex.subject || "",
            batchName: ex.batch?.name || "All Enrolled Batches",
            branchName: ex.branch?.name,
            branchId: ex.branch?.id || ex.branch_id,
            routineText: `${d.day_bn}ের পরীক্ষা`,
            totalMarks: d.total_marks || 50,
            passMarks: d.pass_marks || 20,
            dayKey: d.id,
            dayLabel: d.day_bn,
            isLive: Boolean(d.is_published),
          })
        }
      }
    }

    return cards
  }, [exams])

  const publishedCardsCount = useMemo(() => allResultCards.filter(c => c.isLive).length, [allResultCards])
  const draftCardsCount = useMemo(() => allResultCards.filter(c => !c.isLive).length, [allResultCards])

  const filteredNotices = notices.filter(notice => {
    const isExamNotice =
      notice.title?.includes("পরীক্ষা") ||
      notice.title?.includes("ফলাফল") ||
      notice.title?.includes("মেরিট") ||
      notice.title?.includes("রুটিন") ||
      notice.content?.includes("পরীক্ষা") ||
      notice.content?.includes("মেরিট তালিকা")

    if (noticeFilter === "exam") return isExamNotice
    if (noticeFilter === "general") return !isExamNotice
    return true
  })

  const filteredResultCards = useMemo(() => {
    const q = examSearch.toLowerCase().trim()
    return allResultCards.filter(c => {
      if (q) {
        const matches =
          (c.title && c.title.toLowerCase().includes(q)) ||
          (c.subTitle && c.subTitle.toLowerCase().includes(q)) ||
          (c.subject && c.subject.toLowerCase().includes(q)) ||
          (c.batchName && c.batchName.toLowerCase().includes(q)) ||
          (c.branchName && c.branchName.toLowerCase().includes(q))
        if (!matches) return false
      }

      if (examBranchFilter !== "all") {
        if (c.branchId !== examBranchFilter) return false
      }

      if (examStatusFilter === "published") return c.isLive
      if (examStatusFilter === "unpublished") return !c.isLive
      return true
    })
  }, [allResultCards, examSearch, examBranchFilter, examStatusFilter])

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border border-slate-200 bg-white p-2 rounded-2xl shadow-sm gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('slider')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'slider'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Image className="w-4 h-4" /> Hero Slider ({slides.length})
        </button>

        <button
          onClick={() => setActiveTab('notices')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'notices'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-4 h-4" /> Notice Book ({notices.length})
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'exams'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" /> পরীক্ষা রেজাল্ট নোটিফিকেশন ({publishedCardsCount})
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'achievements'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Trophy className="w-4 h-4" /> Achievements ({achievements.length})
        </button>

        <button
          onClick={() => setActiveTab('blogs')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'blogs'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Educational Blogs ({blogs.length})
        </button>

        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'feedback'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Feedback ({feedback.length})
          {feedback.filter(f => !f.is_read).length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'contact'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-4 h-4" /> Institutional Contacts
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. HERO SLIDER TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'slider' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Hero Image Slider</h3>
              <p className="text-xs text-amber-400/90 font-medium">
                Shown on the left 65% of the homepage hero section
              </p>
            </div>
            <button
              onClick={() => {
                setEditSlide(null)
                setSlideForm({ title: "", subtitle: "", image_url: "", link_url: "", branch_id: "" })
                setShowSlideForm(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> Add Slide
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {slides.map(slide => {
              const slideBranch = branches.find(b => b.id === slide.branch_id)
              return (
                <div
                  key={slide.id}
                  className={`bg-white rounded-2xl border ${
                    slide.is_active ? 'border-slate-200 hover:border-amber-500/40' : 'border-slate-200 opacity-50'
                  } overflow-hidden shadow-xl hover:shadow-2xl transition-all flex flex-col justify-between`}
                >
                  <div className="relative aspect-video bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.image_url}
                      alt={slide.title || "Slide"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => handleToggleSlideActive(slide.id, slide.is_active)}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-xs transition-colors"
                      >
                        {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditSlide(slide)
                          setSlideForm({
                            title: slide.title || "",
                            subtitle: slide.subtitle || "",
                            image_url: slide.image_url,
                            link_url: slide.link_url || "",
                            branch_id: slide.branch_id || "",
                          })
                          setShowSlideForm(true)
                        }}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-xs transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="p-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded-lg backdrop-blur-xs transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{slide.title || "Untitled Slide"}</h4>
                      {slideBranch ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-medium">
                          {slideBranch.name}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md font-medium">
                          All Branches
                        </span>
                      )}
                    </div>
                    {slide.subtitle && (
                      <p className="text-xs text-slate-400 line-clamp-1">{slide.subtitle}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. NOTICE BOOK TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Notice Book ("সর্বশেষ নোটিশ :")</h3>
              <p className="text-xs text-slate-500 font-medium">
                Notices displayed in the side-by-side institutional notice box next to the slider & public portal
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setNoticeFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    noticeFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({notices.length})
                </button>
                <button
                  onClick={() => setNoticeFilter("exam")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    noticeFilter === "exam" ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Exam Notices (পরীক্ষা)
                </button>
                <button
                  onClick={() => setNoticeFilter("general")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    noticeFilter === "general" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  General
                </button>
              </div>

              <button
                onClick={openCreateNotice}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Post Notice
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-100">
              {filteredNotices.map(notice => {
                const noticeBranch = branches.find(b => b.id === notice.branch_id)
                const isExamNotice =
                  notice.title?.includes("পরীক্ষা") ||
                  notice.title?.includes("ফলাফল") ||
                  notice.title?.includes("মেরিট") ||
                  notice.title?.includes("রুটিন") ||
                  notice.content?.includes("পরীক্ষা")

                return (
                  <div key={notice.id} className="p-4 flex items-start justify-between gap-4 hover:bg-amber-50/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-amber-600 font-bold text-base">»</span>
                        <h4 className="font-bold text-slate-900 text-sm">{notice.title}</h4>
                        {isExamNotice && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                            <Award className="w-3 h-3 text-amber-600" /> Exam Notice
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">
                          {notice.created_at ? new Date(notice.created_at).toLocaleDateString("en-GB") : ""}
                        </span>
                        {noticeBranch ? (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md font-medium">
                            {noticeBranch.name}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                            All Branches
                          </span>
                        )}
                      </div>
                      {notice.content && (
                        <p className="text-xs text-slate-600 line-clamp-2 pl-4 leading-relaxed">{notice.content}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEditNotice(notice)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Edit Notice"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredNotices.length === 0 && (
                <div className="p-12 text-center text-slate-500 text-sm">
                  {noticeFilter === "exam" ? "No exam notices found." : "No notices published yet."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. EXAM NOTIFICATIONS & ONLINE RESULTS TAB (RESULT CARDS) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl border border-indigo-900/60 shadow-xl text-white">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Homepage Result Manager
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
                  {publishedCardsCount}টি রেজাল্ট কার্ড হোমপেজে লাইভ
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                হোমপেজ পরীক্ষার রেজাল্ট কার্ড ও নোটিফিকেশন
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl">
                হোমপেজের প্রতিটি রেজাল্ট কার্ড সরাসরি এখান থেকে পরিচালনা করুন। যেকোনো কার্ডের লাল <span className="text-red-400 font-bold">🗑️ মুছুন</span> বাটনে ক্লিক করলে তা সরাসরি হোমপেজ ও পোর্টাল থেকে মুছে যাবে (ডাটাবেজ ও মূল মার্কস ১০০% নিরাপদ থাকবে)।
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <a
                href="/online-result"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs sm:text-sm shadow-md transition-all hover:scale-105"
              >
                <span>লাইভ রেজাল্ট পোর্টাল</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="/dashboard/owner/exams"
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs border border-white/10 transition-colors"
              >
                <span>Exam Center →</span>
              </a>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="পরীক্ষার নাম, বিষয়, ব্যাচ বা শাখা দিয়ে খুঁজুন..."
                  value={examSearch}
                  onChange={e => setExamSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all shadow-2xs"
                />
              </div>

              <select
                value={examBranchFilter}
                onChange={e => setExamBranchFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500"
              >
                <option value="all">সকল শাখা (All Branches)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setExamStatusFilter("published")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    examStatusFilter === "published" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  হোমপেজে লাইভ ({publishedCardsCount})
                </button>
                <button
                  onClick={() => setExamStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    examStatusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  সব কার্ড ({allResultCards.length})
                </button>
                <button
                  onClick={() => setExamStatusFilter("unpublished")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    examStatusFilter === "unpublished" ? "bg-slate-700 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  আনপাবলিশড / ড্রাফট ({draftCardsCount})
                </button>
              </div>
            </div>
          </div>

          {/* Result Cards Grid - Exactly matching Public Result Cards */}
          {filteredResultCards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-xs">
              <Award className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-900">কোনো রেজাল্ট কার্ড পাওয়া যায়নি</h4>
              <p className="text-xs text-slate-500 mt-1">
                {examSearch ? "আপনার সার্চের সাথে মিলে এমন কোনো রেজাল্ট কার্ড পাওয়া যায়নি।" : "কোনো রেজাল্ট কার্ড তৈরি করা হয়নি।"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredResultCards.map(card => {
                const isWeekly = card.type === "weekly"
                const isDaily = card.type === "daily"
                const isDeleting = unpublishingExamId === card.id

                return (
                  <div
                    key={card.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${
                      card.isLive ? "border-slate-200/90 hover:border-amber-400" : "border-slate-200 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Card Header with Badges and Delete/Publish action */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            card.isLive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {card.isLive ? "● লাইভ" : "○ ড্রাফট"}
                          </span>

                          {isWeekly ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                              <CalendarDays className="w-3 h-3" />
                              WEEKLY (সাপ্তাহিক ৭ দিন)
                            </span>
                          ) : isDaily ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                              <Calendar className="w-3 h-3 text-amber-700" />
                              দৈনিক ({card.dayLabel || "দিন"})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                              <Calendar className="w-3 h-3" />
                              ONE-TIME
                            </span>
                          )}

                          {card.subject && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {card.subject}
                            </span>
                          )}
                        </div>

                        {/* Top-Right: Delete or Publish Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {card.branchName && (
                            <span className="text-[10px] font-semibold text-slate-500 hidden sm:flex items-center gap-1">
                              <Landmark className="w-3 h-3 text-slate-400" />
                              {card.branchName}
                            </span>
                          )}

                          {card.isLive ? (
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteCard(card)}
                              className="px-2.5 py-1 text-red-600 hover:text-white hover:bg-red-600 bg-red-50/90 rounded-lg transition-all border border-red-200 cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                              title="এই ফলাফল কার্ডটি হোমপেজ ও পোর্টাল থেকে মুছে ফেলুন"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>{isDeleting ? "মুছছে..." : "মুছুন"}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handlePublishCard(card)}
                              className="px-2.5 py-1 text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50/90 rounded-lg transition-all border border-emerald-300 cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                              title="এই ফলাফল কার্ডটি হোমপেজে প্রকাশ করুন"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              <span>{isDeleting ? "প্রকাশ হচ্ছে..." : "প্রকাশ"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title & Subtitle */}
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-950 transition-colors leading-snug">
                          {card.title}
                        </h4>
                        {card.subTitle && (
                          <p className="text-xs text-indigo-800 font-semibold mt-0.5">
                            {card.subTitle}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                          <span>{card.batchName}</span>
                          {card.branchName && (
                            <span className="sm:hidden text-slate-400">• {card.branchName}</span>
                          )}
                        </p>
                      </div>

                      {/* Metadata Chips */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">তারিখ / সূচি</span>
                          <span className="font-bold text-slate-800 truncate block">
                            {card.routineText}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">পূর্ণমান ও পাস</span>
                          <span className="font-bold text-slate-800 block">
                            {card.totalMarks} marks (Pass: {card.passMarks})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Links */}
                    <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                      {card.isLive ? (
                        <a
                          href={card.dayKey ? `/online-result?exam_id=${card.parentExam.id}&day=${card.dayKey}` : `/online-result?exam_id=${card.parentExam.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-amber-700 hover:text-amber-800 font-bold hover:underline"
                          title="পাবলিক রেজাল্ট পোর্টাল দেখুন"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>পোর্টাল দেখুন</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">হোমপেজে অপ্রকাশিত</span>
                      )}

                      <a
                        href={`/dashboard/owner/exams/${card.parentExam.id}`}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200 font-semibold text-xs ml-auto"
                        title="পরীক্ষার মার্কস ইনপুট ও বিস্তারিত"
                      >
                        <span>মার্কস ও ডাটা</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. ACHIEVEMENTS TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Student Achievements & Success Stories (সাফল্যগাঁথা)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Feature top rankers, GPA 5.00 achievers, and medical/university admissions displayed on the public homepage
              </p>
            </div>
            <button
              onClick={openCreateAch}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Achievement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map(ach => {
              const achBranch = branches.find(b => b.id === ach.branch_id)
              return (
                <div key={ach.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold overflow-hidden border border-amber-200 shadow-xs">
                        {(ach.photo_url || ach.image_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ach.photo_url || ach.image_url} alt={ach.student_name} className="w-full h-full object-cover" />
                        ) : (
                          <Award className="w-6 h-6" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{ach.student_name}</h4>
                          {(ach.exam_year || ach.year) && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold shrink-0">
                              {ach.exam_year || ach.year}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-indigo-700 truncate mt-0.5">{ach.title}</p>
                      </div>
                    </div>

                    {(ach.description || ach.result_details) && (
                      <p className="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3 leading-relaxed">
                        "{ach.description || ach.result_details}"
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px] font-medium">
                      {achBranch ? achBranch.name : "All Branches"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditAch(ach)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAch(ach.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {achievements.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>No achievements published yet. Click "Add Achievement" to add your first achiever.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. BLOG WRITER TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'blogs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Educational Blogs & Articles (শিক্ষামূলক প্রবন্ধ)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Write study tips, exam advice, guidelines, and motivational articles for students displayed on homepage
              </p>
            </div>
            <button
              onClick={openCreateBlog}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Write Article
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blogs.map(blog => {
              const bBranch = branches.find(b => b.id === blog.branch_id)
              return (
                <div key={blog.id} className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                        {blog.author_name || "Academic Team"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {blog.created_at ? new Date(blog.created_at).toLocaleDateString("en-GB") : ""}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-base mb-1.5 hover:text-indigo-600 transition-colors">
                      {blog.title}
                    </h4>

                    {(blog.excerpt || blog.summary) && (
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">{blog.excerpt || blog.summary}</p>
                    )}

                    {Array.isArray(blog.tags) && blog.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {blog.tags.map((t: string, i: number) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      {bBranch ? bBranch.name : "All Branches"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditBlog(blog)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBlog(blog.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {blogs.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>No blog articles published yet. Click "Write Article" to publish your first post.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. FEEDBACK TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Student & Parent Feedback (মতামত)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Feedback and reviews submitted from the public homepage contact section
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFeedbackFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  feedbackFilter === 'all'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({feedback.length})
              </button>
              <button
                onClick={() => setFeedbackFilter('unread')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  feedbackFilter === 'unread'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Unread ({feedback.filter(f => !f.is_read).length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedback
              .filter(f => feedbackFilter === 'all' || !f.is_read)
              .map(f => (
                <div
                  key={f.id}
                  className={`bg-white rounded-2xl border p-5 space-y-3 transition-all ${
                    f.is_read ? 'border-slate-200 opacity-80' : 'border-amber-300 shadow-md shadow-amber-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm">{f.name}</h4>
                        {!f.is_read && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                            New
                          </span>
                        )}
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star
                              key={n}
                              className={`w-3.5 h-3.5 ${
                                n <= (f.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {f.phone && <span className="font-mono text-slate-700 font-semibold">{f.phone} · </span>}
                        {f.email && <span>{f.email} · </span>}
                        <span>{f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : ''}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!f.is_read && (
                        <button
                          onClick={() => handleMarkFeedbackRead(f.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="Mark Read"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Read
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteFeedback(f.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                    {f.message}
                  </p>
                </div>
              ))}

            {feedback.filter(f => feedbackFilter === 'all' || !f.is_read).length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>No feedback submissions found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 6. INSTITUTIONAL CONTACTS & BRANDING */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'contact' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-2xl">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Institutional Contact & Branding</h3>
            <p className="text-xs text-slate-500 font-medium">
              Default coaching contact details displayed on the top utility bar and footer
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Helpline Phone Number</label>
              <input
                type="text"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                placeholder="01302201431"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Email Address</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                placeholder="info@medhashiree.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Central Head Office Address</label>
              <input
                type="text"
                value={contactAddress}
                onChange={e => setContactAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                placeholder="নাচোল, চাঁপাইনবাবগঞ্জ"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Helpline Link</label>
              <input
                type="text"
                value={contactLink}
                onChange={e => setContactLink(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                placeholder="https://wa.me/8801302201431"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Footer About Synopsis</label>
              <textarea
                rows={3}
                value={footerAbout}
                onChange={e => setFooterAbout(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveContact}
                disabled={savingContact}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-sm font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Branding Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT SLIDE MODAL --- */}
      {showSlideForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editSlide ? "Edit Hero Slide" : "Add New Hero Slide"}
              </h3>
              <button onClick={() => setShowSlideForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Image URL *</label>
                <input
                  type="url"
                  required
                  value={slideForm.image_url}
                  onChange={e => setSlideForm({ ...slideForm, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={slideForm.title}
                  onChange={e => setSlideForm({ ...slideForm, title: e.target.value })}
                  placeholder="e.g. নতুন সেশনে ভর্তি চলছে"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subtitle</label>
                <input
                  type="text"
                  value={slideForm.subtitle}
                  onChange={e => setSlideForm({ ...slideForm, subtitle: e.target.value })}
                  placeholder="e.g. এইচএসসি ও এসএসসি ব্যাচ ২০২৬"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Branch</label>
                <select
                  value={slideForm.branch_id}
                  onChange={e => setSlideForm({ ...slideForm, branch_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">All Branches (সকল শাখা)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSlideForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={slideLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {slideLoading ? "Saving..." : "Save Slide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT NOTICE MODAL --- */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editNotice ? "Edit Notice" : "Post New Notice"}
              </h3>
              <button onClick={() => setShowNoticeModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleNoticeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notice Headline *</label>
                <input
                  type="text"
                  required
                  value={noticeForm.title}
                  onChange={e => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  placeholder="e.g. ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি চলছে"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Notice Content</label>
                <textarea
                  rows={4}
                  value={noticeForm.content}
                  onChange={e => setNoticeForm({ ...noticeForm, content: e.target.value })}
                  placeholder="Detailed notice text..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notice Branch</label>
                <select
                  value={noticeForm.branch_id}
                  onChange={e => setNoticeForm({ ...noticeForm, branch_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">All Branches (সকল শাখা)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noticeLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {noticeLoading ? "Saving..." : "Publish Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT ACHIEVEMENT MODAL --- */}
      {showAchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editAch ? "Edit Achievement" : "Add Student Achievement"}
              </h3>
              <button onClick={() => setShowAchModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  required
                  value={achForm.student_name}
                  onChange={e => setAchForm({ ...achForm, student_name: e.target.value })}
                  placeholder="e.g. তাসনিম হাসান"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Achievement Title *</label>
                <input
                  type="text"
                  required
                  value={achForm.title}
                  onChange={e => setAchForm({ ...achForm, title: e.target.value })}
                  placeholder="e.g. রাজশাহী মেডিকেল কলেজ (চান্স প্রাপ্ত)"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Exam / Session Year</label>
                  <input
                    type="text"
                    value={achForm.exam_year}
                    onChange={e => setAchForm({ ...achForm, exam_year: e.target.value })}
                    placeholder="2025"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                  <select
                    value={achForm.branch_id}
                    onChange={e => setAchForm({ ...achForm, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Photo URL (Optional)</label>
                <input
                  type="url"
                  value={achForm.photo_url}
                  onChange={e => setAchForm({ ...achForm, photo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Testimonial</label>
                <textarea
                  rows={2}
                  value={achForm.description}
                  onChange={e => setAchForm({ ...achForm, description: e.target.value })}
                  placeholder="Short comment or congratulations..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAchModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={achLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {achLoading ? "Saving..." : "Save Achievement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT BLOG MODAL --- */}
      {showBlogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-200 text-slate-900 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editBlog ? "Edit Educational Article" : "Write Educational Article"}
              </h3>
              <button onClick={() => setShowBlogModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBlogSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Article Title *</label>
                <input
                  type="text"
                  required
                  value={blogForm.title}
                  onChange={e => setBlogForm({ ...blogForm, title: e.target.value })}
                  placeholder="e.g. এইচএসসি পরীক্ষায় পদার্থবিজ্ঞানে এ+ পাওয়ার সহজ কৌশল"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Short Excerpt / Summary</label>
                <textarea
                  rows={2}
                  value={blogForm.excerpt}
                  onChange={e => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                  placeholder="Brief synopsis for card preview..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Article Content *</label>
                <textarea
                  rows={7}
                  required
                  value={blogForm.content}
                  onChange={e => setBlogForm({ ...blogForm, content: e.target.value })}
                  placeholder="Write full article here..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Author Name</label>
                  <input
                    type="text"
                    value={blogForm.author_name}
                    onChange={e => setBlogForm({ ...blogForm, author_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch</label>
                  <select
                    value={blogForm.branch_id}
                    onChange={e => setBlogForm({ ...blogForm, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cover Image URL (Optional)</label>
                <input
                  type="url"
                  value={blogForm.cover_image}
                  onChange={e => setBlogForm({ ...blogForm, cover_image: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={blogForm.tags}
                  onChange={e => setBlogForm({ ...blogForm, tags: e.target.value })}
                  placeholder="পড়াশোনা, এইচএসসি, পদার্থবিজ্ঞান"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:bg-white focus:border-amber-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBlogModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={blogLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {blogLoading ? "Publishing..." : "Publish Article"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}