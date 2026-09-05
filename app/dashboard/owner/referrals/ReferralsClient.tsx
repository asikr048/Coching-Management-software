"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import Link from "next/link"
import {
  GitMerge,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Check,
  DollarSign,
  Users,
  Download,
  ExternalLink,
  Edit3,
  CreditCard,
  Building,
  UserCheck,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Sparkles,
  RefreshCw,
  X,
  Phone,
  BookOpen,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react"

export interface ReferralItem {
  id: string
  referral_db_id?: string
  referrer_name: string
  referrer_code?: string
  referrer_student_id?: string
  referrer_phone?: string
  referrer_id?: string
  is_matched_student: boolean
  written_referral_name: string
  referee_id: string
  referee_name: string
  referee_student_id: string
  referee_phone?: string
  referee_email?: string
  batch_name?: string
  batch_fee?: number
  commission_amount: number
  commission_rate: number
  status: "pending" | "approved" | "paid"
  notes?: string
  payment_method?: string
  created_at: string
  paid_at?: string
}

interface Props {
  initialReferrals: ReferralItem[]
}

type SortField =
  | "time_desc"
  | "time_asc"
  | "referrer_asc"
  | "referrer_desc"
  | "referee_asc"
  | "referee_desc"
  | "amount_desc"
  | "amount_asc"

export default function ReferralsClient({ initialReferrals }: Props) {
  const [referrals, setReferrals] = useState<ReferralItem[]>(initialReferrals)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "paid">("all")
  const [sortBy, setSortBy] = useState<SortField>("time_desc")

  // Modal states
  const [editingItem, setEditingItem] = useState<ReferralItem | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [payingItem, setPayingItem] = useState<ReferralItem | null>(null)
  const [payMethod, setPayMethod] = useState("bKash")
  const [payNotes, setPayNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  // Filter & Search & Sort
  const filteredAndSorted = useMemo(() => {
    let list = [...referrals]

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(r => r.status === statusFilter)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(r => {
        return (
          r.referrer_name.toLowerCase().includes(q) ||
          r.written_referral_name.toLowerCase().includes(q) ||
          (r.referrer_code && r.referrer_code.toLowerCase().includes(q)) ||
          (r.referrer_student_id && r.referrer_student_id.toLowerCase().includes(q)) ||
          (r.referrer_phone && r.referrer_phone.includes(q)) ||
          r.referee_name.toLowerCase().includes(q) ||
          r.referee_student_id.toLowerCase().includes(q) ||
          (r.referee_phone && r.referee_phone.includes(q)) ||
          (r.batch_name && r.batch_name.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q))
        )
      })
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case "time_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "time_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "referrer_asc":
          return a.referrer_name.localeCompare(b.referrer_name)
        case "referrer_desc":
          return b.referrer_name.localeCompare(a.referrer_name)
        case "referee_asc":
          return a.referee_name.localeCompare(b.referee_name)
        case "referee_desc":
          return b.referee_name.localeCompare(a.referee_name)
        case "amount_desc":
          return (b.commission_amount || 0) - (a.commission_amount || 0)
        case "amount_asc":
          return (a.commission_amount || 0) - (b.commission_amount || 0)
        default:
          return 0
      }
    })

    return list
  }, [referrals, statusFilter, searchQuery, sortBy])

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = referrals.length
    const uniqueReferrers = new Set(referrals.map(r => r.referrer_name.toLowerCase().trim())).size
    const totalCommission = referrals.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0)
    const paidCommission = referrals
      .filter(r => r.status === "paid")
      .reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0)
    const pendingCommission = referrals
      .filter(r => r.status !== "paid")
      .reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0)

    const pendingCount = referrals.filter(r => r.status === "pending").length
    const approvedCount = referrals.filter(r => r.status === "approved").length
    const paidCount = referrals.filter(r => r.status === "paid").length

    return {
      totalCount,
      uniqueReferrers,
      totalCommission,
      paidCommission,
      pendingCommission,
      pendingCount,
      approvedCount,
      paidCount,
    }
  }, [referrals])

  // Status updates
  async function updateStatus(
    item: ReferralItem,
    newStatus: "pending" | "approved" | "paid",
    opts?: { payment_method?: string; notes?: string; paid_at?: string }
  ) {
    setSaving(true)
    try {
      if (item.referral_db_id) {
        // Record already exists in DB
        const payload: any = {
          status: newStatus,
          notes: opts?.notes !== undefined ? opts.notes : item.notes,
        }
        if (newStatus === "paid") {
          payload.paid_at = opts?.paid_at || new Date().toISOString()
          if (opts?.payment_method) payload.payment_method = opts.payment_method
        } else {
          payload.paid_at = null
        }

        const { error } = await supabase.from("referrals").update(payload).eq("id", item.referral_db_id)
        if (error) throw error
      } else {
        // Record was generated from student.referred_by_code
        // Try inserting into referrals table
        const insertPayload: any = {
          referee_id: item.referee_id,
          commission_rate: item.commission_rate || 10,
          commission_amount: item.commission_amount,
          status: newStatus,
          notes: opts?.notes !== undefined ? opts.notes : item.notes || `Referred by: ${item.written_referral_name}`,
        }

        if (item.referrer_id) {
          insertPayload.referrer_id = item.referrer_id
        }

        if (newStatus === "paid") {
          insertPayload.paid_at = opts?.paid_at || new Date().toISOString()
          if (opts?.payment_method) insertPayload.payment_method = opts.payment_method
        }

        const { data: newRow, error } = await supabase
          .from("referrals")
          .insert(insertPayload)
          .select("id")
          .maybeSingle()

        if (newRow?.id) {
          item.referral_db_id = newRow.id
        }
      }

      setReferrals(prev =>
        prev.map(r =>
          r.id === item.id
            ? {
                ...r,
                status: newStatus,
                paid_at: newStatus === "paid" ? opts?.paid_at || new Date().toISOString() : undefined,
                payment_method: newStatus === "paid" ? opts?.payment_method || r.payment_method : r.payment_method,
                notes: opts?.notes !== undefined ? opts.notes : r.notes,
              }
            : r
        )
      )

      toast.success(
        newStatus === "paid"
          ? "Commission marked as Paid!"
          : newStatus === "approved"
          ? "Referral approved!"
          : "Referral status reset to pending."
      )
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to update referral status")
    } finally {
      setSaving(false)
      setPayingItem(null)
    }
  }

  // Edit commission and notes
  async function handleSaveEdit() {
    if (!editingItem) return
    const amt = parseFloat(editAmount) || 0
    setSaving(true)
    try {
      if (editingItem.referral_db_id) {
        const { error } = await supabase
          .from("referrals")
          .update({
            commission_amount: amt,
            notes: editNotes.trim() || null,
          })
          .eq("id", editingItem.referral_db_id)
        if (error) throw error
      } else {
        const insertPayload: any = {
          referee_id: editingItem.referee_id,
          commission_rate: editingItem.commission_rate || 10,
          commission_amount: amt,
          status: editingItem.status,
          notes: editNotes.trim() || `Referred by: ${editingItem.written_referral_name}`,
        }
        if (editingItem.referrer_id) insertPayload.referrer_id = editingItem.referrer_id

        const { data: newRow } = await supabase
          .from("referrals")
          .insert(insertPayload)
          .select("id")
          .maybeSingle()

        if (newRow?.id) {
          editingItem.referral_db_id = newRow.id
        }
      }

      setReferrals(prev =>
        prev.map(r =>
          r.id === editingItem.id
            ? {
                ...r,
                commission_amount: amt,
                notes: editNotes.trim() || undefined,
              }
            : r
        )
      )

      toast.success("Commission details updated successfully!")
      setEditingItem(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to update commission")
    } finally {
      setSaving(false)
    }
  }

  // Export to CSV
  function exportCSV() {
    const headers = [
      "Referral Name (Written)",
      "Referrer Type",
      "Referrer Student ID",
      "Referrer Phone",
      "Enrolled Student Name",
      "Enrolled Student ID",
      "Enrolled Student Phone",
      "Batch Enrolled",
      "Enrollment Date & Time",
      "Commission Rate %",
      "Commission Amount (BDT)",
      "Status",
      "Payment Method",
      "Paid Date",
      "Notes",
    ]

    const rows = filteredAndSorted.map(r => [
      `"${(r.written_referral_name || r.referrer_name || "").replace(/"/g, '""')}"`,
      `"${r.is_matched_student ? "Student" : "External"}"`,
      `"${r.referrer_student_id || ""}"`,
      `"${r.referrer_phone || ""}"`,
      `"${(r.referee_name || "").replace(/"/g, '""')}"`,
      `"${r.referee_student_id || ""}"`,
      `"${r.referee_phone || ""}"`,
      `"${(r.batch_name || "").replace(/"/g, '""')}"`,
      `"${formatDateTime(r.created_at)}"`,
      `"${r.commission_rate || 10}%"`,
      `"${r.commission_amount || 0}"`,
      `"${r.status}"`,
      `"${r.payment_method || ""}"`,
      `"${r.paid_at ? formatDate(r.paid_at) : ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Referrals_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV file downloaded successfully!")
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-sm flex-shrink-0">
              <GitMerge className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span>Referral Management</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track and reward all enrollment referrals — sortable by name, date, and commission
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:border-slate-600 active:scale-98 cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stat Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 truncate">Total Referrals</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white border border-slate-300 rounded-lg flex items-center justify-center text-amber-400 flex-shrink-0">
              <GitMerge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-white mt-1.5 sm:mt-2">{stats.totalCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{stats.uniqueReferrers} unique referrers</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-amber-400 truncate">Pending Payout</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white border border-slate-300 rounded-lg flex items-center justify-center text-amber-400 flex-shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1.5 sm:mt-2">{formatCurrency(stats.pendingCommission)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{stats.pendingCount + stats.approvedCount} pending</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-emerald-400 truncate">Paid Out</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white border border-slate-300 rounded-lg flex items-center justify-center text-emerald-400 flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1.5 sm:mt-2">{formatCurrency(stats.paidCommission)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{stats.paidCount} paid referrals</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-purple-400 truncate">Total Commission</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white border border-slate-300 rounded-lg flex items-center justify-center text-purple-400 flex-shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-400 mt-1.5 sm:mt-2">{formatCurrency(stats.totalCommission)}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">10% standard rate</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-4 shadow-xl col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase text-blue-400 truncate">Active Referrers</span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white border border-slate-300 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1.5 sm:mt-2">{stats.uniqueReferrers}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">Students & Promoters</p>
        </div>
      </div>

      {/* Control Bar: Search, Status Filter & Sorting */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 sm:p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search referral name, student, ID, phone..."
              className="w-full pl-9 sm:pl-10 pr-8 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 bg-slate-950"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-2 border border-slate-700 rounded-xl bg-slate-950 text-[11px] sm:text-xs font-semibold text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortField)}
              className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-semibold text-white border border-slate-700 rounded-xl bg-slate-950 focus:outline-none focus:border-amber-400 cursor-pointer shadow-sm"
            >
              <option value="time_desc">🕒 Date: Newest</option>
              <option value="time_asc">🕒 Date: Oldest</option>
              <option value="referrer_asc">🔤 Referrer: A → Z</option>
              <option value="referrer_desc">🔤 Referrer: Z → A</option>
              <option value="referee_asc">👤 Student: A → Z</option>
              <option value="referee_desc">👤 Student: Z → A</option>
              <option value="amount_desc">৳ Amount: High → Low</option>
              <option value="amount_asc">৳ Amount: Low → High</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs - Scrollable on mobile */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
            {(
              [
                { key: "all", label: "All", count: stats.totalCount },
                { key: "pending", label: "Pending", count: stats.pendingCount },
                { key: "approved", label: "Approved", count: stats.approvedCount },
                { key: "paid", label: "Paid Out", count: stats.paidCount },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                  statusFilter === tab.key
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-200 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    statusFilter === tab.key ? "bg-slate-950/25 text-slate-950" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-500 font-medium ml-auto">
            Showing {filteredAndSorted.length} of {referrals.length}
          </span>
        </div>
      </div>

      {/* MOBILE CARDS VIEW (block on mobile, hidden on tablet/desktop) */}
      <div className="block md:hidden space-y-3">
        {filteredAndSorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center space-y-2">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center mx-auto border border-amber-500/20">
              <GitMerge className="w-5 h-5" />
            </div>
            <p className="font-bold text-slate-300 text-sm">No referrals found</p>
            <p className="text-xs text-slate-500">
              {searchQuery ? `No matches for "${searchQuery}"` : "Referrals will show up here automatically."}
            </p>
          </div>
        ) : (
          filteredAndSorted.map((r, idx) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 shadow-xl space-y-3 hover:border-slate-700 transition-all"
            >
              {/* Card Header: Referrer + Status */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black ${
                      r.is_matched_student ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                    }`}
                  >
                    {r.referrer_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white truncate">{r.referrer_name}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          r.is_matched_student
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                        }`}
                      >
                        {r.is_matched_student ? "Student" : "Written"}
                      </span>
                    </div>
                    {r.is_matched_student && r.referrer_student_id && (
                      <p className="text-[11px] text-slate-400">
                        ID: <span className="font-mono font-semibold text-slate-300">{r.referrer_student_id}</span>
                        {r.referrer_phone && <span className="ml-1">• {r.referrer_phone}</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status pill */}
                <div className="flex-shrink-0">
                  {r.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Paid
                    </span>
                  ) : r.status === "approved" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      <Check className="w-3 h-3" />
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Card Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Enrolled Student */}
                <div className="bg-white border border-slate-300/80 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Enrolled Student</span>
                  <Link
                    href={`/dashboard/owner/students/${r.referee_id}`}
                    className="font-bold text-white hover:text-amber-400 flex items-center gap-1 mt-0.5 truncate transition-colors"
                  >
                    <span className="truncate">{r.referee_name}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  </Link>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{r.referee_student_id}</p>
                </div>

                {/* Batch Enrolled */}
                <div className="bg-white border border-slate-300/80 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Batch</span>
                  <p className="font-bold text-slate-900 mt-0.5 truncate">{r.batch_name || "General"}</p>
                  {r.batch_fee ? (
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatCurrency(r.batch_fee)}</p>
                  ) : null}
                </div>

                {/* Commission */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-400 uppercase block">Commission</span>
                  <p className="font-black text-sm text-white mt-0.5 font-mono">
                    {formatCurrency(r.commission_amount || 0)}
                  </p>
                  <p className="text-[10px] text-amber-400/80 font-semibold">{r.commission_rate || 10}% rate</p>
                </div>

                {/* Date */}
                <div className="bg-white border border-slate-300/80 p-2.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Date</span>
                  <p className="font-semibold text-slate-300 mt-0.5">{formatDate(r.created_at)}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(r.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Notes if any */}
              {r.notes && (
                <div className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-300">
                  <strong className="text-amber-400">Note:</strong> {r.notes}
                </div>
              )}

              {/* Card Actions */}
              <div className="flex items-center gap-2 pt-1">
                {r.status === "pending" && (
                  <button
                    disabled={saving}
                    onClick={() => updateStatus(r, "approved")}
                    className="flex-1 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-xl transition-colors text-center cursor-pointer"
                  >
                    Approve
                  </button>
                )}

                {r.status !== "paid" && (
                  <button
                    disabled={saving}
                    onClick={() => {
                      setPayingItem(r)
                      setPayMethod("bKash")
                      setPayNotes(r.notes || "")
                    }}
                    className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay Commission</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setEditingItem(r)
                    setEditAmount(String(r.commission_amount || 0))
                    setEditNotes(r.notes || "")
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit</span>
                </button>

                {r.status === "paid" && (
                  <button
                    disabled={saving}
                    onClick={() => updateStatus(r, "approved")}
                    className="px-3 py-2 text-slate-400 hover:text-amber-400 text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP / TABLET TABLE VIEW (hidden on mobile, visible on md+) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3.5 w-12 text-center">#</th>
                <th className="px-4 py-3.5">Referrer / Written Name</th>
                <th className="px-4 py-3.5">Referred Student</th>
                <th className="px-4 py-3.5">Batch Enrolled</th>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Commission</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
                        <GitMerge className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-300">No referrals found</p>
                      <p className="text-xs text-slate-500">
                        {searchQuery
                          ? `No referrals matched "${searchQuery}"`
                          : "Referrals written when students enroll will show up here automatically."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((r, idx) => {
                  return (
                    <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                      {/* Index */}
                      <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Referrer (Written / Matched) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black ${
                              r.is_matched_student
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {r.referrer_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{r.referrer_name}</span>
                              {r.is_matched_student ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  Student Referrer
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  Written Referrer
                                </span>
                              )}
                            </div>

                            {/* Details if matched */}
                            {r.is_matched_student && r.referrer_student_id && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                ID: <span className="font-mono text-slate-300 font-semibold">{r.referrer_student_id}</span>
                                {r.referrer_phone && <span className="ml-1.5">• {r.referrer_phone}</span>}
                              </p>
                            )}

                            {/* Written name info if different */}
                            {r.written_referral_name &&
                              r.written_referral_name.toLowerCase() !== r.referrer_name.toLowerCase() && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Written code/name: &quot;{r.written_referral_name}&quot;
                                </p>
                              )}
                          </div>
                        </div>
                      </td>

                      {/* Referee (Enrolled Student) */}
                      <td className="px-4 py-3.5">
                        <div>
                          <Link
                            href={`/dashboard/owner/students/${r.referee_id}`}
                            className="font-bold text-white hover:text-amber-400 transition-colors flex items-center gap-1 group"
                          >
                            <span>{r.referee_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <p className="text-xs text-slate-400 mt-0.5">
                            ID: <span className="font-mono text-slate-300 font-medium">{r.referee_student_id}</span>
                            {r.referee_phone && <span className="ml-1.5">• {r.referee_phone}</span>}
                          </p>
                        </div>
                      </td>

                      {/* Batch Enrolled */}
                      <td className="px-4 py-3.5">
                        {r.batch_name ? (
                          <div>
                            <span className="font-semibold text-slate-300 text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md">
                              {r.batch_name}
                            </span>
                            {r.batch_fee ? (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Fee: {formatCurrency(r.batch_fee)}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">General Enrollment</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-slate-300">
                            {formatDate(r.created_at)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(r.created_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </td>

                      {/* Commission */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <p className="font-black text-white text-sm font-mono">
                              {formatCurrency(r.commission_amount || 0)}
                            </p>
                            <p className="text-[10px] text-amber-400 font-semibold">
                              {r.commission_rate || 10}% rate
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingItem(r)
                              setEditAmount(String(r.commission_amount || 0))
                              setEditNotes(r.notes || "")
                            }}
                            title="Edit commission or notes"
                            className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <div>
                          {r.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                            </span>
                          ) : r.status === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                              <Check className="w-3 h-3" />
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}

                          {r.paid_at && (
                            <p className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
                              {formatDate(r.paid_at)} {r.payment_method ? `• ${r.payment_method}` : ""}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "pending" && (
                            <button
                              disabled={saving}
                              onClick={() => updateStatus(r, "approved")}
                              className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              title="Approve referral commission"
                            >
                              Approve
                            </button>
                          )}

                          {r.status !== "paid" && (
                            <button
                              disabled={saving}
                              onClick={() => {
                                setPayingItem(r)
                                setPayMethod("bKash")
                                setPayNotes(r.notes || "")
                              }}
                              className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 text-xs font-black rounded-lg transition-all flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
                              title="Mark commission as paid"
                            >
                              <DollarSign className="w-3 h-3" />
                              Pay
                            </button>
                          )}

                          {r.status === "paid" && (
                            <button
                              disabled={saving}
                              onClick={() => updateStatus(r, "approved")}
                              className="px-2 py-1 text-slate-400 hover:text-amber-400 text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Revert to approved"
                            >
                              Revert
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Out Modal - Mobile Responsive Bottom Sheet / Center Dialog */}
      {payingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Record Commission Payout</h3>
              </div>
              <button
                onClick={() => setPayingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Commission Amount</p>
              <p className="text-2xl sm:text-3xl font-black text-amber-300 mt-1 font-mono">
                {formatCurrency(payingItem.commission_amount)}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Paying to: <strong className="text-white">{payingItem.referrer_name}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-700 rounded-xl text-sm font-semibold text-white bg-slate-950 focus:border-amber-400 focus:outline-none"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Cash">Cash Handover</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                  Transaction / Payout Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. TrxID: 9X738KA or Handed over by Manager"
                  className="w-full px-3.5 py-2.5 border border-slate-700 rounded-xl text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPayingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  updateStatus(payingItem, "paid", {
                    payment_method: payMethod,
                    notes: payNotes,
                  })
                }
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 rounded-xl text-sm font-black shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Confirm Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Commission Modal - Mobile Responsive */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Referral Commission</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <p>
                <strong className="text-amber-400">Referrer:</strong> {editingItem.referrer_name}
              </p>
              <p>
                <strong className="text-amber-400">Referred Student:</strong> {editingItem.referee_name} (
                {editingItem.referee_student_id})
              </p>
              {editingItem.batch_name && (
                <p>
                  <strong className="text-amber-400">Batch:</strong> {editingItem.batch_name}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                  Commission Amount (BDT ৳) *
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3.5 py-2.5 border border-slate-700 rounded-xl text-sm font-bold text-white bg-slate-950 focus:border-amber-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Add details, promoter terms, or custom note..."
                  className="w-full px-3.5 py-2.5 border border-slate-700 rounded-xl text-sm text-white bg-slate-950 focus:border-amber-400 focus:outline-none placeholder:text-slate-500 resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 rounded-xl text-sm font-black shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
