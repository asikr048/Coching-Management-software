"use client"

import { useState } from "react"
import { X, Printer, Download, QrCode, ShieldCheck, User, Phone, BookOpen, Layers, Check, Copy, ExternalLink } from "lucide-react"
import { StudentIdCardData, printStudentIdCard, downloadStudentIdCardPDF } from "@/lib/id-card-generator"
import { toast } from "sonner"

interface Props {
  isOpen: boolean
  onClose: () => void
  cardData?: StudentIdCardData | null
  student?: any
  batchName?: string
  rollNo?: string | number | null
}

export default function StudentIdCardModal({ isOpen, onClose, cardData, student, batchName, rollNo }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeCardData: StudentIdCardData | null = cardData || (student ? {
    student_name: student?.name || student?.student_name || "Student",
    student_id: student?.student_id || student?.user_id || "N/A",
    batch_name: batchName || student?.batch_name || student?.batch?.name || "Enrolled Batch",
    batch_roll: rollNo ?? student?.roll_no ?? student?.batch_roll ?? null,
    student_phone: student?.phone || student?.student_phone,
    guardian_name: student?.guardian_name,
    guardian_phone: student?.guardian_phone,
    branch_name: student?.branch_name || student?.branch?.name,
    blood_group: student?.blood_group,
    avatar_url: student?.avatar_url || student?.photo_url,
    address: student?.address,
  } : null)

  if (!isOpen || !activeCardData) return null

  const rollStr = activeCardData.batch_roll != null && String(activeCardData.batch_roll).trim() !== "" 
    ? String(activeCardData.batch_roll) 
    : "01"

  const qrData = activeCardData.qr_data || `MEDHASHIREE-ID:${activeCardData.student_id}|ROLL:${rollStr}|BATCH:${activeCardData.batch_name}|NAME:${activeCardData.student_name}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`
  const initial = activeCardData.student_name ? activeCardData.student_name.charAt(0).toUpperCase() : "S"

  const handlePrint = () => {
    printStudentIdCard(activeCardData)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadStudentIdCardPDF(activeCardData)
      toast.success("Student ID Card PDF downloaded!")
    } catch (e: any) {
      toast.error(e?.message || "Failed to download PDF")
    } finally {
      setDownloading(false)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(activeCardData.student_id)
    setCopied(true)
    toast.success("Student ID copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
              🪪
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Batch ID Card (শিক্ষার্থী আইডি কার্ড)</h3>
              <p className="text-xs text-slate-500 font-medium">Official Student Identification & Campus Pass</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - ID Card Preview */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center bg-gradient-to-b from-slate-100/60 to-slate-50/40">
          <div className="w-[310px] bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200/90 flex flex-col transition-transform hover:scale-[1.01] duration-300">
            {/* ID Card Header */}
            <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white p-4 text-center relative">
              <div className="text-amber-400 font-black text-sm tracking-wider uppercase">মেধা সিঁড়ি কোচিং</div>
              <div className="text-indigo-200 text-[10px] font-medium tracking-wide">MedhaShiree Academic Care</div>
              <div className="inline-block bg-white/15 border border-white/25 text-[9px] font-bold text-white px-2 py-0.5 rounded-full mt-1 uppercase tracking-wider">
                STUDENT IDENTIFICATION CARD
              </div>
            </div>

            {/* ID Card Body */}
            <div className="p-4 flex flex-col items-center">
              <div className="relative mt-1 mb-2">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-3xl flex items-center justify-center shadow-lg border-4 border-white">
                  {initial}
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap border-2 border-white shadow-md">
                  রোল: #{rollStr}
                </div>
              </div>

              <h4 className="font-black text-slate-900 text-base mt-2 text-center leading-tight">
                {activeCardData.student_name}
              </h4>

              <div className="flex items-center gap-1.5 mt-1">
                <span className="font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black px-2.5 py-0.5 rounded-md">
                  ID: {activeCardData.student_id}
                </span>
                <button
                  onClick={handleCopyId}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                  title="Copy ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="w-full mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200">
                  <span className="text-slate-500 font-semibold text-[11px]">ব্যাচ (Batch):</span>
                  <span className="font-black text-indigo-900 text-right truncate max-w-[150px]">{activeCardData.batch_name}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200">
                  <span className="text-slate-500 font-semibold text-[11px]">ব্যাচ রোল (Batch Roll):</span>
                  <span className="font-mono font-black text-rose-600 text-xs">#{rollStr}</span>
                </div>
                {activeCardData.subject && (
                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200">
                    <span className="text-slate-500 font-semibold text-[11px]">বিষয় (Subject):</span>
                    <span className="font-bold text-slate-800 text-right">{activeCardData.subject}</span>
                  </div>
                )}
                {activeCardData.student_phone && (
                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200">
                    <span className="text-slate-500 font-semibold text-[11px]">শিক্ষার্থীর ফোন:</span>
                    <span className="font-mono font-bold text-slate-800">{activeCardData.student_phone}</span>
                  </div>
                )}
                {activeCardData.guardian_phone && (
                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200">
                    <span className="text-slate-500 font-semibold text-[11px]">অভিভাবকের ফোন:</span>
                    <span className="font-mono font-bold text-slate-800">{activeCardData.guardian_phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-semibold text-[11px]">সেশন (Session):</span>
                  <span className="font-bold text-slate-800">{activeCardData.valid_till || `${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`}</span>
                </div>
              </div>
            </div>

            {/* ID Card Footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
              <div className="text-[9px] text-slate-500 leading-tight">
                <b className="text-slate-700">Official Student Pass</b><br />
                Campus & Exam Entry
              </div>
              <img src={qrUrl} alt="QR Code" className="w-10 h-10 rounded border border-slate-200 bg-white p-0.5" />
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Ready for thermal, plastic, or A4 paper printing
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              {downloading ? "Downloading..." : "PDF Download"}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-200 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print ID Card (প্রিন্ট)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
