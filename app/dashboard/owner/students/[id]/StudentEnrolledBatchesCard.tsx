"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { 
  RefreshCw, Trash2, Plus, Loader2, X, AlertTriangle, 
  CheckCircle2, ArrowRight, BookOpen, Users, Hash
} from "lucide-react"
import StudentIdCardTrigger from "@/components/id-card/StudentIdCardTrigger"
import AdmissionSlipTrigger from "@/components/id-card/AdmissionSlipTrigger"

interface Batch {
  id: string
  name: string
  subject?: string
  class_level?: string
  current_seats?: number
  max_seats?: number
  branch_id?: string | null
  monthly_fee?: number
  admission_fee?: number
  is_active?: boolean
  status?: string
}

interface Enrollment {
  id: string
  student_id: string
  batch_id: string
  roll_no?: number | null
  status: string
  created_at?: string
  batch?: Batch
}

interface StudentEnrolledBatchesCardProps {
  student: any
  initialEnrollments: Enrollment[]
  allBatches: Batch[]
  payments?: any[]
  duesList?: any[]
}

export default function StudentEnrolledBatchesCard({
  student,
  initialEnrollments,
  allBatches = [],
  payments = [],
  duesList = []
}: StudentEnrolledBatchesCardProps) {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments)

  // Modals state
  const [changingEnrollment, setChangingEnrollment] = useState<Enrollment | null>(null)
  const [deletingEnrollment, setDeletingEnrollment] = useState<Enrollment | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Form states for Change Batch
  const [targetBatchId, setTargetBatchId] = useState("")
  const [customRoll, setCustomRoll] = useState<string>("")
  const [calculatingRoll, setCalculatingRoll] = useState(false)
  const [rollPreview, setRollPreview] = useState<{ highest: number; next: number; count: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states for Add Batch
  const [addBatchId, setAddBatchId] = useState("")
  const [addCustomRoll, setAddCustomRoll] = useState<string>("")
  const [addCalculatingRoll, setAddCalculatingRoll] = useState(false)
  const [addRollPreview, setAddRollPreview] = useState<{ highest: number; next: number; count: number } | null>(null)
  const [addingSubmitting, setAddingSubmitting] = useState(false)

  // Deleting state
  const [deletingLoading, setDeletingLoading] = useState(false)

  // Filter batches available for change/add (exclude currently enrolled batches)
  const enrolledBatchIds = useMemo(() => {
    return new Set(enrollments.map(e => e.batch_id))
  }, [enrollments])

  const availableBatchesForChange = useMemo(() => {
    return allBatches.filter(b => b.id !== changingEnrollment?.batch_id && !enrolledBatchIds.has(b.id))
  }, [allBatches, changingEnrollment, enrolledBatchIds])

  const availableBatchesForAdd = useMemo(() => {
    return allBatches.filter(b => !enrolledBatchIds.has(b.id))
  }, [allBatches, enrolledBatchIds])

  // Fetch next roll when target batch is selected in Change modal
  async function handleTargetBatchSelect(batchId: string) {
    setTargetBatchId(batchId)
    setRollPreview(null)
    setCustomRoll("")

    if (!batchId) return

    setCalculatingRoll(true)
    try {
      const res = await fetch(`/api/student/enrollment?batch_id=${batchId}`)
      const data = await res.json()
      if (data.success) {
        setRollPreview({
          highest: data.highest_roll || 0,
          next: data.next_roll || 1,
          count: data.student_count || 0
        })
        setCustomRoll(String(data.next_roll || 1))
      } else {
        toast.error(data.error || "Could not calculate next roll.")
      }
    } catch (e) {
      toast.error("Failed to fetch roll information.")
    } finally {
      setCalculatingRoll(false)
    }
  }

  // Fetch next roll when batch is selected in Add modal
  async function handleAddBatchSelect(batchId: string) {
    setAddBatchId(batchId)
    setAddRollPreview(null)
    setAddCustomRoll("")

    if (!batchId) return

    setAddCalculatingRoll(true)
    try {
      const res = await fetch(`/api/student/enrollment?batch_id=${batchId}`)
      const data = await res.json()
      if (data.success) {
        setAddRollPreview({
          highest: data.highest_roll || 0,
          next: data.next_roll || 1,
          count: data.student_count || 0
        })
        setAddCustomRoll(String(data.next_roll || 1))
      } else {
        toast.error(data.error || "Could not calculate next roll.")
      }
    } catch (e) {
      toast.error("Failed to fetch roll information.")
    } finally {
      setAddCalculatingRoll(false)
    }
  }

  // Open Change Batch modal
  function openChangeModal(enr: Enrollment) {
    setChangingEnrollment(enr)
    setTargetBatchId("")
    setCustomRoll("")
    setRollPreview(null)
  }

  // Submit Change Batch
  async function submitChangeBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!changingEnrollment || !targetBatchId) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/student/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_batch",
          student_id: student.id,
          enrollment_id: changingEnrollment.id,
          new_batch_id: targetBatchId,
          custom_roll_no: customRoll ? parseInt(customRoll, 10) : undefined
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to change batch.")
      }

      toast.success(data.message || "Batch changed successfully!")
      
      // Update local state
      if (data.enrollment) {
        setEnrollments(prev =>
          prev.map(item => (item.id === changingEnrollment.id ? data.enrollment : item))
        )
      }

      setChangingEnrollment(null)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change batch.")
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Add Batch Enrollment
  async function submitAddBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!addBatchId) return

    setAddingSubmitting(true)
    try {
      const res = await fetch("/api/student/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_enrollment",
          student_id: student.id,
          batch_id: addBatchId,
          custom_roll_no: addCustomRoll ? parseInt(addCustomRoll, 10) : undefined
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to enroll into batch.")
      }

      toast.success(data.message || "Student enrolled successfully!")

      if (data.enrollment) {
        setEnrollments(prev => [...prev, data.enrollment])
      }

      setShowAddModal(false)
      setAddBatchId("")
      setAddRollPreview(null)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll into batch.")
    } finally {
      setAddingSubmitting(false)
    }
  }

  // Open Delete Confirmation modal
  function openDeleteModal(enr: Enrollment) {
    setDeletingEnrollment(enr)
  }

  // Confirm Delete Enrollment
  async function confirmDeleteEnrollment() {
    if (!deletingEnrollment) return

    setDeletingLoading(true)
    try {
      const res = await fetch("/api/student/enrollment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.id,
          enrollment_id: deletingEnrollment.id
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete enrollment.")
      }

      toast.success(data.message || "Enrollment deleted.")

      // Remove from local state
      setEnrollments(prev => prev.filter(e => e.id !== deletingEnrollment.id))
      setDeletingEnrollment(null)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete enrollment.")
    } finally {
      setDeletingLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-black text-slate-900 text-base">Enrolled Batches</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {enrollments.length === 1 ? "1 active batch" : `${enrollments.length} active batches`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddModal(true)
            setAddBatchId("")
            setAddRollPreview(null)
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Enroll Batch
        </button>
      </div>

      {/* Batches List */}
      <div className="space-y-2.5">
        {enrollments.map(e => {
          const roll = e.roll_no ?? student.roll_no ?? student.batch_roll
          return (
            <div
              key={e.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
            >
              {/* Batch info & roll */}
              <div className="flex items-center gap-3">
                {roll != null ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    রোল #{roll}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-200 text-slate-600 border border-slate-300">
                    রোল নেই
                  </span>
                )}
                <div>
                  <p className="font-bold text-slate-900 text-sm">{e.batch?.name || "Untitled Batch"}</p>
                  <p className="text-xs text-slate-500">
                    {e.batch?.subject ? `${e.batch.subject}` : ""}
                    {e.batch?.class_level ? ` • ${e.batch.class_level}` : ""}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                {/* ID Card */}
                <StudentIdCardTrigger
                  student={student}
                  batchName={e.batch?.name}
                  rollNo={roll}
                  buttonVariant="badge"
                  buttonText="🪪 ID Card"
                />

                {/* Admission Slip */}
                <AdmissionSlipTrigger
                  student={student}
                  batch={e.batch}
                  enrollment={e}
                  payment={payments?.find((p: any) => p.batch_id === e.batch_id || !p.batch_id)}
                  due={duesList?.find((d: any) => d.batch_id === e.batch_id || !d.batch_id)}
                  buttonVariant="badge"
                  buttonText="🧾 Admission Slip"
                />

                {/* Status Badge */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    e.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  {e.status}
                </span>

                {/* Change Batch button */}
                <button
                  type="button"
                  onClick={() => openChangeModal(e)}
                  title="Change this student's batch"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  Change Batch
                </button>

                {/* Delete Enrollment button */}
                <button
                  type="button"
                  onClick={() => openDeleteModal(e)}
                  title="Remove student from this batch"
                  className="inline-flex items-center gap-1 p-1.5 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {enrollments.length === 0 && (
        <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-semibold text-sm">Not enrolled in any batches</p>
          <p className="text-slate-400 text-xs mt-0.5">Click &quot;Enroll Batch&quot; above to assign a batch.</p>
        </div>
      )}

      {/* ===================== MODAL: CHANGE BATCH ===================== */}
      {changingEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Change Enrolled Batch</h4>
                  <p className="text-xs text-slate-500">
                    {student.name} ({student.student_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangingEnrollment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={submitChangeBatch} className="p-4 sm:p-6 space-y-4">
              {/* Current Batch Info */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-amber-800 font-medium">Current Batch:</span>
                  <span className="font-bold">{changingEnrollment.batch?.name || "Unknown"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-800 font-medium">Current Roll in Batch:</span>
                  <span className="font-mono font-black bg-amber-200 px-2 py-0.5 rounded text-amber-950">
                    #{changingEnrollment.roll_no ?? student.roll_no ?? "-"}
                  </span>
                </div>
              </div>

              {/* Target Batch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select New Batch *
                </label>
                <select
                  required
                  value={targetBatchId}
                  onChange={e => handleTargetBatchSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                >
                  <option value="">-- Choose New Batch --</option>
                  {availableBatchesForChange.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.subject ? `(${b.subject})` : ""} {b.class_level ? `[${b.class_level}]` : ""}
                    </option>
                  ))}
                </select>
                {availableBatchesForChange.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No other available batches to transfer to.</p>
                )}
              </div>

              {/* Roll preview for the selected batch */}
              {calculatingRoll && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Calculating next roll in selected batch...</span>
                </div>
              )}

              {rollPreview && !calculatingRoll && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-800">Previous Highest Roll in Batch:</span>
                    <span className="font-bold">
                      {rollPreview.highest > 0 ? `#${rollPreview.highest}` : "None (0)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Assigned New Roll (Previous + 1):
                    </span>
                    <span className="font-mono font-black text-sm bg-emerald-200 px-2 py-0.5 rounded text-emerald-950">
                      #{rollPreview.next}
                    </span>
                  </div>
                </div>
              )}

              {/* Optional Custom Roll Override */}
              {targetBatchId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Batch Roll Number (রোল নম্বর)</span>
                    <span className="text-[11px] font-normal text-slate-400">Default: Highest + 1</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 1, 2, 3..."
                      value={customRoll}
                      onChange={e => setCustomRoll(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                    <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>
              )}

              {/* Informational callout */}
              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                💡 Upon changing batches, the student will be removed from the previous batch (freeing roll #{changingEnrollment.roll_no || "-"}) and enrolled into the new batch with the assigned roll.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setChangingEnrollment(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !targetBatchId}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Change Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: DELETE ENROLLMENT ===================== */}
      {deletingEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-rose-100 bg-rose-50/70 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-rose-950 text-base">Remove Enrolled Batch?</h4>
                <p className="text-xs text-rose-700 mt-0.5">This will unenroll the student from this batch.</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-3.5 text-sm">
              <p className="text-slate-700 text-xs sm:text-sm">
                Are you sure you want to remove <strong className="text-slate-900">{student.name}</strong> from batch <strong className="text-slate-900">{deletingEnrollment.batch?.name}</strong>?
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student Roll in Batch:</span>
                  <span className="font-mono font-bold text-slate-900">
                    #{deletingEnrollment.roll_no ?? student.roll_no ?? "None"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch Seats:</span>
                  <span className="text-slate-900 font-semibold">Seat will be decremented & freed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Roll Status:</span>
                  <span className="text-rose-700 font-bold">Freed (will belong to no one)</span>
                </div>
              </div>

              {enrollments.length === 1 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  ⚠️ This is the student&apos;s only enrolled batch. Upon removal, the student will have no active batch and their profile roll number will be cleared.
                </p>
              ) : (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  ℹ️ The student remains enrolled in {enrollments.length - 1} other batch(es). Their profile roll will sync to their remaining active batch.
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deletingLoading}
                  onClick={() => setDeletingEnrollment(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingLoading}
                  onClick={confirmDeleteEnrollment}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50 transition-all"
                >
                  {deletingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ENROLL TO NEW BATCH ===================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Enroll in New Batch</h4>
                  <p className="text-xs text-slate-500">
                    {student.name} ({student.student_id})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submitAddBatch} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Batch *
                </label>
                <select
                  required
                  value={addBatchId}
                  onChange={e => handleAddBatchSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                >
                  <option value="">-- Choose Batch --</option>
                  {availableBatchesForAdd.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.subject ? `(${b.subject})` : ""} {b.class_level ? `[${b.class_level}]` : ""}
                    </option>
                  ))}
                </select>
                {availableBatchesForAdd.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Student is already enrolled in all available batches.</p>
                )}
              </div>

              {/* Roll calculation */}
              {addCalculatingRoll && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Calculating next roll in batch...</span>
                </div>
              )}

              {addRollPreview && !addCalculatingRoll && (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-800">Previous Highest Roll in Batch:</span>
                    <span className="font-bold">
                      {addRollPreview.highest > 0 ? `#${addRollPreview.highest}` : "None (0)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                    <span className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Assigned Roll (Previous + 1):
                    </span>
                    <span className="font-mono font-black text-sm bg-emerald-200 px-2 py-0.5 rounded text-emerald-950">
                      #{addRollPreview.next}
                    </span>
                  </div>
                </div>
              )}

              {/* Custom Roll */}
              {addBatchId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Batch Roll Number (রোল নম্বর)</span>
                    <span className="text-[11px] font-normal text-slate-400">Default: Highest + 1</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 1, 2, 3..."
                      value={addCustomRoll}
                      onChange={e => setAddCustomRoll(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                    <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={addingSubmitting}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSubmitting || !addBatchId}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all"
                >
                  {addingSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
