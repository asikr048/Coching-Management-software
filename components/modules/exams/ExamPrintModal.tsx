"use client"

import React, { useState, useEffect } from "react"
import {
  X,
  Printer,
  FileText,
  LayoutTemplate,
  ArrowUpDown,
  Trophy,
  CheckSquare,
  Square,
  Sparkles,
  Download,
} from "lucide-react"
import PrintableExamSheet, { PrintableExamSheetProps } from "./PrintableExamSheet"
import { cn } from "@/lib/utils"

export interface ExamPrintModalProps {
  isOpen: boolean
  onClose: () => void
  exam: PrintableExamSheetProps["exam"]
  isWeeklyExam: boolean
  weeklyDays?: PrintableExamSheetProps["weeklyDays"]
  activeDayConfig?: PrintableExamSheetProps["activeDayConfig"]
  totalWeeklyMaxMarks?: number
  students: PrintableExamSheetProps["students"]
  savedResults?: PrintableExamSheetProps["savedResults"]
  dayMarksMap?: PrintableExamSheetProps["dayMarksMap"]
  defaultMode?: "one_time" | "weekly_aggregate" | "weekly_day"
}

export default function ExamPrintModal({
  isOpen,
  onClose,
  exam,
  isWeeklyExam,
  weeklyDays = [],
  activeDayConfig = null,
  totalWeeklyMaxMarks = 100,
  students = [],
  savedResults = {},
  dayMarksMap = {},
  defaultMode = "one_time",
}: ExamPrintModalProps) {
  const [selectedMode, setSelectedMode] = useState<"one_time" | "weekly_aggregate" | "weekly_day">(
    isWeeklyExam ? defaultMode : "one_time"
  )
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    activeDayConfig?.key || weeklyDays[0]?.key || "saturday"
  )
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    isWeeklyExam && selectedMode === "weekly_aggregate" ? "landscape" : "portrait"
  )
  const [sortBy, setSortBy] = useState<"rank" | "roll">("rank")
  const [showPodium, setShowPodium] = useState<boolean>(true)
  const [showSubjectToppers, setShowSubjectToppers] = useState<boolean>(true)
  const [showSignatures, setShowSignatures] = useState<boolean>(true)

  // Sync mode and orientation when defaultMode changes
  useEffect(() => {
    if (isWeeklyExam) {
      setSelectedMode(defaultMode)
      setOrientation(defaultMode === "weekly_aggregate" ? "landscape" : "portrait")
    } else {
      setSelectedMode("one_time")
      setOrientation("portrait")
    }
  }, [defaultMode, isWeeklyExam])

  // When mode changes, adapt orientation default
  function handleModeChange(mode: "one_time" | "weekly_aggregate" | "weekly_day") {
    setSelectedMode(mode)
    if (mode === "weekly_aggregate") {
      setOrientation("landscape")
    } else {
      setOrientation("portrait")
    }
  }

  const currentDayConfig = weeklyDays.find((d) => d.key === selectedDayKey) || activeDayConfig || weeklyDays[0] || null

  // Trigger browser print
  function handlePrint() {
    window.print()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-transparent print:static print:z-auto">
      {/* Dynamic Print CSS for orientation and clean isolation */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${orientation === "landscape" ? "A4 landscape" : "A4 portrait"};
            margin: 6mm 8mm 6mm 8mm;
          }
          /* Hide non-print overlays, headers, and UI chrome */
          body * {
            visibility: hidden;
          }
          #printable-exam-sheet,
          #printable-exam-sheet * {
            visibility: visible;
          }
          #printable-exam-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .print-modal-controls,
          .print\\:hidden,
          aside,
          header,
          nav,
          button {
            display: none !important;
          }
        }
      `}</style>

      <div
        className={cn(
          "bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-300 shadow-2xl w-full max-h-[96vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:bg-white",
          orientation === "landscape" ? "max-w-[1180px]" : "max-w-4xl"
        )}
      >
        {/* Top Control Bar (Screen only) */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex flex-col gap-3 shrink-0 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                <Printer className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>পরীক্ষার রেজাল্ট শিট প্রিন্ট ও PDF প্রিভিউ</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    A4 Ready
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {exam.title} • {exam.batch?.name || "ব্যাচ"} ({students.length} জন শিক্ষার্থী)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>প্রিন্ট / PDF সংরক্ষণ করুন</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Configuration Options */}
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
            {/* Mode Selector for Weekly Exams */}
            {isWeeklyExam && (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleModeChange("weekly_aggregate")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    selectedMode === "weekly_aggregate"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  🏆 সাপ্তাহিক সামগ্রিক শিট
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("weekly_day")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    selectedMode === "weekly_day"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  📅 নির্দিষ্ট দিনের শিট
                </button>
              </div>
            )}

            {/* If Weekly Day is selected, pick day */}
            {isWeeklyExam && selectedMode === "weekly_day" && (
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500">দিন:</label>
                <select
                  value={selectedDayKey}
                  onChange={(e) => setSelectedDayKey(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {weeklyDays.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.day_bn} ({d.subject || d.exam_name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Orientation */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500">পেজ লেআউট:</label>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setOrientation("portrait")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                    orientation === "portrait"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  পোর্ট্রেট (Portrait)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("landscape")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                    orientation === "landscape"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ল্যান্ডস্কেপ (Landscape)
                </button>
              </div>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500">ক্রমানুসার:</label>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSortBy("rank")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                    sortBy === "rank" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  মেধাক্রম (Rank)
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("roll")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                    sortBy === "roll" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  রোল নম্বর (Roll)
                </button>
              </div>
            </div>

            {/* Toggle Podium */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={showPodium}
                onChange={(e) => setShowPodium(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>শীর্ষ ৩ মেধা পোডিয়াম</span>
            </label>

            {/* Toggle Subject Toppers (for weekly exams) */}
            {isWeeklyExam && selectedMode === "weekly_aggregate" && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700">
                <input
                  type="checkbox"
                  checked={showSubjectToppers}
                  onChange={(e) => setShowSubjectToppers(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span>বিষয়ভিত্তিক শীর্ষ মেধা</span>
              </label>
            )}

            {/* Toggle Signatures */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>স্বাক্ষর ব্লক</span>
            </label>
          </div>
        </div>

        {/* Document Preview Viewport (Scrollable container on screen, printed directly) */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 bg-slate-200/70 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            className={cn(
              "bg-white shadow-xl rounded-xl transition-all border border-slate-300/80 print:shadow-none print:border-none print:rounded-none",
              orientation === "landscape" ? "w-full max-w-[1080px]" : "w-full max-w-[820px]"
            )}
          >
            <PrintableExamSheet
              exam={exam}
              mode={selectedMode}
              weeklyDays={weeklyDays}
              activeDayConfig={currentDayConfig}
              totalWeeklyMaxMarks={totalWeeklyMaxMarks}
              students={students}
              savedResults={savedResults}
              dayMarksMap={dayMarksMap}
              sortBy={sortBy}
              showPodium={showPodium}
              showSubjectToppers={showSubjectToppers}
              showSignatures={showSignatures}
            />
          </div>
        </div>

        {/* Modal Bottom Footer (Screen only) */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>টিপস: ব্রাউজারের প্রিন্ট ডায়ালগ থেকে &ldquo;Save as PDF&rdquo; সিলেক্ট করে ডাউনলোড করতে পারবেন।</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
            >
              বন্ধ করুন
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" /> প্রিন্ট করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
