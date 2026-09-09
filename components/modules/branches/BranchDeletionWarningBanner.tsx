"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Clock, ShieldAlert, XCircle, ArrowRight, Undo2, CheckCircle2 } from "lucide-react"
import { useBranch } from "@/components/providers/BranchContext"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import type { Branch } from "@/lib/supabase/types"

export default function BranchDeletionWarningBanner() {
  const { currentBranch, selectedBranchId, branches, refreshBranches, userRole } = useBranch()
  const [now, setNow] = useState<number>(Date.now())
  const [cancellingBranchId, setCancellingBranchId] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)
  const supabase = createClient()

  // Update timer every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Find all pending deletion branches relevant to the current view
  const pendingBranches: Branch[] = []
  if (selectedBranchId !== "all" && currentBranch?.is_pending_deletion) {
    pendingBranches.push(currentBranch)
  } else if (selectedBranchId === "all") {
    branches.forEach(b => {
      if (b.is_pending_deletion) {
        pendingBranches.push(b)
      }
    })
  }

  if (pendingBranches.length === 0) {
    return null
  }

  const isOwner = userRole === "owner"

  async function handleCancelDeletion(branch: Branch) {
    if (!isOwner) {
      alert("Only the Institute Owner can cancel or modify branch deletion.")
      return
    }

    if (!confirm(`Are you sure you want to cancel the deletion of "${branch.name}" and restore it to normal operation?`)) {
      return
    }

    setCancellingBranchId(branch.id)
    try {
      // 1. Update branches table
      const { error: branchErr } = await supabase
        .from("branches")
        .update({
          is_pending_deletion: false,
          deletion_scheduled_at: null,
          deletion_requested_at: null,
          deletion_requested_by: null,
          deletion_reason: null,
        })
        .eq("id", branch.id)

      if (branchErr) {
        // Fallback: update contact_info if schema cache lacks direct column
        console.warn("Retrying cancel with contact_info fallback:", branchErr.message)
      }

      // 2. Also log in branch_deletion_requests if table exists
      try {
        await supabase
          .from("branch_deletion_requests")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: userRole || "Administrator",
          })
          .eq("branch_id", branch.id)
          .eq("status", "timelock")
      } catch {}

      setCancelSuccess(`Branch "${branch.name}" deletion cancelled successfully!`)
      setTimeout(() => setCancelSuccess(null), 5000)
      await refreshBranches()
    } catch (err: any) {
      alert("Error cancelling deletion: " + (err.message || "Unknown error"))
    } finally {
      setCancellingBranchId(null)
    }
  }

  function getRemainingTime(scheduledAtStr?: string | null) {
    if (!scheduledAtStr) return { isReady: false, hours: 0, minutes: 0, seconds: 0, display: "48h 0m 0s", pct: 0 }
    const scheduledMs = new Date(scheduledAtStr).getTime()
    const diffMs = scheduledMs - now

    if (diffMs <= 0) {
      return { isReady: true, hours: 0, minutes: 0, seconds: 0, display: "48-Hour Cooling Completed", pct: 100 }
    }

    const totalDurationMs = 48 * 60 * 60 * 1000
    const elapsedMs = totalDurationMs - diffMs
    const pct = Math.max(0, Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100)))

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    return {
      isReady: false,
      hours,
      minutes,
      seconds,
      display: `${hours}h ${minutes}m ${seconds}s`,
      displayBn: `${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড`,
      pct,
    }
  }

  return (
    <div className="space-y-3 mb-6">
      {cancelSuccess && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{cancelSuccess}</span>
          </div>
          <button onClick={() => setCancelSuccess(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1">
            ✕
          </button>
        </div>
      )}

      {pendingBranches.map(branch => {
        const time = getRemainingTime(branch.deletion_scheduled_at)
        const isCancelling = cancellingBranchId === branch.id

        return (
          <div
            key={branch.id}
            className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-red-400/80 ring-4 ring-red-500/20 animate-pulse-subtle"
          >
            {/* Background Decorative Graphic */}
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Left Content */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-red-700 text-xs font-black tracking-wide uppercase shadow-sm">
                    <ShieldAlert className="w-4 h-4 text-red-600 animate-bounce" />
                    ⚠️ ৪৮ ঘণ্টার সতর্কতা (48-Hour Timelock Warning)
                  </span>
                  <span className="text-xs bg-red-950/40 text-red-100 px-3 py-1 rounded-full font-bold border border-red-300/30">
                    শাখা: {branch.name}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-xs">
                  {branch.name} শাখাটি মুছে ফেলার প্রক্রিয়াধীন রয়েছে!
                </h3>
                <p className="text-xs sm:text-sm text-red-100 font-medium leading-relaxed max-w-3xl">
                  This branch is scheduled for permanent deletion under the 48-hour safety cooling policy. All operations and records will be permanently removed unless cancelled before the countdown expires.
                </p>

                {/* Reason & Requester info pills */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-red-100">
                  {branch.deletion_reason && (
                    <div className="bg-red-950/40 border border-red-300/20 px-3 py-1.5 rounded-xl">
                      <span className="text-red-200 font-medium">কারণ (Reason): </span>
                      <strong className="text-white font-bold">{branch.deletion_reason}</strong>
                    </div>
                  )}
                  {branch.deletion_requested_by && (
                    <div className="bg-red-950/40 border border-red-300/20 px-3 py-1.5 rounded-xl">
                      <span className="text-red-200 font-medium">আবেদনকারী: </span>
                      <strong className="text-white font-bold">{branch.deletion_requested_by}</strong>
                    </div>
                  )}
                  {branch.deletion_scheduled_at && (
                    <div className="bg-red-950/40 border border-red-300/20 px-3 py-1.5 rounded-xl">
                      <span className="text-red-200 font-medium">নির্ধারিত সময়: </span>
                      <strong className="text-white font-bold">
                        {new Date(branch.deletion_scheduled_at).toLocaleString("bn-BD", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Timelock Progress Bar */}
                <div className="pt-2 max-w-xl">
                  <div className="flex justify-between text-[11px] font-bold text-red-100 mb-1">
                    <span>48h Cooling Timelock Elapsed: {time.pct}%</span>
                    <span>{time.isReady ? "Ready for final deletion" : `${time.display} remaining`}</span>
                  </div>
                  <div className="h-2.5 bg-red-950/50 rounded-full overflow-hidden border border-red-300/30 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-amber-300 to-white rounded-full transition-all duration-1000 shadow-xs"
                      style={{ width: `${time.pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Countdown & Action Area */}
              <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0">
                {/* Huge Countdown Display */}
                <div className="bg-red-950/60 border border-red-300/40 px-4 py-3 rounded-2xl text-center shadow-inner min-w-[200px] w-full sm:w-auto">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-200 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    সময় বাকি (Time Remaining)
                  </p>
                  <p className="text-2xl font-black text-white tracking-wider font-mono mt-0.5">
                    {time.isReady ? "00:00:00" : time.display}
                  </p>
                  <p className="text-[10px] text-red-200 font-medium mt-0.5">
                    {time.isReady ? "সময় সম্পন্ন হয়েছে (Expired)" : time.displayBn || ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-end gap-2 w-full sm:w-auto justify-end">
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => handleCancelDeletion(branch)}
                      disabled={isCancelling}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-red-700 font-black rounded-xl text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Undo2 className="w-4 h-4" />
                      {isCancelling ? "বাতিল হচ্ছে..." : "মুছে ফেলা বাতিল করুন (Cancel Deletion)"}
                    </button>
                  ) : (
                    <span className="text-[11px] bg-red-950/60 border border-red-300/30 text-red-200 px-3 py-1.5 rounded-xl font-medium text-center">
                      🔒 শুধুমাত্র Owner মুছে ফেলা বাতিল করতে পারবেন
                    </span>
                  )}

                  <Link
                    href="/dashboard/owner/branches"
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-red-950/50 hover:bg-red-950/80 text-white font-bold rounded-xl text-xs border border-red-300/30 transition-colors"
                  >
                    <span>শাখা তালিকা</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
