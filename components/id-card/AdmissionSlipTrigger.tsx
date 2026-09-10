"use client"

import { useState } from "react"
import { Printer, Download, FileText, Sparkles, CreditCard, Eye, X, CheckCircle2 } from "lucide-react"
import { 
  AdmissionSlipData, 
  StudentIdCardData, 
  printAdmissionSlip, 
  downloadAdmissionSlipPDF, 
  printStudentIdCard, 
  downloadStudentIdCardPDF, 
  printAdmissionAndIdCard 
} from "@/lib/id-card-generator"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Props {
  slipData?: AdmissionSlipData | null
  student?: any
  batch?: any
  enrollment?: any
  payment?: any
  due?: any
  variant?: "primary" | "badge" | "outline" | "icon" | "button"
  buttonVariant?: "primary" | "badge" | "outline" | "icon" | "button"
  className?: string
  label?: string
  buttonText?: string
}

export default function AdmissionSlipTrigger({
  slipData,
  student,
  batch,
  enrollment,
  payment,
  due,
  variant,
  buttonVariant,
  className = "",
  label,
  buttonText,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [modalTab, setModalTab] = useState<"slip" | "idcard" | "both">("slip")

  // Resolve roll number
  const roll = enrollment?.roll_no ?? student?.roll_no ?? student?.batch_roll ?? 1
  const rollStr = String(roll)

  // Resolve batch name and subject
  const batchName = batch?.name || enrollment?.batch?.name || student?.batch_name || "Enrolled Batch"
  const subjectName = batch?.subject || enrollment?.batch?.subject || batch?.class_level || student?.class_level || "General"

  // Resolve fees
  const totalFee = payment?.amount ?? (batch?.monthly_fee ? (batch.monthly_fee + (batch.admission_fee || 0)) : (due?.due_amount || 0))
  const paidAmt = payment?.total_paid ?? payment?.amount ?? (due?.paid_amount || 0)
  const dueAmt = due ? Math.max(0, (due.due_amount || totalFee) - (due.paid_amount || paidAmt)) : Math.max(0, totalFee - paidAmt)

  const dateStr = enrollment?.created_at
    ? formatDate(enrollment.created_at)
    : payment?.paid_at || payment?.created_at
    ? formatDate(payment.paid_at || payment.created_at)
    : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

  const receiptNo = payment?.receipt_number || `RCP-${new Date().getFullYear()}-${(student?.id || '').slice(-6).toUpperCase() || 'ADM'}`

  const finalSlipData: AdmissionSlipData = slipData || {
    receipt_number: receiptNo,
    student_name: student?.name || "Student",
    student_id: student?.student_id || student?.user_id || "N/A",
    student_phone: student?.phone,
    student_email: student?.email,
    guardian_name: student?.guardian_name,
    guardian_phone: student?.guardian_phone,
    batch_name: batchName,
    batch_roll: roll,
    branch_name: student?.branch?.name || student?.branch_name,
    subject: subjectName,
    date: dateStr,
    total_fee: totalFee,
    paid_amount: paidAmt,
    due_amount: dueAmt,
    due_date: due?.due_date ? formatDate(due.due_date) : undefined,
    payment_method: payment?.payment_method?.toUpperCase() || "CASH / COUNTER",
  }

  const finalCardData: StudentIdCardData = {
    student_name: finalSlipData.student_name,
    student_id: finalSlipData.student_id,
    batch_name: finalSlipData.batch_name,
    batch_roll: finalSlipData.batch_roll,
    student_phone: finalSlipData.student_phone,
    guardian_name: finalSlipData.guardian_name,
    guardian_phone: finalSlipData.guardian_phone,
    branch_name: finalSlipData.branch_name,
    subject: finalSlipData.subject,
    blood_group: student?.blood_group,
    avatar_url: student?.avatar_url || student?.photo_url,
  }

  const activeVariant = buttonVariant || variant || "button"
  const activeText = buttonText || label || "🧾 Admission Slip"

  return (
    <>
      {activeVariant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors cursor-pointer ${className}`}
          title="Print / Download Admission Slip & ID Card"
        >
          <FileText className="w-4 h-4" />
        </button>
      ) : activeVariant === "badge" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${className}`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-600" />
          <span>{activeText}</span>
        </button>
      ) : activeVariant === "outline" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 px-3.5 py-2 border border-amber-300 hover:border-amber-400 bg-white hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${className}`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-600" />
          <span>{activeText}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-200 transition-all cursor-pointer ${className}`}
        >
          <FileText className="w-4 h-4" />
          <span>{activeText}</span>
        </button>
      )}

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold text-sm">
                  📄
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Admission Memo & Student ID Slip</h3>
                  <p className="text-[11px] text-slate-300 font-mono">{finalSlipData.student_name} ({finalSlipData.student_id})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub Nav Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/80 px-6 pt-3 gap-3">
              <button
                type="button"
                onClick={() => setModalTab("slip")}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "slip"
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Admission Slip (ভর্তি রসিদ)</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab("idcard")}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "idcard"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Student ID Card (আইডি কার্ড)</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab("both")}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  modalTab === "both"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Combined (উভয় স্লিপ)</span>
              </button>
            </div>

            {/* Modal Body / Preview */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {modalTab === "slip" && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="text-center pb-2 border-b border-slate-200">
                    <h4 className="font-black text-slate-900 text-base">MedhaShiree Coaching</h4>
                    <p className="text-xs text-slate-500">Official Admission & Fee Confirmation</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">Student:</span> <b className="text-slate-900">{finalSlipData.student_name}</b></div>
                    <div><span className="text-slate-400">ID:</span> <b className="text-amber-700 font-mono">{finalSlipData.student_id}</b></div>
                    <div><span className="text-slate-400">Batch:</span> <b className="text-slate-900">{finalSlipData.batch_name}</b></div>
                    <div><span className="text-slate-400">Batch Roll:</span> <b className="text-rose-600 font-mono font-black">#{rollStr}</b></div>
                    <div><span className="text-slate-400">Total Fee:</span> <b className="text-slate-900">{formatCurrency(finalSlipData.total_fee)}</b></div>
                    <div><span className="text-slate-400">Paid:</span> <b className="text-emerald-600">{formatCurrency(finalSlipData.paid_amount)}</b></div>
                    <div><span className="text-slate-400">Remaining Due:</span> <b className={finalSlipData.due_amount > 0 ? "text-rose-600 font-black" : "text-emerald-600"}>{formatCurrency(finalSlipData.due_amount)}</b></div>
                    <div><span className="text-slate-400">Date:</span> <span className="text-slate-700 font-medium">{finalSlipData.date}</span></div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Ref: {finalSlipData.receipt_number}</span>
                    <span>Status: {finalSlipData.due_amount > 0 ? "Due Pending" : "Paid in Full"}</span>
                  </div>
                </div>
              )}

              {modalTab === "idcard" && (
                <div className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50/30 flex flex-col items-center text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-amber-500 text-white font-black text-xl flex items-center justify-center shadow-md">
                    {finalSlipData.student_name.charAt(0)}
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{finalSlipData.student_name}</h4>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-mono text-xs font-bold">
                    <span>ID: {finalSlipData.student_id}</span>
                    <span>•</span>
                    <span className="text-rose-600 font-black">রোল #{rollStr}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">{finalSlipData.batch_name}</p>
                  <p className="text-[11px] text-slate-400">MedhaShiree Official Academic Pass</p>
                </div>
              )}

              {modalTab === "both" && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                    ✓ Printable A4 sheet containing both the <b>Admission Slip</b> and the <b>Student Identification Pass</b> ready for printing.
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div><b>Student:</b> {finalSlipData.student_name}</div>
                    <div><b>Roll:</b> #{rollStr}</div>
                    <div><b>Batch:</b> {finalSlipData.batch_name}</div>
                    <div><b>Paid:</b> {formatCurrency(finalSlipData.paid_amount)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {modalTab === "slip" && (
                  <>
                    <button
                      type="button"
                      onClick={() => printAdmissionSlip(finalSlipData)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadAdmissionSlipPDF(finalSlipData)}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-600" />
                      <span>PDF</span>
                    </button>
                  </>
                )}

                {modalTab === "idcard" && (
                  <>
                    <button
                      type="button"
                      onClick={() => printStudentIdCard(finalCardData)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print ID Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadStudentIdCardPDF(finalCardData)}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>ID PDF</span>
                    </button>
                  </>
                )}

                {modalTab === "both" && (
                  <button
                    type="button"
                    onClick={() => printAdmissionAndIdCard(finalSlipData, finalCardData)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Both (Slip + ID Card)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
