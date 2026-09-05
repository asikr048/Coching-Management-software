"use client"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  CheckCircle, XCircle, Clock, Loader2, Phone, Hash, FileText,
  AlertCircle, Filter, Banknote, Search, Copy, Check, X,
  ArrowUpDown, Calendar, DollarSign, User, BookOpen,
  GraduationCap, Eye, ChevronDown, CheckCheck, RefreshCw
} from "lucide-react"

export interface Submission {
  id: string
  student_id: string
  batch_id?: string | null
  course_id?: string | null
  fee_due_id?: string | null
  item_type?: string | null
  amount: number
  total_fee: number
  due_amount: number
  due_date: string | null
  payment_method: string
  sender_number: string | null
  transaction_id: string | null
  notes: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  student?: {
    name: string
    student_id: string
    phone: string | null
    email: string | null
    guardian_phone?: string | null
  } | null
  batch?: {
    name: string
    subject: string | null
    monthly_fee?: number | null
  } | null
  course?: {
    title: string
    category?: string | null
    price?: number | null
  } | null
}

type SortOption =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "due_desc"
  | "name_asc"
  | "name_desc"
  | "status_pending"

const methodLabels: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  upay: "Upay",
  offline: "Offline",
  cash: "Cash",
  referral: "Referral",
}

const methodColors: Record<string, string> = {
  bkash: "bg-pink-500/15 text-pink-300 border-pink-500/30 font-bold",
  nagad: "bg-orange-500/15 text-orange-300 border-orange-500/30 font-bold",
  rocket: "bg-purple-500/15 text-purple-300 border-purple-500/30 font-bold",
  upay: "bg-blue-500/15 text-blue-300 border-blue-500/30 font-bold",
  offline: "bg-slate-800 text-slate-300 border-slate-700 font-bold",
  cash: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold",
  referral: "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold",
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold",
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-amber-400" />,
  approved: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
}

function parseReferralNotes(notes?: string | null) {
  if (!notes) return null
  const refMatch = notes.match(/Referral:\s*([^|]+)/i)
  const reasonMatch = notes.match(/Reason:\s*([^)]+)/i)
  if (refMatch) {
    return {
      name: refMatch[1].trim(),
      reason: reasonMatch ? reasonMatch[1].trim() : null,
    }
  }
  return null
}

export default function ApprovalsClient({
  submissions: initial,
  canApprove,
  staffId,
}: {
  submissions: Submission[]
  canApprove: boolean
  staffId: string
}) {
  const [submissions, setSubmissions] = useState<Submission[]>(initial)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all")
  const [sortOption, setSortOption] = useState<SortOption>("date_desc")
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [approveModal, setApproveModal] = useState<Submission | null>(null)
  const [detailModal, setDetailModal] = useState<Submission | null>(null)

  function copyToClipboard(text: string, label: string) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    toast.success(`${label} copied!`)
    setTimeout(() => setCopiedText(null), 2000)
  }

  function copyFullSummary(sub: Submission) {
    const refInfo = parseReferralNotes(sub.notes)
    const activeStudentId = (sub.student?.student_id && sub.student.student_id !== "—")
      ? sub.student.student_id
      : (sub.notes?.match(/MS-[A-Z0-9]+/i)?.[0] || "—")

    const summary = [
      `--- Payment Submission Details ---`,
      `Student: ${sub.student?.name || "Unknown"} (ID: ${activeStudentId})`,
      `Phone: ${sub.student?.phone || "—"}`,
      `Item: ${sub.course?.title || sub.batch?.name || "—"} (${sub.course_id ? "Online Course" : "Batch"})`,
      `Amount Paid: ৳${sub.amount}`,
      `Remaining Due: ৳${sub.due_amount}`,
      `Method: ${methodLabels[sub.payment_method] || sub.payment_method}`,
      sub.payment_method === "referral" || refInfo ? `Referrer: ${refInfo?.name || sub.sender_number || "—"}` : null,
      refInfo?.reason ? `Referral Reason: ${refInfo.reason}` : null,
      sub.payment_method !== "referral" ? `Sender Number: ${sub.sender_number || "—"}` : null,
      `TrxID: ${sub.transaction_id || "—"}`,
      `Status: ${sub.status.toUpperCase()}`,
      `Date: ${formatDate(sub.created_at)}`,
    ].filter(Boolean).join("\n")

    navigator.clipboard.writeText(summary)
    toast.success("Complete payment summary copied to clipboard!")
  }

  // Summary counts and totals
  const stats = useMemo(() => {
    let pendingCount = 0
    let pendingTotal = 0
    let approvedCount = 0
    let approvedTotal = 0
    let rejectedCount = 0

    for (const s of submissions) {
      if (s.status === "pending") {
        pendingCount++
        pendingTotal += s.amount || 0
      } else if (s.status === "approved") {
        approvedCount++
        approvedTotal += s.amount || 0
      } else if (s.status === "rejected") {
        rejectedCount++
      }
    }

    return {
      pendingCount,
      pendingTotal,
      approvedCount,
      approvedTotal,
      rejectedCount,
      totalCount: submissions.length,
    }
  }, [submissions])

  // Filtered and sorted list
  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    // 1. Filter
    const list = submissions.filter(s => {
      // Status filter
      if (filter !== "all" && s.status !== filter) return false

      // Method filter
      if (methodFilter !== "all" && s.payment_method.toLowerCase() !== methodFilter.toLowerCase()) {
        return false
      }

      // Item type filter
      if (itemTypeFilter === "batch" && !s.batch_id && s.item_type !== "batch") return false
      if (itemTypeFilter === "course" && !s.course_id && s.item_type !== "course") return false

      // Search query across all fields
      if (!q) return true

      const studentPhone = (s.student?.phone || "").toLowerCase()
      const senderNumber = (s.sender_number || "").toLowerCase()
      const studentId = (s.student?.student_id || "").toLowerCase()
      const notesStudentId = (s.notes?.match(/MS-[A-Z0-9]+/i)?.[0] || "").toLowerCase()
      const trxId = (s.transaction_id || "").toLowerCase()
      const studentName = (s.student?.name || "").toLowerCase()
      const studentEmail = (s.student?.email || "").toLowerCase()
      const guardianPhone = (s.student?.guardian_phone || "").toLowerCase()
      const batchName = (s.batch?.name || "").toLowerCase()
      const batchSubject = (s.batch?.subject || "").toLowerCase()
      const courseTitle = (s.course?.title || "").toLowerCase()
      const courseCategory = (s.course?.category || "").toLowerCase()
      const subId = (s.id || "").toLowerCase()
      const method = (s.payment_method || "").toLowerCase()
      const notes = (s.notes || "").toLowerCase()
      const reason = (s.rejection_reason || "").toLowerCase()
      const amountStr = String(s.amount || "")
      const dueStr = String(s.due_amount || "")

      return (
        studentPhone.includes(q) ||
        senderNumber.includes(q) ||
        studentId.includes(q) ||
        notesStudentId.includes(q) ||
        trxId.includes(q) ||
        studentName.includes(q) ||
        studentEmail.includes(q) ||
        guardianPhone.includes(q) ||
        batchName.includes(q) ||
        batchSubject.includes(q) ||
        courseTitle.includes(q) ||
        courseCategory.includes(q) ||
        subId.includes(q) ||
        method.includes(q) ||
        notes.includes(q) ||
        reason.includes(q) ||
        amountStr.includes(q) ||
        dueStr.includes(q)
      )
    })

    // 2. Sort
    list.sort((a, b) => {
      switch (sortOption) {
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "date_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "amount_desc":
          return (b.amount || 0) - (a.amount || 0)
        case "amount_asc":
          return (a.amount || 0) - (b.amount || 0)
        case "due_desc":
          return (b.due_amount || 0) - (a.due_amount || 0)
        case "name_asc":
          return (a.student?.name || "").localeCompare(b.student?.name || "")
        case "name_desc":
          return (b.student?.name || "").localeCompare(a.student?.name || "")
        case "status_pending":
          if (a.status === "pending" && b.status !== "pending") return -1
          if (b.status === "pending" && a.status !== "pending") return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return list
  }, [submissions, filter, methodFilter, itemTypeFilter, sortOption, searchQuery])

  // Approve action handler via API
  async function handleApprove(id: string, sub: Submission) {
    setProcessing(id)
    try {
      const res = await fetch("/api/payments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: id, staffId }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to approve payment")
      }

      setSubmissions(prev =>
        prev.map(s =>
          s.id === id
            ? {
                ...s,
                status: "approved",
                approved_by: staffId,
                approved_at: data.approvedAt || new Date().toISOString(),
              }
            : s
        )
      )

      toast.success("Payment approved successfully! Student access activated.")
      setApproveModal(null)
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve payment")
    } finally {
      setProcessing(null)
    }
  }

  // Reject action handler via API
  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      toast.error("Please enter a reason for rejection")
      return
    }

    setProcessing(id)
    try {
      const res = await fetch("/api/payments/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          staffId,
          reason: rejectReason.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject payment")
      }

      setSubmissions(prev =>
        prev.map(s =>
          s.id === id
            ? {
                ...s,
                status: "rejected",
                rejection_reason: rejectReason.trim(),
                approved_by: staffId,
                approved_at: new Date().toISOString(),
              }
            : s
        )
      )

      toast.success("Payment submission marked as rejected.")
      setRejectModal(null)
      setRejectReason("")
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject payment")
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. KPI Statistics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={() => setFilter("pending")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            filter === "pending"
              ? "border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/30 shadow-lg"
              : "border-slate-800 bg-slate-900/90 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Review</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-amber-300 mt-1">{stats.pendingCount}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Awaiting: <span className="font-bold text-amber-400">{formatCurrency(stats.pendingTotal)}</span>
          </p>
        </div>

        <div
          onClick={() => setFilter("approved")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            filter === "approved"
              ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/30 shadow-lg"
              : "border-slate-800 bg-slate-900/90 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Approved</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-300 mt-1">{stats.approvedCount}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Collected: <span className="font-bold text-emerald-400">{formatCurrency(stats.approvedTotal)}</span>
          </p>
        </div>

        <div
          onClick={() => setFilter("rejected")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            filter === "rejected"
              ? "border-rose-400 bg-rose-500/10 ring-1 ring-rose-400/30 shadow-lg"
              : "border-slate-800 bg-slate-900/90 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-300 mt-1">{stats.rejectedCount}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Disapproved submissions</p>
        </div>

        <div
          onClick={() => setFilter("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            filter === "all"
              ? "border-amber-400 bg-slate-800 ring-1 ring-amber-400/30 shadow-lg"
              : "border-slate-800 bg-slate-900/90 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Total Submissions</span>
            <Banknote className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1">{stats.totalCount}</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">All time submissions</p>
        </div>
      </div>

      {/* 2. Search, Sort & Filter Control Panel */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3.5">
        {/* Real-time search across number, payment sender number, student ID, TrxID, name */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by student phone, sender number, student ID (MS-...), TrxID, name, batch, course..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-800">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5 flex-shrink-0" />
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  filter === f
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    filter === f ? "bg-slate-950/30 text-slate-950" : "bg-slate-900 text-slate-300"
                  }`}
                >
                  {f === "pending"
                    ? stats.pendingCount
                    : f === "approved"
                    ? stats.approvedCount
                    : f === "rejected"
                    ? stats.rejectedCount
                    : stats.totalCount}
                </span>
              </button>
            ))}
          </div>

          {/* Sort & Method & Type Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <label htmlFor="sort-select" className="text-slate-400 font-medium">
                Sort:
              </label>
              <select
                id="sort-select"
                value={sortOption}
                onChange={e => setSortOption(e.target.value as SortOption)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="date_desc" className="bg-slate-900 text-white">Date: Newest First</option>
                <option value="date_asc" className="bg-slate-900 text-white">Date: Oldest First</option>
                <option value="amount_desc" className="bg-slate-900 text-white">Amount: High to Low (৳↓)</option>
                <option value="amount_asc" className="bg-slate-900 text-white">Amount: Low to High (৳↑)</option>
                <option value="due_desc" className="bg-slate-900 text-white">Due: High to Low</option>
                <option value="name_asc" className="bg-slate-900 text-white">Student: A → Z</option>
                <option value="name_desc" className="bg-slate-900 text-white">Student: Z → A</option>
                <option value="status_pending" className="bg-slate-900 text-white">Status: Pending First</option>
              </select>
            </div>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Methods</option>
              <option value="bkash" className="bg-slate-900 text-white">bKash</option>
              <option value="nagad" className="bg-slate-900 text-white">Nagad</option>
              <option value="rocket" className="bg-slate-900 text-white">Rocket</option>
              <option value="upay" className="bg-slate-900 text-white">Upay</option>
              <option value="offline" className="bg-slate-900 text-white">Offline / Cash</option>
              <option value="referral" className="bg-slate-900 text-white">Referral / Waiver</option>
            </select>

            {/* Item Type Filter */}
            <select
              value={itemTypeFilter}
              onChange={e => setItemTypeFilter(e.target.value)}
              className="text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Types</option>
              <option value="batch" className="bg-slate-900 text-white">Batches Only</option>
              <option value="course" className="bg-slate-900 text-white">Courses Only</option>
            </select>
          </div>
        </div>

        {/* Results Counter and Active Filter Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
          <div>
            Showing <strong className="text-white font-bold">{filteredAndSorted.length}</strong> of{" "}
            <span className="font-semibold text-slate-300">{submissions.length}</span> submissions
            {searchQuery && (
              <span className="ml-1 text-amber-400 font-medium">
                matching &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>

          {(searchQuery || methodFilter !== "all" || itemTypeFilter !== "all" || filter !== "pending") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setMethodFilter("all")
                setItemTypeFilter("all")
                setFilter("pending")
                setSortOption("date_desc")
              }}
              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Submissions List */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 text-center py-16 px-4 text-slate-400 shadow-xl">
          <Banknote className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
          <p className="font-bold text-white text-base">No payment submissions found</p>
          <p className="text-xs mt-1 text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No payment matches "${searchQuery}". Try searching with a different student phone, sender number, student ID, or TrxID.`
              : filter === "pending"
              ? "All caught up! There are currently no pending payments waiting for review."
              : "No submissions match the current filters. Try changing or clearing filters."}
          </p>
          {(searchQuery || methodFilter !== "all" || itemTypeFilter !== "all" || filter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setMethodFilter("all")
                setItemTypeFilter("all")
                setFilter("all")
              }}
              className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-700"
            >
              Show All Submissions
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredAndSorted.map(sub => {
            const isCourse = !!sub.course_id || sub.item_type === "course"
            const itemLabel = isCourse
              ? sub.course?.title || "Online Course"
              : sub.batch?.name || "Batch Enrollment"

            return (
              <div
                key={sub.id}
                className={`bg-slate-900/90 backdrop-blur-md rounded-2xl border p-5 transition-all hover:shadow-xl ${
                  sub.status === "pending"
                    ? "border-slate-800 border-l-4 border-l-amber-400"
                    : sub.status === "approved"
                    ? "border-slate-800 border-l-4 border-l-emerald-500"
                    : "border-slate-800 border-l-4 border-l-rose-500"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Student & Payment Info */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row: Student Avatar, Name, ID, Phone, Status Pill */}
                    <div className="flex flex-wrap items-center gap-3 mb-2.5">
                      <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
                        {sub.student?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white text-base">{sub.student?.name || "Unknown Student"}</p>
                          {(() => {
                            const activeStudentId = (sub.student?.student_id && sub.student.student_id !== "—")
                              ? sub.student.student_id
                              : (sub.notes?.match(/MS-[A-Z0-9]+/i)?.[0] || null)

                            if (!activeStudentId) return null

                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-800 text-amber-300 rounded-lg text-xs font-mono font-bold border border-slate-700">
                                {activeStudentId}
                                <button
                                  onClick={() => copyToClipboard(activeStudentId, "Student ID")}
                                  className="hover:text-white cursor-pointer p-0.5 text-amber-400"
                                  title="Copy Student ID"
                                >
                                  {copiedText === activeStudentId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </span>
                            )
                          })()}
                        </div>

                        {sub.student?.phone && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>Student Phone: <strong className="text-slate-200">{sub.student.phone}</strong></span>
                            <button
                              onClick={() => copyToClipboard(sub.student!.phone!, "Student phone")}
                              className="hover:text-white cursor-pointer p-0.5 text-slate-400"
                              title="Copy student phone"
                            >
                              {copiedText === sub.student.phone ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ml-auto sm:ml-0 ${
                          statusColors[sub.status] || "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {statusIcons[sub.status]}
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </span>
                    </div>

                    {/* Details 4-Column Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3 pt-3 border-t border-slate-800">
                      {/* Enrolled Item */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">
                          {isCourse ? "Course" : "Batch"}
                        </p>
                        <div className="font-semibold text-white truncate flex items-center gap-1.5" title={itemLabel}>
                          {isCourse ? (
                            <span className="text-purple-300 flex items-center gap-1 truncate font-bold">
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                Course
                              </span>
                              <span className="truncate">{sub.course?.title || "Online Course"}</span>
                            </span>
                          ) : (
                            <span className="text-amber-300 flex items-center gap-1 truncate font-bold">
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Batch
                              </span>
                              <span className="truncate">{sub.batch?.name || "Batch"}</span>
                            </span>
                          )}
                        </div>
                        {sub.batch?.subject && !isCourse && (
                          <p className="text-[11px] text-slate-400 truncate">{sub.batch.subject}</p>
                        )}
                      </div>

                      {/* Amount Paid */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Amount Paid</p>
                        <p className="text-base font-extrabold text-emerald-400 tracking-tight">
                          {formatCurrency(sub.amount)}
                        </p>
                        {sub.total_fee > sub.amount && (
                          <p className="text-[11px] text-slate-400">Total: {formatCurrency(sub.total_fee)}</p>
                        )}
                      </div>

                      {/* Due Remaining */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Due Remaining</p>
                        <p
                          className={`text-base font-bold ${
                            sub.due_amount > 0 ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {sub.due_amount > 0 ? formatCurrency(sub.due_amount) : "৳0 (Paid)"}
                        </p>
                        {sub.due_amount > 0 && sub.due_date && (
                          <p className="text-[11px] text-rose-400">Due by {formatDate(sub.due_date)}</p>
                        )}
                      </div>

                      {/* Payment Method */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-0.5">Payment Method</p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            methodColors[sub.payment_method] || "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {methodLabels[sub.payment_method] || sub.payment_method}
                        </span>
                      </div>
                    </div>

                    {/* Sender Number, TrxID & Quick Copy Chips */}
                    <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-2 text-xs">
                      {/* Sender Phone or Referrer Student */}
                      {sub.sender_number && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-semibold border ${
                          sub.payment_method === "referral"
                            ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                            : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                        }`}>
                          {sub.payment_method === "referral" ? (
                            <User className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>
                            {sub.payment_method === "referral" ? "Referrer: " : "Sender: "}
                            <strong className="text-white">{sub.sender_number}</strong>
                          </span>
                          <button
                            onClick={() => copyToClipboard(sub.sender_number!, sub.payment_method === "referral" ? "Referrer info" : "Sender number")}
                            className={`p-0.5 cursor-pointer ${sub.payment_method === "referral" ? "text-purple-400 hover:text-purple-200" : "text-amber-400 hover:text-amber-200"}`}
                            title={sub.payment_method === "referral" ? "Copy Referrer" : "Copy sender number"}
                          >
                            {copiedText === sub.sender_number ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      )}

                      {/* Referral Reason Chip if applicable */}
                      {(() => {
                        const ref = parseReferralNotes(sub.notes)
                        if (!ref?.reason) return null
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium">
                            <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                            <span>Reason: <strong className="text-white">{ref.reason}</strong></span>
                          </span>
                        )
                      })()}

                      {/* TrxID */}
                      {sub.transaction_id && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg font-mono font-semibold">
                          <Hash className="w-3.5 h-3.5 text-amber-400" />
                          <span>TrxID: <strong className="text-amber-300 font-bold">{sub.transaction_id}</strong></span>
                          <button
                            onClick={() => copyToClipboard(sub.transaction_id!, "Transaction ID")}
                            className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                            title="Copy Transaction ID"
                          >
                            {copiedText === sub.transaction_id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      )}

                      {/* Notes snippet */}
                      {sub.notes && (
                        <span className="flex items-center gap-1 text-slate-400 max-w-xs truncate" title={sub.notes}>
                          <FileText className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{sub.notes}</span>
                        </span>
                      )}

                      {/* Submission Date */}
                      <span className="text-slate-500 ml-auto flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {formatDate(sub.created_at)}
                      </span>
                    </div>

                    {/* Rejection Alert if rejected */}
                    {sub.status === "rejected" && sub.rejection_reason && (
                      <div className="mt-2.5 flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-300">Rejection Reason:</p>
                          <p className="text-xs text-rose-400/90">{sub.rejection_reason}</p>
                        </div>
                      </div>
                    )}

                    {/* Approved details if approved */}
                    {sub.status === "approved" && sub.approved_at && (
                      <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Approved on {formatDate(sub.approved_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Action Buttons */}
                  <div className="flex lg:flex-col items-center justify-end gap-2 lg:min-w-[140px] pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    {sub.status === "pending" && canApprove ? (
                      <>
                        <button
                          onClick={() => setApproveModal(sub)}
                          disabled={processing === sub.id}
                          className="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-sm font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                        >
                          {processing === sub.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectModal(sub.id)
                            setRejectReason("")
                          }}
                          disabled={processing === sub.id}
                          className="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-rose-500/30 bg-rose-500/10 text-rose-300 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDetailModal(sub)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" /> View Details
                      </button>
                    )}

                    <button
                      onClick={() => copyFullSummary(sub)}
                      className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-white text-[11px] font-medium hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Copy full payment summary"
                    >
                      <Copy className="w-3 h-3" /> Copy Summary
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Approve Confirmation Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-950 border-b border-slate-800 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Payment Approval</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Review student credentials before authorizing admission</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Student Summary */}
              <div className="flex items-center gap-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-amber-400 font-bold flex-shrink-0">
                  {approveModal.student?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm">{approveModal.student?.name || "Student"}</p>
                  <p className="text-xs text-amber-400/90 font-mono mt-0.5">
                    {approveModal.student?.student_id} · <span className="text-slate-400">{approveModal.student?.phone || "No phone"}</span>
                  </p>
                </div>
              </div>

              {/* Amount cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Amount Paid</p>
                  <p className="text-xl font-black text-emerald-300 mt-0.5">
                    {formatCurrency(approveModal.amount)}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remaining Due</p>
                  <p
                    className={`text-xl font-black mt-0.5 ${
                      approveModal.due_amount > 0 ? "text-rose-400" : "text-slate-500"
                    }`}
                  >
                    {formatCurrency(approveModal.due_amount)}
                  </p>
                </div>
              </div>

              {/* Transaction details breakdown */}
              <div className="space-y-2 text-xs divide-y divide-slate-800">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Enrolled Item</span>
                  <span className="font-bold text-white">
                    {approveModal.course?.title || approveModal.batch?.name || "Enrollment"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Payment Gateway</span>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full font-bold text-xs border ${
                      methodColors[approveModal.payment_method] || "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {methodLabels[approveModal.payment_method] || approveModal.payment_method}
                  </span>
                </div>

                {approveModal.sender_number && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-400">
                      {approveModal.payment_method === "referral" ? "Referrer Student / ID" : "Sender Number"}
                    </span>
                    <span className={`font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                      approveModal.payment_method === "referral"
                        ? "text-purple-300 bg-purple-500/15 border-purple-500/30"
                        : "text-amber-300 bg-amber-500/15 border-amber-500/30"
                    }`}>
                      {approveModal.sender_number}
                    </span>
                  </div>
                )}

                {(() => {
                  const ref = parseReferralNotes(approveModal.notes)
                  if (!ref) return null
                  return (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs space-y-1 my-1">
                      <p className="font-bold text-purple-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-400" /> Referral / Waiver Details
                      </p>
                      <p className="text-slate-300">
                        Referrer: <strong className="font-mono text-purple-200">{ref.name}</strong>
                      </p>
                      {ref.reason && (
                        <p className="text-slate-400">
                          Reason: <span className="text-purple-300">{ref.reason}</span>
                        </p>
                      )}
                    </div>
                  )
                })()}

                {approveModal.transaction_id && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-400">Transaction ID (TrxID)</span>
                    <span className="font-mono font-bold text-amber-300 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                      {approveModal.transaction_id}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Submitted At</span>
                  <span className="text-slate-300">{formatDate(approveModal.created_at)}</span>
                </div>
              </div>

              {/* Informational Alert */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p>
                  Approving will automatically activate the student&apos;s enrollment, generate an official financial
                  receipt, increment the seat counter, and open dashboard access.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setApproveModal(null)}
                  className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApprove(approveModal.id, approveModal)}
                  disabled={processing === approveModal.id}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 text-sm"
                >
                  {processing === approveModal.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Confirm Approval
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Reject Payment Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center gap-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Reject Payment Submission</h3>
            </div>

            <p className="text-xs text-slate-400">
              Please specify the reason for rejecting this payment (e.g. invalid TrxID, sender number mismatch,
              incorrect amount).
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-700 bg-slate-950 rounded-xl text-sm text-white focus:outline-none focus:border-rose-400 placeholder:text-slate-500"
                placeholder="e.g. TrxID not found on bKash statement, amount mismatch..."
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => {
                  setRejectModal(null)
                  setRejectReason("")
                }}
                className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectModal)}
                disabled={processing === rejectModal || !rejectReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20 text-sm"
              >
                {processing === rejectModal ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Rejecting...
                  </>
                ) : (
                  "Reject Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Full Details View Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-white">
            <div className="bg-gradient-to-r from-slate-900 via-[#0f172a] to-slate-950 border-b border-slate-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Banknote className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold">Payment Details</h3>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Status Header */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="font-bold text-slate-300 uppercase tracking-wider">Submission Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    statusColors[detailModal.status]
                  }`}
                >
                  {statusIcons[detailModal.status]}
                  {detailModal.status.toUpperCase()}
                </span>
              </div>

              {/* Student info */}
              <div className="space-y-2 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <p className="font-bold text-white text-sm">{detailModal.student?.name || "Unknown Student"}</p>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <p>Student ID: <strong className="font-mono text-amber-300">{detailModal.student?.student_id || "—"}</strong></p>
                  <p>Phone: <strong className="font-mono text-slate-200">{detailModal.student?.phone || "—"}</strong></p>
                  {detailModal.student?.email && <p className="col-span-2">Email: {detailModal.student.email}</p>}
                  {detailModal.student?.guardian_phone && (
                    <p className="col-span-2">Guardian Phone: {detailModal.student.guardian_phone}</p>
                  )}
                </div>
              </div>

              {/* Payment Financial Breakdown */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <p className="text-[10px] uppercase font-bold text-emerald-400">Amount Paid</p>
                  <p className="text-base font-extrabold text-emerald-300 mt-0.5">{formatCurrency(detailModal.amount)}</p>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Fee</p>
                  <p className="text-base font-bold text-white mt-0.5">{formatCurrency(detailModal.total_fee)}</p>
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                  <p className="text-[10px] uppercase font-bold text-rose-400">Due Amount</p>
                  <p className="text-base font-extrabold text-rose-300 mt-0.5">{formatCurrency(detailModal.due_amount)}</p>
                </div>
              </div>

              {/* Transaction Meta */}
              <div className="space-y-2 divide-y divide-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Method</span>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full font-bold text-xs border ${methodColors[detailModal.payment_method] || "bg-slate-800 text-slate-300"}`}>
                    {methodLabels[detailModal.payment_method] || detailModal.payment_method}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">
                    {detailModal.payment_method === "referral" ? "Referrer Student / ID" : "Sender Number"}
                  </span>
                  <span className="font-mono font-bold text-white">{detailModal.sender_number || "—"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Transaction ID (TrxID)</span>
                  <span className="font-mono font-bold text-amber-300">{detailModal.transaction_id || "—"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Item Enrolled</span>
                  <span className="font-bold text-white">{detailModal.course?.title || detailModal.batch?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Submitted On</span>
                  <span className="text-slate-300">{formatDate(detailModal.created_at)}</span>
                </div>
                {detailModal.approved_at && (
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Approved On</span>
                    <span className="text-emerald-400 font-semibold">{formatDate(detailModal.approved_at)}</span>
                  </div>
                )}
                {detailModal.rejection_reason && (
                  <div className="flex justify-between py-2">
                    <span className="text-rose-400 font-bold">Rejection Reason</span>
                    <span className="text-rose-300">{detailModal.rejection_reason}</span>
                  </div>
                )}
                {detailModal.notes && (
                  <div className="py-2">
                    <span className="text-slate-400 block mb-1">Notes</span>
                    <p className="text-slate-200 bg-slate-950 border border-slate-800 p-2.5 rounded-xl">{detailModal.notes}</p>
                  </div>
                )}

                {(() => {
                  const ref = parseReferralNotes(detailModal.notes)
                  if (!ref && detailModal.payment_method !== "referral") return null
                  return (
                    <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1.5 mt-2">
                      <p className="font-bold text-purple-300 flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-purple-400" /> Referral / Waiver Details
                      </p>
                      <p className="text-slate-300 text-xs">
                        Referrer: <strong className="font-mono text-purple-200">{ref?.name || detailModal.sender_number || "—"}</strong>
                      </p>
                      {ref?.reason && (
                        <p className="text-slate-400 text-xs">
                          Reason: <span className="text-purple-300">{ref.reason}</span>
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Copy Full summary button */}
              <button
                onClick={() => copyFullSummary(detailModal)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy Complete Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
