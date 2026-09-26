"use client"

import React, { useState, useRef, useEffect } from "react"
import { Languages, Check, Globe, ChevronDown, Sparkles } from "lucide-react"
import { useLanguage, AppLanguage } from "@/components/providers/LanguageContext"
import { cn } from "@/lib/utils"

interface Props {
  variant?: "header" | "floating" | "compact"
  className?: string
  align?: "left" | "right"
}

interface LanguageOption {
  id: AppLanguage
  label: string
  sublabel: string
  flag: string
  shortCode: string
}

const languageOptions: LanguageOption[] = [
  {
    id: "bn",
    label: "বাংলা",
    sublabel: "Pure Bengali",
    flag: "🇧🇩",
    shortCode: "বাং",
  },
  {
    id: "en",
    label: "English",
    sublabel: "English Interface",
    flag: "🇬🇧",
    shortCode: "EN",
  },
  {
    id: "mix",
    label: "বাংলা + English",
    sublabel: "Like Now (মিশ্র ভাষা)",
    flag: "🌐",
    shortCode: "বাং/EN",
  },
]

export default function LanguageSelector({
  variant = "header",
  className,
  align = "right",
}: Props) {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Current active option
  const activeOption = languageOptions.find((opt) => opt.id === language) || languageOptions[2]

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const selectLanguage = (id: AppLanguage) => {
    setLanguage(id)
    setOpen(false)
  }

  // Floating variant: Discreet mini logo widget pinned at bottom right corner
  if (variant === "floating") {
    return (
      <div
        ref={containerRef}
        className={cn("fixed bottom-4 right-4 z-50 select-none print:hidden", className)}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="group flex items-center gap-1.5 px-3 py-2 bg-white/95 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-full shadow-lg hover:shadow-xl border border-slate-200/90 backdrop-blur-md transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          title="Change Language / ভাষা পরিবর্তন করুন"
          aria-label="Language selection mini logo"
          aria-expanded={open}
        >
          <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <Languages className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-800 tracking-tight">
            {activeOption.shortCode}
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div
            className="absolute bottom-full right-0 mb-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-slate-800"
          >
            <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" />
                Language / ভাষা
              </span>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                3 options
              </span>
            </div>

            <div className="p-1 space-y-0.5">
              {languageOptions.map((opt) => {
                const isSelected = opt.id === language
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectLanguage(opt.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-left rounded-xl transition-all cursor-pointer text-xs",
                      isSelected
                        ? "bg-indigo-50 text-indigo-900 font-bold border border-indigo-200/60 shadow-xs"
                        : "hover:bg-slate-50 text-slate-700 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{opt.flag}</span>
                      <div>
                        <p className={cn("text-xs leading-snug", isSelected ? "font-bold text-indigo-900" : "text-slate-800")}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-slate-400 font-normal leading-tight">
                          {opt.sublabel}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Header / Compact Variant: For top toolbars, navbars, and headers
  return (
    <div ref={containerRef} className={cn("relative inline-block text-left select-none", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs",
          variant === "compact"
            ? "p-1.5 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            : "px-2.5 sm:px-3 py-1.5 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 text-xs sm:text-sm font-bold"
        )}
        title="Select Language / ভাষা নির্বাচন করুন"
        aria-label="Language selection mini logo"
        aria-expanded={open}
      >
        <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
          <Languages className="w-3.5 h-3.5" />
        </div>
        {variant !== "compact" && (
          <span className="font-bold text-xs text-slate-800 truncate max-w-[65px] xs:max-w-[90px]">
            {activeOption.shortCode}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3 h-3 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-1.5 w-56 max-w-[90vw] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden py-1 text-slate-800",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              Language (ভাষা)
            </span>
          </div>

          <div className="p-1 space-y-0.5">
            {languageOptions.map((opt) => {
              const isSelected = opt.id === language
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectLanguage(opt.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-left rounded-xl transition-all cursor-pointer text-xs",
                    isSelected
                      ? "bg-indigo-50 text-indigo-900 font-bold border border-indigo-200/60 shadow-xs"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{opt.flag}</span>
                    <div>
                      <p className={cn("text-xs leading-snug", isSelected ? "font-bold text-indigo-900" : "text-slate-800")}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-slate-400 font-normal leading-tight">
                        {opt.sublabel}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
