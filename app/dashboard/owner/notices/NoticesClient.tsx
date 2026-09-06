"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Bell, Plus, Pencil, Trash2, Check, X, Loader2, Eye, EyeOff,
  Calendar, Landmark, Search, Sparkles, ExternalLink, RefreshCw, AlertCircle
} from "lucide-react"
import Link from "next/link"
import type { Branch } from "@/lib/supabase/types"

interface Notice {
  id: string
  title: string
  content: string
  is_active: boolean
  created_at: string
  notice_date?: string | null
  branch_id?: string | null
  branch?: {
    id?: string
    name: string
  } | null
}

interface Props {
  initialNotices: Notice[]
  branches: Branch[]
}

export default function NoticesClient({ initialNotices, branches }: Props) {
  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  const [search, setSearch] = useState("")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [showModal, setShowModal] = useState(false)
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: "",
    content: "",
    branch_id: "",
    notice_date: new Date().toISOString().split("T")[0],
    is_active: true,
  })

  const supabase = createClient()

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      const matchSearch =
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        (n.content && n.content.toLowerCase().includes(search.toLowerCase()))
      const matchBranch =
        selectedBranch === "all" ||
        (!n.branch_id && selectedBranch === "global") ||
        n.branch_id === selectedBranch
      return matchSearch && matchBranch
    })
  }, [notices, search, selectedBranch])

  const activeCount = notices.filter(n => n.is_active).length

  // Open Create Modal
  function openCreate() {
    setEditingNotice(null)
    setForm({
      title: "",
      content: "",
      branch_id: "",
      notice_date: new Date().toISOString().split("T")[0],
      is_active: true,
    })
    setShowModal(true)
  }

  // Open Edit Modal
  function openEdit(notice: Notice) {
    setEditingNotice(notice)
    setForm({
      title: notice.title || "",
      content: notice.content || "",
      branch_id: notice.branch_id || "",
      notice_date: notice.notice_date || (notice.created_at ? notice.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
      is_active: notice.is_active ?? true,
    })
    setShowModal(true)
  }

  // Save (Create / Edit)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error("নোটিশের শিরোনাম আবশ্যক (Title is required)")
      return
    }

    setLoading(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        branch_id: form.branch_id || null,
        notice_date: form.notice_date || null,
        is_active: form.is_active,
      }

      if (editingNotice) {
        const { error } = await supabase
          .from("notices")
          .update(payload)
          .eq("id", editingNotice.id)

        if (error) throw error

        const targetBranch = branches.find(b => b.id === payload.branch_id)
        setNotices(prev =>
          prev.map(n =>
            n.id === editingNotice.id
              ? { ...n, ...payload, branch: targetBranch ? { id: targetBranch.id, name: targetBranch.name } : null }
              : n
          )
        )
        toast.success("নোটিশ সফলভাবে আপডেট করা হয়েছে ✅")
      } else {
        const { data, error } = await supabase
          .from("notices")
          .insert([payload])
          .select("*, branch:branches(id, name)")
          .single()

        if (error) throw error
        setNotices(prev => [data, ...prev])
        toast.success("নতুন নোটিশ প্রকাশিত হয়েছে ✅")
      }

      setShowModal(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save notice")
    } finally {
      setLoading(false)
    }
  }

  // Delete Notice
  async function handleDelete(id: string, title: string) {
    if (!confirm(`আপনি কি নিশ্চিত যে "${title}" নোটিশটি মুছে ফেলতে চান? (Are you sure you want to delete this notice?)`)) {
      return
    }

    setDeletingId(id)
    try {
      const { error } = await supabase.from("notices").delete().eq("id", id)
      if (error) throw error

      setNotices(prev => prev.filter(n => n.id !== id))
      toast.success("নোটিশটি মুছে ফেলা হয়েছে 🗑️")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notice")
    } finally {
      setDeletingId(null)
    }
  }

  // Toggle Active Status
  async function handleToggleActive(id: string, current: boolean) {
    setTogglingId(id)
    const nextVal = !current
    try {
      const { error } = await supabase
        .from("notices")
        .update({ is_active: nextVal })
        .eq("id", id)

      if (error) throw error

      setNotices(prev =>
        prev.map(n => (n.id === id ? { ...n, is_active: nextVal } : n))
      )
      toast.success(nextVal ? "নোটিশ সক্রিয় করা হয়েছে (Active)" : "নোটিশ নিষ্ক্রিয় করা হয়েছে (Inactive)")
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status")
    } finally {
      setTogglingId(null)
    }
  }

  // Restore Default Template Notices
  async function handleRestoreDefaults() {
    if (!confirm("আপনি কি ৩টি স্ট্যান্ডার্ড নোটিশ টেমপ্লেট যোগ করতে চান?")) return
    setLoading(true)
    try {
      const defaults = [
        {
          title: "ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি কার্যক্রম চলমান রয়েছে।",
          content: "সকল শাখার সকল ব্যাচে নতুন সেশনের ক্লাস আগামী ১০ তারিখ হতে শুরু হবে। আসন সংখ্যা সীমিত বিধায় দ্রুত যোগাযোগ করুন।",
          is_active: true,
          notice_date: new Date().toISOString().split("T")[0],
        },
        {
          title: "এইচএসসি মডেল টেস্ট ২০২৬ এর সময়সূচি প্রকাশিত হয়েছে।",
          content: "আগামী রবিবার হতে পদার্থবিজ্ঞান ও রসায়ন মডেল টেস্টের চূড়ান্ত সময়সূচি অনুযায়ী পরীক্ষা গ্রহণ করা হবে।",
          is_active: true,
          notice_date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
        },
        {
          title: "অভিভাবক সমাবেশ ও ত্রৈমাসিক ফলাফল প্রকাশ সংক্রান্ত নোটিশ।",
          content: "সকল অভিভাবকবৃন্দকে আগামী শুক্রবারে কোচিং অডিটোরিয়ামে উপস্থিত থাকার জন্য বিনীত অনুরোধ করা হচ্ছে।",
          is_active: true,
          notice_date: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0],
        },
      ]

      const { data, error } = await supabase
        .from("notices")
        .insert(defaults)
        .select("*, branch:branches(id, name)")

      if (error) throw error
      if (data) {
        setNotices(prev => [...data, ...prev])
      }
      toast.success("ডিফল্ট নোটিশ টেমপ্লেট যুক্ত করা হয়েছে ✅")
    } catch (err: any) {
      toast.error(err.message || "Failed to restore defaults")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Bell className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Notice Board (প্রাতিষ্ঠানিক নোটিশ বোর্ড)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Manage live website notices, exam routines, admission circulars, and branch notifications.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/#notices"
            target="_blank"
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Preview on Website
          </Link>

          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Post New Notice
          </button>
        </div>
      </div>

      {/* Filter and Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Notices</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{notices.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active on Website</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Audience</p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {branches.length > 0 ? `${branches.length} Branches + Global` : "Global Campus"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-bold">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notices by title or content..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 flex-shrink-0">Branch:</span>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="px-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
          >
            <option value="all">All Branches & Global ({notices.length})</option>
            <option value="global">Global Only (All Branches)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notices List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            All Posted Notices ({filteredNotices.length})
          </span>
          {notices.length === 0 && (
            <button
              onClick={handleRestoreDefaults}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore Sample Notices
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {filteredNotices.map(notice => {
            const noticeBranch = branches.find(b => b.id === notice.branch_id)
            return (
              <div
                key={notice.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-amber-600 font-bold text-base leading-none">»</span>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">
                      {notice.title}
                    </h3>
                    {!notice.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Hidden (Inactive)
                      </span>
                    )}
                  </div>

                  {notice.content && (
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 pl-4 leading-relaxed mb-2">
                      {notice.content}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pl-4 flex-wrap text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {notice.notice_date || (notice.created_at ? new Date(notice.created_at).toLocaleDateString("en-GB") : "")}
                    </span>

                    {noticeBranch ? (
                      <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Landmark className="w-3 h-3" /> {noticeBranch.name}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Landmark className="w-3 h-3" /> Global (All Branches)
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions & Toggle */}
                <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                  {/* Active Toggle Switch */}
                  <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                    <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
                      {notice.is_active ? "Live" : "Draft"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notice.is_active}
                      disabled={togglingId === notice.id}
                      onClick={() => handleToggleActive(notice.id, notice.is_active)}
                      title={notice.is_active ? "Click to deactivate" : "Click to activate"}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        notice.is_active ? "bg-emerald-600" : "bg-slate-300"
                      } ${togglingId === notice.id ? "opacity-60 cursor-wait" : ""}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          notice.is_active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={() => openEdit(notice)}
                    className="p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 transition-all shadow-2xs"
                    title="Edit Notice"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    disabled={deletingId === notice.id}
                    onClick={() => handleDelete(notice.id, notice.title)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 transition-all shadow-2xs disabled:opacity-50"
                    title="Delete Notice"
                  >
                    {deletingId === notice.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}

          {filteredNotices.length === 0 && (
            <div className="py-14 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">কোনো নোটিশ পাওয়া যায়নি (No Notices Found)</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                {search || selectedBranch !== "all"
                  ? "আপনার অনুসন্ধানের সাথে মেলে এমন কোনো নোটিশ নেই।"
                  : "বর্তমানে কোনো নোটিশ নেই। আপনি নতুন নোটিশ প্রকাশ করতে পারেন বা ডিফল্ট টেমপ্লেট পুনরুদ্ধার করতে পারেন।"}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={openCreate}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Post Notice
                </button>
                {notices.length === 0 && (
                  <button
                    onClick={handleRestoreDefaults}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Restore Defaults
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Notice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 text-slate-900 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingNotice ? "Edit Notice (নোটিশ সম্পাদনা)" : "Post New Notice (নতুন নোটিশ প্রকাশ)"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notice Title (নোটিশের শিরোনাম) *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="যেমন: ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি চলছে..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notice Content (বিস্তারিত বিবরণ)
                </label>
                <textarea
                  rows={4}
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="নোটিশের বিস্তারিত বার্তা এখানে লিখুন..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Branch (লক্ষ্য শাখা)
                  </label>
                  <select
                    value={form.branch_id}
                    onChange={e => setForm({ ...form, branch_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Global (All Branches / সকল শাখা)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notice Date (তারিখ)
                  </label>
                  <input
                    type="date"
                    value={form.notice_date}
                    onChange={e => setForm({ ...form, notice_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Publish immediately on website (সরাসরি ওয়েবসাইটে প্রদর্শন করুন)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingNotice ? "Update Notice" : "Publish Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
