"use client"

import { useState } from "react"
import { Printer, Download, CreditCard, Sparkles } from "lucide-react"
import { StudentIdCardData } from "@/lib/id-card-generator"
import StudentIdCardModal from "./StudentIdCardModal"

interface Props {
  cardData?: StudentIdCardData | null
  student?: any
  batchName?: string
  rollNo?: string | number | null
  variant?: "button" | "icon" | "badge" | "outline" | "banner" | "primary"
  buttonVariant?: "button" | "icon" | "badge" | "outline" | "banner" | "primary"
  className?: string
  label?: string
  buttonText?: string
}

export default function StudentIdCardTrigger({
  cardData,
  student,
  batchName,
  rollNo,
  variant,
  buttonVariant,
  className = "",
  label,
  buttonText,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  // Resolve card data
  const finalCardData: StudentIdCardData = cardData || {
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
  }

  const activeVariant = buttonVariant || variant || "button"
  const activeText = buttonText || label || "🪪 ID Card"

  return (
    <>
      {activeVariant === "icon" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-colors cursor-pointer ${className}`}
          title="View & Print ID Card"
        >
          <CreditCard className="w-4 h-4" />
        </button>
      ) : activeVariant === "badge" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${className}`}
        >
          <span>{activeText}</span>
        </button>
      ) : activeVariant === "banner" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${className}`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{activeText}</span>
        </button>
      ) : activeVariant === "outline" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-indigo-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${className}`}
        >
          <span>{activeText}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 transition-all cursor-pointer ${className}`}
        >
          <span>{activeText}</span>
        </button>
      )}

      <StudentIdCardModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        cardData={finalCardData}
      />
    </>
  )
}
