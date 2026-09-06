"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus, Trash2, Image, Loader2, X, Eye, EyeOff, Pencil, Sparkles,
  Phone, Mail, MapPin, MessageSquare, Save, Sliders, Info, ExternalLink,
  Globe, Bell, Trophy, BookOpen, Award, Tag, Calendar, User, CheckCircle2,
  Landmark, ArrowUpRight, Star
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

interface SliderClientProps {
  slides: Slide[]
  initialSettings?: Record<string, string>
  initialBlogs?: any[]
  initialAchievements?: any[]
  initialNotices?: any[]
  initialFeedback?: any[]
  branches: Branch[]
}

export default function SliderClient({
  slides: initialSlides,
  initialSettings = {},
  initialBlogs = [],
  initialAchievements = [],
  initialNotices = [],
  initialFeedback = [],
  branches,
}: SliderClientProps) {
  const [activeTab, setActiveTab] = useState<'slider' | 'notices' | 'achievements' | 'blogs' | 'feedback' | 'contact'>('slider')
  const supabase = createClient()

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
        const { error } = await supabase.from("slider_images").update({
          title: slideForm.title,
          subtitle: slideForm.subtitle,
          image_url: slideForm.image_url,
          link_url: slideForm.link_url,
          branch_id: slideForm.branch_id || null,
        }).eq("id", editSlide.id)
        if (error) throw error
        setSlides(prev => prev.map(s => s.id === editSlide.id ? { ...s, ...slideForm, branch_id: slideForm.branch_id || null } : s))
        toast.success("Slide updated successfully")
      } else {
        const nextOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) + 1 : 1
        const { data, error } = await supabase.from("slider_images").insert([{
          ...slideForm,
          branch_id: slideForm.branch_id || null,
          sort_order: nextOrder,
          is_active: true,
        }]).select().single()
        if (error) throw error
        setSlides(prev => [...prev, data])
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
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        branch_id: noticeForm.branch_id || null,
        is_active: noticeForm.is_active,
      }
      if (editNotice) {
        const { error } = await supabase.from("notices").update(payload).eq("id", editNotice.id)
        if (error) throw error
        setNotices(prev => prev.map(n => n.id === editNotice.id ? { ...n, ...payload } : n))
        toast.success("Notice updated")
      } else {
        const { data, error } = await supabase.from("notices").insert([payload]).select().single()
        if (error) throw error
        setNotices(prev => [data, ...prev])
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
      const { error } = await supabase.from("notices").delete().eq("id", id)
      if (error) throw error
      setNotices(prev => prev.filter(n => n.id !== id))
      toast.success("Notice deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notice")
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
          <div className="flex justify-between items-center bg-white backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Notice Book ("সর্বশেষ নোটিশ :")</h3>
              <p className="text-xs text-amber-400/90 font-medium">
                Notices displayed in the side-by-side institutional notice box next to the slider
              </p>
            </div>
            <button
              onClick={openCreateNotice}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" /> Post Notice
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-100">
              {notices.map(notice => {
                const noticeBranch = branches.find(b => b.id === notice.branch_id)
                return (
                  <div key={notice.id} className="p-4 flex items-start justify-between gap-4 hover:bg-amber-50/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-amber-600 font-bold text-base">»</span>
                        <h4 className="font-bold text-slate-900 text-sm">{notice.title}</h4>
                        <span className="text-xs text-slate-400 font-medium">
                          {notice.created_at ? new Date(notice.created_at).toLocaleDateString("en-GB") : ""}
                        </span>
                        {noticeBranch ? (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md font-medium">
                            {noticeBranch.name}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
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
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200"
                        title="Edit Notice"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {notices.length === 0 && (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No notices published yet. Click "Post Notice" to create your first notice.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. ACHIEVEMENTS TAB */}
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