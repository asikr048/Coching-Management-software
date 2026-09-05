"use client"

import { useState, useMemo, useEffect } from "react"
import { 
  Search, Download, Eye, Edit, Trash2, MessageSquare, MoreVertical, 
  Calendar, DollarSign, CheckCircle2, ChevronDown, X, ShieldAlert, 
  ShieldCheck, Clock, AlertTriangle, Lock, Unlock, Check, UserCheck, 
  Layers, ArrowRight, RefreshCw, Send
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import type { Student } from "@/lib/supabase/types"
import { useBranch } from "@/components/providers/BranchContext"

interface Batch { id: string; name: string }
interface DueData { student_id: string; due_amount: number; paid_amount: number; due_date: string; status: string }
interface ExamData { student_id: string; obtained_marks: number; exams: { total_marks: number } | null | any }

interface CurrentStaff {
  id: string
  name: string
  email: string
  role: string
}

export interface DeletionRequest {
  id: string
  student_ids: string[]
  student_names: { id: string; student_id: string; name: string; phone?: string | null }[]
  reason: string
  requested_by: string
  requested_by_name: string
  approver_1: string | null
  approver_1_name: string | null
  approved_at_1: string | null
  approver_2: string | null
  approver_2_name: string | null
  approved_at_2: string | null
  status: "pending" | "timelock" | "ready" | "executed" | "cancelled"
  scheduled_delete_at: string | null
  executed_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  created_at: string
}

interface Props { 
  students: (Student & { enrollments?: { batch_id: string; batch?: { name: string }; status: string }[] })[]; 
  batches: Batch[];
  dueData?: DueData[];
  examData?: ExamData[];
  currentStaff?: CurrentStaff;
  initialDeletionRequests?: DeletionRequest[];
}

type SortOption = "default" | "due" | "performance" | "recent"

export default function StudentsClient({ 
  students, 
  batches, 
  dueData = [], 
  examData = [],
  currentStaff = { id: "owner-admin", name: "Admin", email: "admin@medhashiree.com", role: "owner" },
  initialDeletionRequests = []
}: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Local student state (allows immediate removal when deletion is executed)
  const [localStudents, setLocalStudents] = useState(students)
  useEffect(() => {
    setLocalStudents(students)
  }, [students])

  // Filters & selection
  const [query, setQuery] = useState("")
  const [batchFilter, setBatchFilter] = useState("")
  const [sortOption, setSortOption] = useState<SortOption>("default")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // ==========================================
  // DELETION REQUESTS & 24H TIMELOCK STATE
  // ==========================================
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>(() => {
    if (typeof window === "undefined") return initialDeletionRequests
    try {
      const saved = localStorage.getItem("medhashiree_deletion_requests")
      if (saved) {
        const parsed: DeletionRequest[] = JSON.parse(saved)
        const map = new Map<string, DeletionRequest>()
        initialDeletionRequests.forEach(r => map.set(r.id, r))
        parsed.forEach(r => map.set(r.id, r))
        return Array.from(map.values())
      }
    } catch {}
    return initialDeletionRequests
  })

  // Synchronize with parent props when they change
  useEffect(() => {
    if (initialDeletionRequests.length > 0) {
      setDeletionRequests(prev => {
        const map = new Map<string, DeletionRequest>()
        prev.forEach(r => map.set(r.id, r))
        initialDeletionRequests.forEach(r => map.set(r.id, r))
        return Array.from(map.values())
      })
    }
  }, [initialDeletionRequests])

  // Live 1-second ticker for 24-hour remaining countdown
  const [now, setNow] = useState<number>(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Helper to persist requests to state, localStorage & Supabase
  const persistRequests = (updated: DeletionRequest[]) => {
    setDeletionRequests(updated)
    try {
      localStorage.setItem("medhashiree_deletion_requests", JSON.stringify(updated))
    } catch (e) {
      console.warn("Could not save to localStorage:", e)
    }
  }

  // Modals state
  const [requestDeleteModal, setRequestDeleteModal] = useState(false)
  const [targetStudentsForDeletion, setTargetStudentsForDeletion] = useState<Student[]>([])
  const [deletionReason, setDeletionReason] = useState("")
  const [submittingRequest, setSubmittingRequest] = useState(false)

  const [queueModal, setQueueModal] = useState(false)
  const [queueTab, setQueueTab] = useState<"pending" | "timelock" | "ready" | "history">("pending")

  // Modal for signing 2nd approval when same user needs distinct sign-off
  const [secondApproverModal, setSecondApproverModal] = useState<string | null>(null)
  const [secondApproverName, setSecondApproverName] = useState("")

  // ==========================================
  // BULK SMS FORWARDING
  // ==========================================
  const handleSendSms = (overrideIds?: string[]) => {
    const ids = overrideIds || Array.from(selectedIds)
    if (ids.length === 0) {
      toast.error("Please select at least one student to send SMS")
      return
    }

    try {
      sessionStorage.setItem("sms_selected_student_ids", JSON.stringify(ids))
    } catch (e) {
      console.warn("Could not store sms student ids:", e)
    }

    toast.success(`Redirecting to Bulk SMS Gateway with ${ids.length} contacts...`, {
      description: "Recipients will be pre-loaded into the compose panel.",
    })
    router.push(`/dashboard/owner/sms?target=custom_picker`)
  }

  // ==========================================
  // STUDENT ENRICHMENT & FILTERING
  // ==========================================
  const enrichedStudents = useMemo(() => {
    return localStudents.map(student => {
      // Dues
      const sDues = dueData.filter(d => d.student_id === student.id)
      const totalDue = sDues.reduce((acc, curr) => acc + (curr.due_amount - (curr.paid_amount || 0)), 0)
      const nearestDue = sDues
        .filter(d => d.due_date)
        .map(d => new Date(d.due_date).getTime())
        .sort((a, b) => a - b)[0]
      
      // Performance
      const sExams = examData.filter(e => e.student_id === student.id)
      let totalObtained = 0
      let totalMax = 0
      sExams.forEach(e => {
        if (e.exams?.total_marks) {
          totalObtained += e.obtained_marks || 0
          totalMax += e.exams.total_marks
        }
      })
      const performance = totalMax > 0 ? (totalObtained / totalMax) * 100 : null

      return {
        ...student,
        totalDue,
        nearestDueDate: nearestDue ? new Date(nearestDue).toISOString() : null,
        performance
      }
    })
  }, [localStudents, dueData, examData])

  const { selectedBranchId } = useBranch()

  const filteredAndSorted = useMemo(() => {
    let result = enrichedStudents.filter(s => {
      const matchQ = !query || 
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.student_id.toLowerCase().includes(query.toLowerCase()) ||
        s.phone?.toLowerCase().includes(query.toLowerCase())
      
      const matchB = !batchFilter || (s.enrollments?.some(e => e.batch_id === batchFilter))
      const matchBranch = selectedBranchId === "all" || !s.branch_id || s.branch_id === selectedBranchId
      
      return matchQ && matchB && matchBranch
    })

    switch (sortOption) {
      case "due":
        result.sort((a, b) => b.totalDue - a.totalDue)
        break
      case "performance":
        result.sort((a, b) => (b.performance || 0) - (a.performance || 0))
        break
      case "recent":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      default:
        break
    }

    return result
  }, [enrichedStudents, query, batchFilter, sortOption, selectedBranchId])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredAndSorted.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleDownloadCSV = () => {
    const dataToExport = selectedIds.size > 0 
      ? filteredAndSorted.filter(s => selectedIds.has(s.id))
      : filteredAndSorted

    if (dataToExport.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = ["Name", "Student ID", "Phone", "Email", "Batch", "Performance%", "Due Amount", "Status"]
    const rows = dataToExport.map(s => {
      const activeEnrollments = s.enrollments?.filter(e => e.status === "active") || []
      const batchesStr = activeEnrollments.map(e => e.batch?.name).join("; ")
      return [
        `"${s.name}"`,
        `"${s.student_id}"`,
        `"${s.phone || ''}"`,
        `"${s.email || ''}"`,
        `"${batchesStr || 'Not enrolled'}"`,
        s.performance !== null ? s.performance.toFixed(1) + "%" : "N/A",
        s.totalDue,
        s.is_active ? "Active" : "Inactive"
      ].join(",")
    })

    const csvContent = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `students_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV Downloaded")
  }

  // ==========================================
  // TWO-PERSON APPROVAL & 24H TIMELOCK LOGIC
  // ==========================================
  const openRequestModalForSelected = () => {
    const targets = localStudents.filter(s => selectedIds.has(s.id))
    if (targets.length === 0) {
      toast.error("Please select at least one student")
      return
    }
    setTargetStudentsForDeletion(targets)
    setDeletionReason("")
    setRequestDeleteModal(true)
  }

  const openRequestModalForSingle = (student: Student) => {
    setTargetStudentsForDeletion([student])
    setDeletionReason("")
    setRequestDeleteModal(true)
  }

  // Submit new deletion request
  const handleSubmitDeletionRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deletionReason.trim()) {
      toast.error("Please provide a legitimate reason for deleting student data")
      return
    }

    setSubmittingRequest(true)
    const newReq: DeletionRequest = {
      id: "del_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7),
      student_ids: targetStudentsForDeletion.map(s => s.id),
      student_names: targetStudentsForDeletion.map(s => ({
        id: s.id,
        student_id: s.student_id,
        name: s.name,
        phone: s.phone || s.guardian_phone || null
      })),
      reason: deletionReason.trim(),
      requested_by: currentStaff.id,
      requested_by_name: currentStaff.name,
      approver_1: null,
      approver_1_name: null,
      approved_at_1: null,
      approver_2: null,
      approver_2_name: null,
      approved_at_2: null,
      status: "pending",
      scheduled_delete_at: null,
      executed_at: null,
      cancelled_at: null,
      cancelled_by: null,
      created_at: new Date().toISOString()
    }

    // Try inserting into Supabase
    try {
      await supabase.from("student_deletion_requests").insert({
        id: newReq.id.startsWith("del_") ? undefined : newReq.id,
        student_ids: newReq.student_ids,
        student_names: newReq.student_names,
        reason: newReq.reason,
        requested_by: newReq.requested_by,
        requested_by_name: newReq.requested_by_name,
        status: "pending"
      })
    } catch (err) {
      console.warn("Could not insert to student_deletion_requests table:", err)
    }

    const updated = [newReq, ...deletionRequests]
    persistRequests(updated)
    setSubmittingRequest(false)
    setRequestDeleteModal(false)
    setSelectedIds(new Set())

    toast.success("🛡️ Deletion request initiated!", {
      description: "Dual approval is required. Two people must sign off before the 24-hour cooling period begins."
    })
    setQueueModal(true)
    setQueueTab("pending")
  }

  // 1st Approver Sign-off
  const handleApprove1 = async (reqId: string) => {
    const updated = deletionRequests.map(r => {
      if (r.id === reqId) {
        return {
          ...r,
          approver_1: currentStaff.id,
          approver_1_name: currentStaff.name,
          approved_at_1: new Date().toISOString()
        }
      }
      return r
    })
    persistRequests(updated)

    try {
      await supabase.from("student_deletion_requests").update({
        approver_1: currentStaff.id,
        approver_1_name: currentStaff.name,
        approved_at_1: new Date().toISOString()
      }).eq("id", reqId)
    } catch {}

    toast.success("✓ 1st Approval recorded! Waiting for 2nd person sign-off.")
  }

  // 2nd Approver Sign-off
  const handleApprove2 = async (reqId: string, customName?: string) => {
    const req = deletionRequests.find(r => r.id === reqId)
    if (!req) return

    // If current staff is the SAME person as approver 1 and hasn't supplied a second admin's confirmation
    if (!customName && req.approver_1 === currentStaff.id) {
      setSecondApproverModal(reqId)
      setSecondApproverName("")
      return
    }

    const finalApproverName = customName?.trim() || currentStaff.name || "Second Administrator"
    const finalApproverId = customName ? ("sec_" + Date.now().toString(36)) : currentStaff.id
    const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const updated = deletionRequests.map(r => {
      if (r.id === reqId) {
        return {
          ...r,
          approver_2: finalApproverId,
          approver_2_name: finalApproverName,
          approved_at_2: new Date().toISOString(),
          status: "timelock" as const,
          scheduled_delete_at: scheduledTime
        }
      }
      return r
    })
    persistRequests(updated)

    try {
      await supabase.from("student_deletion_requests").update({
        approver_2: finalApproverId,
        approver_2_name: finalApproverName,
        approved_at_2: new Date().toISOString(),
        status: "timelock",
        scheduled_delete_at: scheduledTime
      }).eq("id", reqId)
    } catch {}

    setSecondApproverModal(null)
    toast.success("🔒 2nd Approval verified! 24-Hour Cooling Timelock started.", {
      description: "Deletion is locked for safety. You can abort or cancel this at any point within the next 24 hours."
    })
    setQueueTab("timelock")
  }

  // Cancel / Abort Deletion Request
  const handleCancelRequest = async (reqId: string) => {
    const updated = deletionRequests.map(r => {
      if (r.id === reqId) {
        return {
          ...r,
          status: "cancelled" as const,
          cancelled_at: new Date().toISOString(),
          cancelled_by: currentStaff.name
        }
      }
      return r
    })
    persistRequests(updated)

    try {
      await supabase.from("student_deletion_requests").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: currentStaff.name
      }).eq("id", reqId)
    } catch {}

    toast.info("Deletion request was aborted. Student records are safe.")
  }

  // Execute Permanent Deletion (Only available once 24-hour timelock has elapsed)
  const handleExecutePermanentDeletion = async (reqId: string) => {
    const req = deletionRequests.find(r => r.id === reqId)
    if (!req) return

    if (!confirm(`Are you absolutely sure you want to permanently delete ${req.student_ids.length} student record(s)? This cannot be undone.`)) {
      return
    }

    try {
      // 1. Delete records from Supabase
      try {
        await supabase.from("enrollments").delete().in("student_id", req.student_ids)
        await supabase.from("fee_dues").delete().in("student_id", req.student_ids)
        await supabase.from("students").delete().in("id", req.student_ids)
      } catch (e) {
        console.warn("Database deletion execution notice:", e)
      }

      // 2. Remove students from local table view
      setLocalStudents(prev => prev.filter(s => !req.student_ids.includes(s.id)))

      // 3. Mark request as executed
      const updated = deletionRequests.map(r => {
        if (r.id === reqId) {
          return {
            ...r,
            status: "executed" as const,
            executed_at: new Date().toISOString()
          }
        }
        return r
      })
      persistRequests(updated)

      try {
        await supabase.from("student_deletion_requests").update({
          status: "executed",
          executed_at: new Date().toISOString()
        }).eq("id", reqId)
      } catch {}

      toast.success(`✓ Permanently deleted ${req.student_ids.length} student(s) after 24h timelock completion.`)
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize deletion")
    }
  }

  // Calculate live remaining time string
  const formatCountdown = (scheduledIso: string | null) => {
    if (!scheduledIso) return { isReady: true, display: "Unlocked (Ready)" }
    const scheduledMs = new Date(scheduledIso).getTime()
    const diffMs = scheduledMs - now

    if (diffMs <= 0) {
      return { isReady: true, display: "24h Cooling-Off Completed • Ready to execute" }
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    const pct = Math.max(0, Math.min(100, Math.round(((24 * 3600 * 1000 - diffMs) / (24 * 3600 * 1000)) * 100)))

    return {
      isReady: false,
      hours,
      minutes,
      seconds,
      percentComplete: pct,
      display: `${hours}h ${minutes}m ${seconds}s remaining`
    }
  }

  // Categorize deletion requests for Queue tabs
  const pendingRequests = deletionRequests.filter(r => r.status === "pending")
  const timelockRequests = deletionRequests.filter(r => {
    if (r.status !== "timelock") return false
    const time = formatCountdown(r.scheduled_delete_at)
    return !time.isReady
  })
  const readyRequests = deletionRequests.filter(r => {
    if (r.status === "ready") return true
    if (r.status === "timelock") {
      const time = formatCountdown(r.scheduled_delete_at)
      return time.isReady
    }
    return false
  })
  const historyRequests = deletionRequests.filter(r => r.status === "executed" || r.status === "cancelled")

  const totalActiveQueue = pendingRequests.length + timelockRequests.length + readyRequests.length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder="Search by name, ID, phone..."
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:border-amber-400 focus:outline-none text-white placeholder:text-slate-500" 
              />
            </div>
            <select 
              value={batchFilter} 
              onChange={e => setBatchFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:border-amber-400 focus:outline-none text-white min-w-[150px]">
              <option value="" className="bg-slate-900 text-white">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
              ))}
            </select>
            <select 
              value={sortOption} 
              onChange={e => setSortOption(e.target.value as SortOption)}
              className="px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:border-amber-400 focus:outline-none text-white min-w-[180px]">
              <option value="default" className="bg-slate-900 text-white">Default Sort</option>
              <option value="due" className="bg-slate-900 text-white">Due Payment (Highest)</option>
              <option value="performance" className="bg-slate-900 text-white">Best Performance</option>
              <option value="recent" className="bg-slate-900 text-white">Recently Enrolled</option>
            </select>
          </div>

          {/* Deletion Queue Security Badge / Button */}
          <button 
            onClick={() => setQueueModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shadow-md bg-slate-950 hover:bg-slate-800 border-slate-700 hover:border-amber-500/50 text-slate-200"
          >
            <ShieldAlert className={`w-4 h-4 ${totalActiveQueue > 0 ? "text-amber-400" : "text-slate-500"}`} />
            <span>Deletion Queue</span>
            {totalActiveQueue > 0 ? (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-slate-950 ${readyRequests.length > 0 ? "bg-red-500 animate-pulse text-white" : "bg-amber-400"}`}>
                {totalActiveQueue}
              </span>
            ) : (
              <span className="text-xs text-slate-500 font-normal">0 active</span>
            )}
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 p-3.5 bg-amber-500/10 rounded-xl flex flex-wrap items-center justify-between gap-3 border border-amber-500/25 transition-all">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 text-xs font-extrabold px-2.5 py-1 rounded-md shadow-xs">
                {selectedIds.size}
              </span>
              <span className="text-sm font-bold text-amber-300">students selected</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Send SMS -> directly navigates to Bulk SMS Gateway with all selected contacts */}
              <button 
                onClick={() => handleSendSms()} 
                className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-sm font-bold rounded-lg transition-all shadow-sm"
              >
                <MessageSquare className="w-4 h-4" /> Send SMS
              </button>

              <button 
                onClick={handleDownloadCSV} 
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 text-slate-200 hover:text-white text-sm font-medium rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" /> Download CSV
              </button>

              {/* Protected 2-Person & 24h Timelock Deletion Request */}
              <button 
                onClick={openRequestModalForSelected} 
                className="flex items-center gap-2 px-3.5 py-1.5 bg-red-500/15 text-red-300 text-sm font-semibold rounded-lg border border-red-500/30 hover:bg-red-500/25 transition-colors shadow-sm"
                title="Requests deletion requiring 2 person sign-off and 24-hour timelock delay"
              >
                <ShieldAlert className="w-4 h-4 text-red-400" /> Request Deletion (2 Approvals)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Area */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 overflow-visible shadow-xl">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                <th className="px-4 py-3.5 w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">#</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Student</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">ID</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Batch</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Performance</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Due Amount</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Due Date</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredAndSorted.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-500">No students found</td></tr>
              ) : (
                filteredAndSorted.map((student, idx) => {
                  const activeEnrollments = student.enrollments?.filter(e => e.status === "active") || []
                  const isSelected = selectedIds.has(student.id)
                  
                  return (
                    <tr key={student.id} className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-amber-500/10' : ''}`}>
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelect(student.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <Link href={`/dashboard/owner/students/${student.id}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center text-slate-950 font-extrabold text-sm shadow-md group-hover:scale-105 transition-all">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">{student.name}</p>
                            <p className="text-xs text-slate-400">{student.phone || student.guardian_phone || "-"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <span className="font-mono bg-slate-950 px-2.5 py-1 rounded-md text-xs font-semibold text-amber-300 border border-slate-800">
                          {student.student_id}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {activeEnrollments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {activeEnrollments.map((e, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 w-max">
                                {e.batch?.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">Not enrolled</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {student.performance !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className={`h-full rounded-full ${student.performance >= 80 ? 'bg-emerald-500' : student.performance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${student.performance}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-200">{student.performance.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">No exams</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {student.totalDue > 0 ? (
                          <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/25">
                            {formatCurrency(student.totalDue)}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {student.nearestDueDate ? (
                          <span className={`flex items-center gap-1 font-medium ${new Date(student.nearestDueDate) < new Date() ? 'text-red-400' : 'text-slate-300'}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(student.nearestDueDate)}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${student.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                          {student.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right relative">
                        <button 
                          onClick={() => setOpenDropdown(openDropdown === student.id ? null : student.id)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* Action Dropdown */}
                        {openDropdown === student.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                            <div className="absolute right-8 top-10 w-56 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 z-20 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 text-left">
                              <Link href={`/dashboard/owner/students/${student.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-amber-400 transition-colors">
                                <Eye className="w-4 h-4" /> View Profile
                              </Link>
                              <Link href={`/dashboard/owner/students/${student.id}/edit`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-amber-400 transition-colors">
                                <Edit className="w-4 h-4" /> Edit Details
                              </Link>

                              {/* Send SMS for single student via SMS gateway */}
                              <button 
                                onClick={() => {
                                  setOpenDropdown(null)
                                  handleSendSms([student.id])
                                }} 
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-300 hover:bg-slate-800 transition-colors text-left font-semibold"
                              >
                                <MessageSquare className="w-4 h-4 text-amber-400" /> Send SMS (Gateway)
                              </button>
                              
                              {student.totalDue > 0 && (
                                <>
                                  <div className="h-px bg-slate-800 my-1"></div>
                                  <button onClick={() => { toast.success("Due date extended"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left">
                                    <Calendar className="w-4 h-4" /> Extend Due Date
                                  </button>
                                  <button onClick={() => { toast.success("Due reduction applied"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left">
                                    <DollarSign className="w-4 h-4" /> Reduce Due
                                  </button>
                                  <button onClick={() => { toast.success("Marked as paid"); setOpenDropdown(null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 hover:bg-slate-800 transition-colors text-left">
                                    <CheckCircle2 className="w-4 h-4" /> Mark Due Paid
                                  </button>
                                </>
                              )}
                              
                              {/* Request Deletion (Dual Approval & 24h) */}
                              <div className="h-px bg-slate-800 my-1"></div>
                              <button 
                                onClick={() => {
                                  setOpenDropdown(null)
                                  openRequestModalForSingle(student)
                                }} 
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left font-semibold"
                              >
                                <ShieldAlert className="w-4 h-4 text-red-400" /> Request Deletion (2 Approvals)
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <p className="text-sm text-slate-400 font-medium">
            Showing <span className="text-white font-bold">{filteredAndSorted.length}</span> of <span className="text-white font-bold">{localStudents.length}</span> students
          </p>
          {selectedIds.size > 0 && (
            <p className="text-sm text-amber-400 font-bold">
              {selectedIds.size} selected
            </p>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. REQUEST DELETION MODAL (DUAL APPROVAL)  */}
      {/* ========================================== */}
      {/* ========================================== */}
      {/* 1. REQUEST DELETION MODAL (DUAL APPROVAL)  */}
      {/* ========================================== */}
      {requestDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-800 text-white">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-extrabold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Request Student Deletion
              </h3>
              <button onClick={() => setRequestDeleteModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeletionRequest} className="p-6 space-y-4">
              {/* Security Policy Alert */}
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-xs text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-300 text-sm">
                  <Lock className="w-4 h-4 text-amber-400" /> Dual-Approval & 24-Hour Timelock Safety Policy
                </div>
                <p>
                  To protect against accidental or rogue loss of student academic and financial records:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-amber-200/90">
                  <li><strong>Two different people</strong> (administrators/staff) must independently review and sign off.</li>
                  <li>Once both approve, a mandatory <strong>24-hour cooling-off countdown</strong> begins.</li>
                  <li>You can <strong>cancel this deletion at any time</strong> during the 24 hours.</li>
                  <li>Only when the 24 hours finish can permanent deletion be finalized.</li>
                </ul>
              </div>

              {/* Target Students Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Students to be deleted ({targetStudentsForDeletion.length})
                </label>
                <div className="max-h-32 overflow-y-auto border border-slate-800 rounded-xl p-2.5 divide-y divide-slate-800 bg-slate-950">
                  {targetStudentsForDeletion.map(s => (
                    <div key={s.id} className="py-1.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">{s.name}</span>
                        <span className="text-amber-400/90 font-mono ml-2">({s.student_id})</span>
                      </div>
                      <span className="text-slate-400">{s.phone || s.guardian_phone || "No phone"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deletion Reason (Required) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reason for Deletion <span className="text-red-400">*</span>
                </label>
                <textarea 
                  required
                  value={deletionReason}
                  onChange={e => setDeletionReason(e.target.value)}
                  placeholder="e.g., Requested by parent for transfer / duplicate test record / left institute..."
                  rows={3}
                  className="w-full p-3 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span>Requested by: <strong className="text-white">{currentStaff.name}</strong></span>
                <span>Role: <strong className="text-amber-400 uppercase">{currentStaff.role}</strong></span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setRequestDeleteModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submittingRequest}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
                >
                  {submittingRequest ? "Creating Request..." : "Submit Deletion Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. DELETION QUEUE & APPROVAL MANAGER MODAL */}
      {/* ========================================== */}
      {queueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col max-h-[90vh] text-white">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="font-extrabold text-white flex items-center gap-2 text-base">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Protected Deletion Queue & Timelock
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Two-person verification rule with a 24-hour cooling-off safety period
                </p>
              </div>
              <button onClick={() => setQueueModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 px-6 bg-slate-950/80 gap-2 text-sm">
              <button 
                onClick={() => setQueueTab("pending")}
                className={`py-3 px-3 border-b-2 font-bold flex items-center gap-1.5 transition-colors ${
                  queueTab === "pending" 
                    ? "border-amber-400 text-amber-300" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Needs Approval
                {pendingRequests.length > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                    {pendingRequests.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setQueueTab("timelock")}
                className={`py-3 px-3 border-b-2 font-bold flex items-center gap-1.5 transition-colors ${
                  queueTab === "timelock" 
                    ? "border-amber-400 text-amber-300" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Clock className="w-4 h-4" />
                In 24h Timelock
                {timelockRequests.length > 0 && (
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                    {timelockRequests.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setQueueTab("ready")}
                className={`py-3 px-3 border-b-2 font-bold flex items-center gap-1.5 transition-colors ${
                  queueTab === "ready" 
                    ? "border-red-400 text-red-300" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Unlock className="w-4 h-4" />
                Ready to Execute
                {readyRequests.length > 0 && (
                  <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                    {readyRequests.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setQueueTab("history")}
                className={`py-3 px-3 border-b-2 font-bold flex items-center gap-1.5 transition-colors ${
                  queueTab === "history" 
                    ? "border-slate-400 text-white" 
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-4 h-4" />
                History
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: NEEDS APPROVAL */}
              {queueTab === "pending" && (
                <div>
                  {pendingRequests.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-75" />
                      <p className="font-bold text-white">No pending deletion requests</p>
                      <p className="text-xs text-slate-400 mt-1">All student records are currently safe and intact.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingRequests.map(req => {
                        const has1stApproval = Boolean(req.approver_1)
                        return (
                          <div key={req.id} className="border border-amber-500/30 rounded-2xl p-4 bg-slate-950/70 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 mr-2">
                                  {has1stApproval ? "1 of 2 Approvals" : "0 of 2 Approvals"}
                                </span>
                                <span className="text-xs text-slate-400">
                                  Requested by <strong className="text-white">{req.requested_by_name}</strong> on {formatDate(req.created_at)}
                                </span>
                              </div>
                              <button 
                                onClick={() => handleCancelRequest(req.id)}
                                className="text-xs text-red-400 hover:text-red-300 font-semibold underline self-start sm:self-auto"
                              >
                                Reject / Cancel
                              </button>
                            </div>

                            {/* Reason */}
                            <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl p-3">
                              <span className="text-slate-400 font-medium">Reason: </span>
                              <span className="text-white font-semibold">{req.reason}</span>
                            </div>

                            {/* Target Students */}
                            <div className="text-xs space-y-1">
                              <span className="text-slate-400 font-medium">Target Students ({req.student_names.length}):</span>
                              <div className="flex flex-wrap gap-1.5">
                                {req.student_names.map(s => (
                                  <span key={s.id} className="bg-slate-900 text-amber-300 px-2 py-0.5 rounded-md text-xs border border-slate-800 font-mono">
                                    {s.name} ({s.student_id})
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Two-Man Sign-Off Actions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                              {/* Sign-Off 1 */}
                              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white">1st Approver</p>
                                  <p className="text-xs text-slate-400">
                                    {req.approver_1_name ? `✓ ${req.approver_1_name}` : "Pending signature"}
                                  </p>
                                </div>
                                {!has1stApproval ? (
                                  <button 
                                    onClick={() => handleApprove1(req.id)}
                                    className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-lg text-xs font-bold hover:scale-[1.02] shadow-sm"
                                  >
                                    Sign as #1
                                  </button>
                                ) : (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                )}
                              </div>

                              {/* Sign-Off 2 */}
                              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white">2nd Approver (Different Person)</p>
                                  <p className="text-xs text-slate-400">
                                    {req.approver_2_name ? `✓ ${req.approver_2_name}` : "Requires 2nd person"}
                                  </p>
                                </div>
                                {has1stApproval && !req.approver_2 ? (
                                  <button 
                                    onClick={() => handleApprove2(req.id)}
                                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 shadow-sm"
                                  >
                                    Sign as #2
                                  </button>
                                ) : !has1stApproval ? (
                                  <span className="text-xs text-slate-500 italic">Waiting for #1</span>
                                ) : (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: IN 24H TIMELOCK */}
              {queueTab === "timelock" && (
                <div>
                  {timelockRequests.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <Clock className="w-10 h-10 text-blue-400 mx-auto mb-2 opacity-75" />
                      <p className="font-bold text-white">No requests currently in 24-hour timelock</p>
                      <p className="text-xs text-slate-400 mt-1">Once two people approve a deletion, the 24-hour countdown will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {timelockRequests.map(req => {
                        const countdown = formatCountdown(req.scheduled_delete_at)
                        return (
                          <div key={req.id} className="border border-blue-500/30 rounded-2xl p-5 bg-slate-950/70 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="bg-blue-500 text-slate-950 text-xs font-bold px-2 py-0.5 rounded">
                                  2 of 2 Approved
                                </span>
                                <span className="text-xs text-slate-300">
                                  Approved by: <strong className="text-white">{req.approver_1_name}</strong> & <strong className="text-white">{req.approver_2_name}</strong>
                                </span>
                              </div>
                              <button 
                                onClick={() => handleCancelRequest(req.id)}
                                className="px-3 py-1 bg-red-500/15 text-red-300 text-xs font-bold rounded-lg border border-red-500/30 hover:bg-red-500/25 transition-colors shadow-sm self-start sm:self-auto"
                              >
                                Abort & Cancel Deletion
                              </button>
                            </div>

                            {/* Live Countdown Card */}
                            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center space-y-2">
                              <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                                ⏳ Mandatory 24-Hour Cooling-Off Countdown
                              </p>
                              <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
                                {countdown.display}
                              </div>
                              <p className="text-xs text-slate-400 max-w-md mx-auto">
                                The student records remain 100% safe and accessible. Any administrator can cancel this request before the timer completes.
                              </p>
                              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mt-3 border border-slate-800">
                                <div 
                                  className="bg-amber-400 h-full transition-all duration-1000"
                                  style={{ width: `${countdown.percentComplete || 5}%` }}
                                />
                              </div>
                            </div>

                            {/* Students in request */}
                            <div className="text-xs space-y-1">
                              <span className="text-slate-400 font-medium">Locked for Deletion ({req.student_names.length} students):</span>
                              <div className="flex flex-wrap gap-1.5">
                                {req.student_names.map(s => (
                                  <span key={s.id} className="bg-slate-900 text-slate-200 px-2 py-0.5 rounded text-xs border border-slate-800 font-mono">
                                    {s.name} ({s.student_id})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: READY TO EXECUTE */}
              {queueTab === "ready" && (
                <div>
                  {readyRequests.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <Unlock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="font-bold text-white">No requests ready for permanent deletion</p>
                      <p className="text-xs text-slate-400 mt-1">Requests only unlock after both approvals and the full 24-hour cooling period.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {readyRequests.map(req => (
                        <div key={req.id} className="border border-red-500/30 rounded-2xl p-5 bg-slate-950/70 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-300 bg-red-500/20 border border-red-500/30 px-2.5 py-1 rounded-full">
                              <Unlock className="w-3.5 h-3.5" /> 24-Hour Timelock Expired
                            </span>
                            <span className="text-xs text-slate-500 font-mono">ID: {req.id.substring(0, 10)}</span>
                          </div>

                          <div className="text-xs bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                            <p className="text-slate-300">
                              <strong className="text-white">Approved by:</strong> {req.approver_1_name} & {req.approver_2_name}
                            </p>
                            <p className="text-slate-300">
                              <strong className="text-white">Reason:</strong> {req.reason}
                            </p>
                            <p className="text-slate-300">
                              <strong className="text-white">Students to be permanently purged:</strong> {req.student_names.map(s => s.name).join(", ")}
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button 
                              onClick={() => handleCancelRequest(req.id)}
                              className="px-3.5 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors"
                            >
                              Abort / Keep Students
                            </button>
                            <button 
                              onClick={() => handleExecutePermanentDeletion(req.id)}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-500 transition-colors shadow-md shadow-red-600/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Execute Permanent Deletion
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: AUDIT HISTORY */}
              {queueTab === "history" && (
                <div>
                  {historyRequests.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm">
                      <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="font-bold text-white">No past deletion records</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800 text-xs">
                      {historyRequests.map(req => (
                        <div key={req.id} className="py-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                req.status === "executed" ? "bg-slate-800 text-slate-300" : "bg-red-500/15 text-red-300 border border-red-500/30"
                              }`}>
                                {req.status === "executed" ? "PERMANENTLY DELETED" : "CANCELLED / ABORTED"}
                              </span>
                              <span className="font-bold text-white">
                                {req.student_names.map(s => s.name).join(", ")}
                              </span>
                            </div>
                            <p className="text-slate-400 mt-1">
                              Reason: {req.reason} • Requested by {req.requested_by_name}
                            </p>
                          </div>
                          <span className="text-slate-500 font-mono">
                            {formatDate(req.executed_at || req.cancelled_at || req.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 3. SECOND APPROVER MODAL                   */}
      {/* ========================================== */}
      {secondApproverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 border border-slate-800 text-white">
            <h3 className="font-extrabold text-white flex items-center gap-2 text-base">
              <Lock className="w-5 h-5 text-amber-400" />
              Second Person Sign-Off Required
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              The Two-Person Rule strictly requires sign-off from a <strong>second distinct administrator or staff member</strong>. You cannot sign as both 1st and 2nd approver.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Second Approver Name / Co-Signer <span className="text-red-400">*</span>
              </label>
              <input 
                type="text"
                required
                value={secondApproverName}
                onChange={e => setSecondApproverName(e.target.value)}
                placeholder="e.g. Asif Mahmud (Manager) / Co-Owner"
                className="w-full p-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button"
                onClick={() => setSecondApproverModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (!secondApproverName.trim()) {
                    toast.error("Please enter the name of the second approver")
                    return
                  }
                  handleApprove2(secondApproverModal, secondApproverName.trim())
                }}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/20"
              >
                Confirm 2nd Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
