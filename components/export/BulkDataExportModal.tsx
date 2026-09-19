"use client"

import { useState } from "react"
import { 
  Download, FileSpreadsheet, Users, BookOpen, Building2, 
  UserCheck, ShieldCheck, X, RefreshCw, Layers, Check, Sparkles 
} from "lucide-react"
import { toast } from "sonner"

interface BulkDataExportModalProps {
  isOpen: boolean
  onClose: () => void
  branches?: Array<{ id: string; name: string }>
  initialBranchId?: string
}

function triggerBrowserDownload(blobContent: string | Blob, filename: string) {
  const blob = typeof blobContent === "string" 
    ? new Blob([blobContent], { type: "text/csv;charset=utf-8;" })
    : blobContent
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function BulkDataExportModal({
  isOpen,
  onClose,
  branches = [],
  initialBranchId = "all"
}: BulkDataExportModalProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranchId)
  const [downloadingType, setDownloadingType] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDownloadSingle = async (type: "students" | "batches" | "branches" | "staff") => {
    setDownloadingType(type)
    try {
      const branchParam = selectedBranch !== "all" ? `&branch_id=${encodeURIComponent(selectedBranch)}` : ""
      const res = await fetch(`/api/export/csv?type=${type}${branchParam}`)

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `Failed to export ${type}`)
      }

      const blob = await res.blob()
      const todayStr = new Date().toISOString().split("T")[0]
      const filename = `medhashiree_${type}_${todayStr}.csv`

      triggerBrowserDownload(blob, filename)
      toast.success(`${type.toUpperCase()} CSV সফলভাবে ডাউনলোড হয়েছে!`)
    } catch (err: any) {
      console.error(`Export ${type} error:`, err)
      toast.error(err?.message || `Failed to download ${type} CSV`)
    } finally {
      setDownloadingType(null)
    }
  }

  const handleDownloadAll = async () => {
    setDownloadingType("all")
    try {
      const branchParam = selectedBranch !== "all" ? `&branch_id=${encodeURIComponent(selectedBranch)}` : ""
      const res = await fetch(`/api/export/csv?type=all${branchParam}`)

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Failed to export complete data package")
      }

      const data = await res.json()
      if (!data.success || !data.files) {
        throw new Error(data.error || "Invalid export response")
      }

      const files = data.files
      const fileKeys = Object.keys(files)

      // Trigger download for each file with a small stagger to avoid browser popup blocks
      for (let i = 0; i < fileKeys.length; i++) {
        const key = fileKeys[i]
        const fileObj = files[key]
        setTimeout(() => {
          triggerBrowserDownload(fileObj.content, fileObj.filename)
        }, i * 400)
      }

      toast.success(`সফলভাবে ${fileKeys.length}টি CSV ফাইল ডাউনলোড শুরু হয়েছে!`)
    } catch (err: any) {
      console.error("Export all error:", err)
      toast.error(err?.message || "Failed to download complete CSV package")
    } finally {
      setDownloadingType(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  সম্পূর্ণ ডেটা এক্সপোর্ট (Export CSV Data)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Secure Export
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                নতুন কোডে বা সিস্টেমে সরাসরি ইম্পোর্ট উপযোগী সকল তথ্য সম্বলিত CSV ফাইল ডাউনলোড করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branch Filter & Cybersecurity Notice Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider">শাখা নির্বাচন (Branch):</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-xl font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="all">সকল শাখা (All Branches)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>CSV Formula Injection & সংবেদনশীল পাসওয়ার্ড সুরক্ষিত</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Main Hero Card: Download All Files at once */}
          <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 rounded-2xl border-2 border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1 max-w-md">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <h4 className="font-black text-slate-900 text-base">
                  সম্পূর্ণ ডাটাবেজ ব্যাকআপ (All 4 CSVs)
                </h4>
              </div>
              <p className="text-xs text-slate-600">
                এক ক্লিকে সকল শিক্ষার্থী, ব্যাচ, ব্রাঞ্চ এবং স্টাফদের সকল ডেটা ৪টি পৃথক CSV ফাইলে একসাথেই ডাউনলোড হবে।
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloadingType !== null}
              className="px-5 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {downloadingType === "all" ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4 text-indigo-200" />
              )}
              <span>সকল CSV এক সাথে ডাউনলোড (Bundle)</span>
            </button>
          </div>

          {/* Individual Export Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* 1. Students & Enrollments */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    শিক্ষার্থী ও এনরোলমেন্ট CSV
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    রোল, ব্যাচ, ব্রাঞ্চ, মোবাইল, বকেয়া ফি ও কিউআর কোডসহ শিক্ষার্থীদের যাবতীয় তথ্য।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadSingle("students")}
                disabled={downloadingType !== null}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "students" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>শিক্ষার্থী CSV ডাউনলোড</span>
              </button>
            </div>

            {/* 2. Batches */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    সকল ব্যাচ CSV (Batches)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ব্যাচের নাম, বিষয়, শ্রেণী, শাখা, মাসিক ও ভর্তি ফি, আসন সংখ্যা ও স্ট্যাটাস।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadSingle("batches")}
                disabled={downloadingType !== null}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "batches" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>ব্যাচ CSV ডাউনলোড</span>
              </button>
            </div>

            {/* 3. Branches */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    সকল ব্রাঞ্চ CSV (Branches)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    শাখার নাম, ঠিকানা, লোকেশন, ফোন, ইমেইল এবং ব্রাঞ্চ পরিচালকের তথ্য।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadSingle("branches")}
                disabled={downloadingType !== null}
                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "branches" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>ব্রাঞ্চ CSV ডাউনলোড</span>
              </button>
            </div>

            {/* 4. Staff */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    স্টাফ ও শিক্ষক CSV (Staff)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    স্টাফের নাম, ইমেইল, পদবী, শাখা, বেতন ও যোগদানের তথ্য (পাসওয়ার্ড সুরক্ষিত)।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadSingle("staff")}
                disabled={downloadingType !== null}
                className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {downloadingType === "staff" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>স্টাফ CSV ডাউনলোড</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Export Engine: UTF-8 BOM with RFC 4180 Standard
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  )
}
