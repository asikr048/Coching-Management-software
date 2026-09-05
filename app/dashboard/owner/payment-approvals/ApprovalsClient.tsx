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
  bkash: "bg-pink-50 text-pink-700 border-pink-200",
  nagad: "bg-orange-50 text-orange-700 border-orange-200",
  rocket: "bg-purple-50 text-purple-700 border-purple-200",
  upay: "bg-blue-50 text-blue-700 border-blue-200",
  offline: "bg-gray-100 text-gray-700 border-gray-200",
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  referral: "bg-purple-100 text-purple-800 border-purple-300 font-bold",
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-amber-600" />,
  approved: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-red-600" />,
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
    const summary = [
      `--- Payment Submission Details ---`,
      `Student: ${sub.student?.name || "Unknown"} (ID: ${sub.student?.student_id || "—"})`,
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
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "pending"
              ? "border-amber-400 ring-2 ring-amber-200 shadow-sm"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending Review</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-1">{stats.pendingCount}</p>
          <p className="text-xs text-amber-700 font-medium mt-0.5">
            Awaiting: <span className="font-bold">{formatCurrency(stats.pendingTotal)}</span>
          </p>
        </div>

        <div
          onClick={() => setFilter("approved")}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "approved"
              ? "border-emerald-400 ring-2 ring-emerald-200 shadow-sm"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Approved</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-900 mt-1">{stats.approvedCount}</p>
          <p className="text-xs text-emerald-700 font-medium mt-0.5">
            Collected: <span className="font-bold">{formatCurrency(stats.approvedTotal)}</span>
          </p>
        </div>

        <div
          onClick={() => setFilter("rejected")}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "rejected"
              ? "border-red-400 ring-2 ring-red-200 shadow-sm"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">Rejected</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-extrabold text-red-900 mt-1">{stats.rejectedCount}</p>
          <p className="text-xs text-red-700 font-medium mt-0.5">Disapproved submissions</p>
        </div>

        <div
          onClick={() => setFilter("all")}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "all"
              ? "border-indigo-400 ring-2 ring-indigo-200 shadow-sm"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Total Submissions</span>
            <Banknote className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-900 mt-1">{stats.totalCount}</p>
          <p className="text-xs text-indigo-700 font-medium mt-0.5">All time submissions</p>
        </div>
      </div>

      {/* 2. Search, Sort & Filter Control Panel */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3.5">
        {/* Real-time search across number, payment sender number, student ID, TrxID, name */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by student phone, sender number, student ID (MS-...), TrxID, name, batch, course..."
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder-gray-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-md cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-gray-100">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <Filter className="w-3.5 h-3.5 text-gray-400 mr-0.5 flex-shrink-0" />
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  filter === f
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filter === f ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"
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
            <div className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <label htmlFor="sort-select" className="text-gray-500 font-medium">
                Sort:
              </label>
              <select
                id="sort-select"
                value={sortOption}
                onChange={e => setSortOption(e.target.value as SortOption)}
                className="bg-transparent text-gray-900 font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="date_desc">Date: Newest First</option>
                <option value="date_asc">Date: Oldest First</option>
                <option value="amount_desc">Amount: High to Low (৳↓)</option>
                <option value="amount_asc">Amount: Low to High (৳↑)</option>
                <option value="due_desc">Due: High to Low</option>
                <option value="name_asc">Student: A → Z</option>
                <option value="name_desc">Student: Z → A</option>
                <option value="status_pending">Status: Pending First</option>
              </select>
            </div>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="rocket">Rocket</option>
              <option value="upay">Upay</option>
              <option value="offline">Offline / Cash</option>
              <option value="referral">Referral / Waiver</option>
            </select>

            {/* Item Type Filter */}
            <select
              value={itemTypeFilter}
              onChange={e => setItemTypeFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="batch">Batches Only</option>
              <option value="course">Courses Only</option>
            </select>
          </div>
        </div>

        {/* Results Counter and Active Filter Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-gray-500">
          <div>
            Showing <strong className="text-gray-900 font-bold">{filteredAndSorted.length}</strong> of{" "}
            <span className="font-semibold">{submissions.length}</span> submissions
            {searchQuery && (
              <span className="ml-1 text-indigo-600 font-medium">
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
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Submissions List */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 text-center py-16 px-4 text-gray-400 shadow-xs">
          <Banknote className="w-12 h-12 mx-auto mb-3 opacity-40 text-gray-400" />
          <p className="font-semibold text-gray-800 text-base">No payment submissions found</p>
          <p className="text-xs mt-1 text-gray-500 max-w-md mx-auto">
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
              className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
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
                className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-md ${
                  sub.status === "pending"
                    ? "border-amber-200 border-l-4 border-l-amber-500"
                    : sub.status === "approved"
                    ? "border-emerald-100 border-l-4 border-l-emerald-500"
                    : "border-gray-200 border-l-4 border-l-red-400"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Student & Payment Info */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row: Student Avatar, Name, ID, Phone, Status Pill */}
                    <div className="flex flex-wrap items-center gap-3 mb-2.5">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                        {sub.student?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-900 text-base">{sub.student?.name || "Unknown Student"}</p>
                          {sub.student?.student_id && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-mono font-bold border border-indigo-100">
                              {sub.student.student_id}
                              <button
                                onClick={() => copyToClipboard(sub.student!.student_id, "Student ID")}
                                className="hover:text-indigo-950 cursor-pointer p-0.5"
                                title="Copy Student ID"
                              >
                                {copiedText === sub.student.student_id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-indigo-400" />
                                )}
                              </button>
                            </span>
                          )}
                        </div>

                        {sub.student?.phone && (
                          <div className="text-xs text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span>Student Phone: <strong>{sub.student.phone}</strong></span>
                            <button
                              onClick={() => copyToClipboard(sub.student!.phone!, "Student phone")}
                              className="hover:text-gray-700 cursor-pointer p-0.5 text-gray-400"
                              title="Copy student phone"
                            >
                              {copiedText === sub.student.phone ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ml-auto sm:ml-0 ${
                          statusColors[sub.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {statusIcons[sub.status]}
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </span>
                    </div>

                    {/* Details 4-Column Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3 pt-3 border-t border-gray-100">
                      {/* Enrolled Item */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-0.5">
                          {isCourse ? "Course" : "Batch"}
                        </p>
                        <div className="font-semibold text-gray-900 truncate flex items-center gap-1.5" title={itemLabel}>
                          {isCourse ? (
                            <span className="text-purple-700 flex items-center gap-1 truncate font-semibold">
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                Course
                              </span>
                              <span className="truncate">{sub.course?.title || "Online Course"}</span>
                            </span>
                          ) : (
                            <span className="text-indigo-900 flex items-center gap-1 truncate font-semibold">
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                Batch
                              </span>
                              <span className="truncate">{sub.batch?.name || "Batch"}</span>
                            </span>
                          )}
                        </div>
                        {sub.batch?.subject && !isCourse && (
                          <p className="text-[11px] text-gray-500 truncate">{sub.batch.subject}</p>
                        )}
                      </div>

                      {/* Amount Paid */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-0.5">Amount Paid</p>
                        <p className="text-base font-extrabold text-emerald-600 tracking-tight">
                          {formatCurrency(sub.amount)}
                        </p>
                        {sub.total_fee > sub.amount && (
                          <p className="text-[11px] text-gray-400">Total: {formatCurrency(sub.total_fee)}</p>
                        )}
                      </div>

                      {/* Due Remaining */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-0.5">Due Remaining</p>
                        <p
                          className={`text-base font-bold ${
                            sub.due_amount > 0 ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          {sub.due_amount > 0 ? formatCurrency(sub.due_amount) : "৳0 (Paid)"}
                        </p>
                        {sub.due_amount > 0 && sub.due_date && (
                          <p className="text-[11px] text-red-500">Due by {formatDate(sub.due_date)}</p>
                        )}
                      </div>

                      {/* Payment Method */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-0.5">Payment Method</p>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            methodColors[sub.payment_method] || "bg-gray-100 text-gray-700 border-gray-200"
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
                            ? "bg-purple-50 border-purple-200 text-purple-900"
                            : "bg-amber-50/80 border-amber-200 text-amber-900"
                        }`}>
                          {sub.payment_method === "referral" ? (
                            <User className="w-3.5 h-3.5 text-purple-600" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>
                            {sub.payment_method === "referral" ? "Referrer: " : "Sender: "}
                            <strong>{sub.sender_number}</strong>
                          </span>
                          <button
                            onClick={() => copyToClipboard(sub.sender_number!, sub.payment_method === "referral" ? "Referrer info" : "Sender number")}
                            className={`p-0.5 cursor-pointer ${sub.payment_method === "referral" ? "text-purple-600 hover:text-purple-800" : "text-amber-600 hover:text-amber-800"}`}
                            title={sub.payment_method === "referral" ? "Copy Referrer" : "Copy sender number"}
                          >
                            {copiedText === sub.sender_number ? (
                              <Check className="w-3 h-3 text-emerald-600" />
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-900 rounded-lg text-xs font-medium">
                            <FileText className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                            <span>Reason: <strong>{ref.reason}</strong></span>
                          </span>
                        )
                      })()}

                      {/* TrxID */}
                      {sub.transaction_id && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg font-mono font-semibold">
                          <Hash className="w-3.5 h-3.5 text-indigo-600" />
                          <span>TrxID: <strong className="text-indigo-950 font-bold">{sub.transaction_id}</strong></span>
                          <button
                            onClick={() => copyToClipboard(sub.transaction_id!, "Transaction ID")}
                            className="p-0.5 text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            title="Copy Transaction ID"
                          >
                            {copiedText === sub.transaction_id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </span>
                      )}

                      {/* Notes snippet */}
                      {sub.notes && (
                        <span className="flex items-center gap-1 text-gray-500 max-w-xs truncate" title={sub.notes}>
                          <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{sub.notes}</span>
                        </span>
                      )}

                      {/* Submission Date */}
                      <span className="text-gray-400 ml-auto flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(sub.created_at)}
                      </span>
                    </div>

                    {/* Rejection Alert if rejected */}
                    {sub.status === "rejected" && sub.rejection_reason && (
                      <div className="mt-2.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-800">Rejection Reason:</p>
                          <p className="text-xs text-red-700">{sub.rejection_reason}</p>
                        </div>
                      </div>
                    )}

                    {/* Approved details if approved */}
                    {sub.status === "approved" && sub.approved_at && (
                      <div className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Approved on {formatDate(sub.approved_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Action Buttons */}
                  <div className="flex lg:flex-col items-center justify-end gap-2 lg:min-w-[140px] pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    {sub.status === "pending" && canApprove ? (
                      <>
                        <button
                          onClick={() => setApproveModal(sub)}
                          disabled={processing === sub.id}
                          className="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
                          className="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDetailModal(sub)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-500" /> View Details
                      </button>
                    )}

                    <button
                      onClick={() => copyFullSummary(sub)}
                      className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-gray-500 hover:text-gray-800 text-[11px] font-medium hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Confirm Payment Approval</h3>
                  <p className="text-emerald-100 text-xs">Review student details before confirming admission</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Student Summary */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold flex-shrink-0">
                  {approveModal.student?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{approveModal.student?.name || "Student"}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {approveModal.student?.student_id} · {approveModal.student?.phone || "No phone"}
                  </p>
                </div>
              </div>

              {/* Amount cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">Amount Paid</p>
                  <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                    {formatCurrency(approveModal.amount)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Remaining Due</p>
                  <p
                    className={`text-xl font-extrabold mt-0.5 ${
                      approveModal.due_amount > 0 ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {formatCurrency(approveModal.due_amount)}
                  </p>
                </div>
              </div>

              {/* Transaction details breakdown */}
              <div className="space-y-2 text-xs divide-y divide-gray-100">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-gray-500">Enrolled Item</span>
                  <span className="font-bold text-gray-900">
                    {approveModal.course?.title || approveModal.batch?.name || "Enrollment"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-gray-500">Payment Gateway</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md font-bold text-xs border ${
                      methodColors[approveModal.payment_method] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {methodLabels[approveModal.payment_method] || approveModal.payment_method}
                  </span>
                </div>

                {approveModal.sender_number && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-gray-500">
                      {approveModal.payment_method === "referral" ? "Referrer Student / ID" : "Sender Number"}
                    </span>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                      approveModal.payment_method === "referral"
                        ? "text-purple-900 bg-purple-50 border-purple-200"
                        : "text-amber-900 bg-amber-50 border-amber-200"
                    }`}>
                      {approveModal.sender_number}
                    </span>
                  </div>
                )}

                {(() => {
                  const ref = parseReferralNotes(approveModal.notes)
                  if (!ref) return null
                  return (
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1 my-1">
                      <p className="font-bold text-purple-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-purple-600" /> Referral / Waiver Details
                      </p>
                      <p className="text-purple-800">
                        Referrer: <strong className="font-mono">{ref.name}</strong>
                      </p>
                      {ref.reason && (
                        <p className="text-purple-700">
                          Reason: <span>{ref.reason}</span>
                        </p>
                      )}
                    </div>
                  )
                })()}

                {approveModal.transaction_id && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-gray-500">Transaction ID (TrxID)</span>
                    <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {approveModal.transaction_id}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-gray-500">Submitted At</span>
                  <span className="text-gray-700">{formatDate(approveModal.created_at)}</span>
                </div>
              </div>

              {/* Informational Alert */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p>
                  Approving will automatically activate the student&apos;s enrollment, create an official payment
                  receipt, increment the seat count, and grant the student access.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setApproveModal(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApprove(approveModal.id, approveModal)}
                  disabled={processing === approveModal.id}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs text-sm"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-gray-900">Reject Payment Submission</h3>
            </div>

            <p className="text-xs text-gray-500">
              Please specify the reason for rejecting this payment (e.g. invalid TrxID, sender number mismatch,
              incorrect amount).
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
                placeholder="e.g. TrxID not found on bKash statement, amount mismatch..."
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => {
                  setRejectModal(null)
                  setRejectReason("")
                }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectModal)}
                disabled={processing === rejectModal || !rejectReason.trim()}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs text-sm"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-gray-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold">Payment Details</h3>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Status Header */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="font-bold text-gray-700 uppercase tracking-wider">Submission Status</span>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                    statusColors[detailModal.status]
                  }`}
                >
                  {statusIcons[detailModal.status]}
                  {detailModal.status.toUpperCase()}
                </span>
              </div>

              {/* Student info */}
              <div className="space-y-1.5 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <p className="font-bold text-indigo-900 text-sm">{detailModal.student?.name || "Unknown Student"}</p>
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  <p>Student ID: <strong className="font-mono text-gray-900">{detailModal.student?.student_id || "—"}</strong></p>
                  <p>Phone: <strong className="font-mono text-gray-900">{detailModal.student?.phone || "—"}</strong></p>
                  {detailModal.student?.email && <p className="col-span-2">Email: {detailModal.student.email}</p>}
                  {detailModal.student?.guardian_phone && (
                    <p className="col-span-2">Guardian Phone: {detailModal.student.guardian_phone}</p>
                  )}
                </div>
              </div>

              {/* Payment Financial Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px] uppercase font-bold text-emerald-700">Amount Paid</p>
                  <p className="text-base font-extrabold text-emerald-800 mt-0.5">{formatCurrency(detailModal.amount)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-[10px] uppercase font-bold text-gray-500">Total Fee</p>
                  <p className="text-base font-bold text-gray-800 mt-0.5">{formatCurrency(detailModal.total_fee)}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-[10px] uppercase font-bold text-red-700">Due Amount</p>
                  <p className="text-base font-extrabold text-red-800 mt-0.5">{formatCurrency(detailModal.due_amount)}</p>
                </div>
              </div>

              {/* Transaction Meta */}
              <div className="space-y-2 divide-y divide-gray-100">
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Method</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-xs border ${methodColors[detailModal.payment_method] || "bg-gray-100 text-gray-700"}`}>
                    {methodLabels[detailModal.payment_method] || detailModal.payment_method}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">
                    {detailModal.payment_method === "referral" ? "Referrer Student / ID" : "Sender Number"}
                  </span>
                  <span className="font-mono font-bold text-gray-900">{detailModal.sender_number || "—"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Transaction ID (TrxID)</span>
                  <span className="font-mono font-bold text-gray-900">{detailModal.transaction_id || "—"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Item Enrolled</span>
                  <span className="font-bold text-gray-900">{detailModal.course?.title || detailModal.batch?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Submitted On</span>
                  <span className="text-gray-700">{formatDate(detailModal.created_at)}</span>
                </div>
                {detailModal.approved_at && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Approved On</span>
                    <span className="text-emerald-700 font-semibold">{formatDate(detailModal.approved_at)}</span>
                  </div>
                )}
                {detailModal.rejection_reason && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-red-500 font-bold">Rejection Reason</span>
                    <span className="text-red-700">{detailModal.rejection_reason}</span>
                  </div>
                )}
                {detailModal.notes && (
                  <div className="py-1.5">
                    <span className="text-gray-500 block mb-0.5">Notes</span>
                    <p className="text-gray-800 bg-gray-50 p-2 rounded-lg">{detailModal.notes}</p>
                  </div>
                )}

                {(() => {
                  const ref = parseReferralNotes(detailModal.notes)
                  if (!ref && detailModal.payment_method !== "referral") return null
                  return (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5 mt-2">
                      <p className="font-bold text-purple-900 flex items-center gap-1.5 text-xs">
                        <User className="w-3.5 h-3.5 text-purple-600" /> Referral / Waiver Details
                      </p>
                      <p className="text-purple-800 text-xs">
                        Referrer: <strong className="font-mono">{ref?.name || detailModal.sender_number || "—"}</strong>
                      </p>
                      {ref?.reason && (
                        <p className="text-purple-700 text-xs">
                          Reason: <span>{ref.reason}</span>
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Copy Full summary button */}
              <button
                onClick={() => copyFullSummary(detailModal)}
                className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
