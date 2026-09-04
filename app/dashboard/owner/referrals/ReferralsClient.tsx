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
  X
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
              <GitMerge className="w-5 h-5" />
            </div>
            Referral Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            All referrals written during student enrollment — searchable, sortable by name and date
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold shadow-sm transition-all hover:border-gray-300"
          >
            <Download className="w-4 h-4 text-gray-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Total Referrals</span>
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <GitMerge className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{stats.totalCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stats.uniqueReferrers} unique referrers</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-500">Pending Payout</span>
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{formatCurrency(stats.pendingCommission)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stats.pendingCount + stats.approvedCount} pending / approved</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-600">Paid Out</span>
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{formatCurrency(stats.paidCommission)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stats.paidCount} paid referrals</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-purple-600">Total Commission</span>
            <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-700 mt-2">{formatCurrency(stats.totalCommission)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Standard 10% on enrollment</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-blue-600">Active Referrers</span>
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{stats.uniqueReferrers}</p>
          <p className="text-xs text-gray-400 mt-0.5">Students & External promoters</p>
        </div>
      </div>

      {/* Control Bar: Search, Status Filter & Sorting */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by referral name, student name, ID, phone, batch..."
              className="w-full pl-10 pr-9 py-2.5 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-xs font-semibold text-gray-600 flex-shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortField)}
              className="px-3.5 py-2.5 text-sm font-semibold text-gray-800 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-sm"
            >
              <option value="time_desc">🕒 Date: Newest First</option>
              <option value="time_asc">🕒 Date: Oldest First</option>
              <option value="referrer_asc">🔤 Referrer Name: A → Z</option>
              <option value="referrer_desc">🔤 Referrer Name: Z → A</option>
              <option value="referee_asc">👤 Enrolled Student: A → Z</option>
              <option value="referee_desc">👤 Enrolled Student: Z → A</option>
              <option value="amount_desc">৳ Commission: High → Low</option>
              <option value="amount_asc">৳ Commission: Low → High</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Status:</span>
          {(
            [
              { key: "all", label: "All Referrals", count: stats.totalCount },
              { key: "pending", label: "Pending", count: stats.pendingCount },
              { key: "approved", label: "Approved", count: stats.approvedCount },
              { key: "paid", label: "Paid Out", count: stats.paidCount },
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  statusFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400">
            Showing {filteredAndSorted.length} of {referrals.length} referrals
          </span>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-indigo-50/20 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3.5 w-12 text-center">#</th>
                <th className="px-4 py-3.5">Referrer / Written Name</th>
                <th className="px-4 py-3.5">Referred Student (Enrolled)</th>
                <th className="px-4 py-3.5">Batch Enrolled</th>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Commission</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
                        <GitMerge className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-gray-800">No referrals found</p>
                      <p className="text-xs text-gray-400">
                        {searchQuery
                          ? `No referrals matched "${searchQuery}"`
                          : "Referrals written when students enroll will show up here automatically."}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="text-xs text-indigo-600 font-semibold hover:underline mt-2"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((r, idx) => {
                  return (
                    <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors">
                      {/* Index */}
                      <td className="px-4 py-3.5 text-center text-xs font-bold text-gray-400">
                        {idx + 1}
                      </td>

                      {/* Referrer (Written / Matched) */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black ${
                              r.is_matched_student
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {r.referrer_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900">{r.referrer_name}</span>
                              {r.is_matched_student ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Student Referrer
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Written Referrer
                                </span>
                              )}
                            </div>

                            {/* Details if matched */}
                            {r.is_matched_student && r.referrer_student_id && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                ID: <span className="font-mono text-gray-700 font-semibold">{r.referrer_student_id}</span>
                                {r.referrer_phone && <span className="ml-1.5">• {r.referrer_phone}</span>}
                              </p>
                            )}

                            {/* Written name info if different */}
                            {r.written_referral_name &&
                              r.written_referral_name.toLowerCase() !== r.referrer_name.toLowerCase() && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
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
                            className="font-bold text-gray-900 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                          >
                            <span>{r.referee_name}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            ID: <span className="font-mono text-gray-700 font-medium">{r.referee_student_id}</span>
                            {r.referee_phone && <span className="ml-1.5">• {r.referee_phone}</span>}
                          </p>
                        </div>
                      </td>

                      {/* Batch Enrolled */}
                      <td className="px-4 py-3.5">
                        {r.batch_name ? (
                          <div>
                            <span className="font-semibold text-gray-800 text-xs px-2 py-0.5 bg-gray-100 rounded-md">
                              {r.batch_name}
                            </span>
                            {r.batch_fee ? (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Fee: {formatCurrency(r.batch_fee)}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">General Enrollment</span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-gray-800">
                            {formatDate(r.created_at)}
                          </p>
                          <p className="text-[11px] text-gray-400">
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
                            <p className="font-black text-gray-900 text-sm">
                              {formatCurrency(r.commission_amount || 0)}
                            </p>
                            <p className="text-[10px] text-gray-400 font-semibold">
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
                            className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <div>
                          {r.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                            </span>
                          ) : r.status === "approved" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                              <Check className="w-3 h-3" />
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}

                          {r.paid_at && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {formatDate(r.paid_at)} {r.payment_method ? `• ${r.payment_method}` : ""}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "pending" && (
                            <button
                              disabled={saving}
                              onClick={() => updateStatus(r, "approved")}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors"
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
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
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
                              className="px-2 py-1 text-gray-400 hover:text-amber-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
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

      {/* Pay Out Modal */}
      {payingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Record Commission Payout</h3>
              </div>
              <button
                onClick={() => setPayingItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-center">
              <p className="text-xs text-emerald-700 font-semibold uppercase">Commission Amount</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">
                {formatCurrency(payingItem.commission_amount)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Paying to: <strong>{payingItem.referrer_name}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                >
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Cash">Cash Handover</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">
                  Transaction / Payout Notes (Optional)
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  placeholder="e.g. TrxID: 9X738KA or Handed over by Manager"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPayingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
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
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Commission Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Edit Referral Commission</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <p>
                <strong>Referrer:</strong> {editingItem.referrer_name}
              </p>
              <p>
                <strong>Referred Student:</strong> {editingItem.referee_name} (
                {editingItem.referee_student_id})
              </p>
              {editingItem.batch_name && (
                <p>
                  <strong>Batch:</strong> {editingItem.batch_name}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">
                  Commission Amount (BDT ৳) *
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Add details, promoter terms, or custom note..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
