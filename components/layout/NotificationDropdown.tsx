"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  CreditCard,
  UserX,
  FileText,
  Megaphone,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  PlusCircle,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface NotificationItem {
  id: string
  title: string
  message: string
  category: "admin" | "student"
  type: "notice" | "payment" | "deletion" | "exam"
  created_at: string
  href: string
  priority?: "urgent" | "high" | "normal" | "low"
  badge?: string
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 2) return "এইমাত্র"
    if (diffMins < 60) return `${diffMins} মি. আগে`
    if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`
    if (diffDays === 1) return "গতকাল"
    if (diffDays < 7) return `${diffDays} দিন আগে`
    return d.toLocaleDateString("bn-BD", { month: "short", day: "numeric" })
  } catch {
    return "সম্প্রতি"
  }
}

export default function NotificationDropdown() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "admin" | "student">("all")
  const [loading, setLoading] = useState(false)
  const [allItems, setAllItems] = useState<NotificationItem[]>([])
  const [adminItems, setAdminItems] = useState<NotificationItem[]>([])
  const [studentItems, setStudentItems] = useState<NotificationItem[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch notifications feed
  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setAllItems(data.allNotifications || [])
        setAdminItems(data.adminNotifications || [])
        setStudentItems(data.studentNotifications || [])
      }
    } catch (err) {
      console.warn("Failed to fetch notification feed:", err)
    } finally {
      setLoading(false)
    }
  }

  // Load once on mount
  useEffect(() => {
    fetchNotifications()
  }, [])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const displayedList =
    activeTab === "admin"
      ? adminItems
      : activeTab === "student"
      ? studentItems
      : allItems

  const unreadCount = allItems.filter((i) => !readIds.has(i.id)).length

  function handleItemClick(item: NotificationItem) {
    setReadIds((prev) => new Set(prev).add(item.id))
    setIsOpen(false)
    router.push(item.href)
  }

  function handleMarkAllAsRead() {
    const ids = new Set(allItems.map((i) => i.id))
    setReadIds(ids)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) fetchNotifications()
        }}
        className={cn(
          "relative p-1.5 sm:p-2 rounded-xl transition-all border",
          isOpen
            ? "bg-amber-500/10 text-amber-700 border-amber-300"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent"
        )}
        aria-label="Notifications"
        title="বিজ্ঞপ্তি ও নোটিফিকেশন"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-slate-300 rounded-full"></span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[90vw] sm:w-[420px] max-w-[440px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-slate-800 flex flex-col">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
                <Bell className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  বিজ্ঞপ্তি ও নোটিফিকেশন
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                      {unreadCount} নতুন
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-300">অ্যাডমিন ও শিক্ষার্থী সংক্রান্ত সাম্প্রতিক তথ্য</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                title="রিফ্রেশ করুন"
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  title="সবগুলো পঠিত চিহ্নিত করুন"
                  className="text-[11px] text-amber-300 hover:text-amber-200 underline font-medium px-1.5 py-1"
                >
                  পঠিত চিহ্নিত করুন
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center p-1.5 bg-slate-100/80 border-b border-slate-200 text-xs font-bold gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5",
                activeTab === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <span>সব বিজ্ঞপ্তি</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {allItems.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5",
                activeTab === "admin"
                  ? "bg-white text-purple-700 shadow-xs"
                  : "text-slate-600 hover:text-purple-700 hover:bg-white/50"
              )}
            >
              <span>🛡️ অ্যাডমিন</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
                {adminItems.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("student")}
              className={cn(
                "flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5",
                activeTab === "student"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-blue-700 hover:bg-white/50"
              )}
            >
              <span>🎓 শিক্ষার্থী</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                {studentItems.length}
              </span>
            </button>
          </div>

          {/* Notifications List Area */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 bg-white">
            {loading && displayedList.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                <span className="text-xs">নোটিফিকেশন লোড হচ্ছে...</span>
              </div>
            ) : displayedList.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-slate-700">কোনো নতুন বিজ্ঞপ্তি নেই</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeTab === "admin"
                    ? "অ্যাডমিন সংক্রান্ত কোনো নতুন নোটিফিকেশন নেই।"
                    : activeTab === "student"
                    ? "শিক্ষার্থী সংক্রান্ত কোনো নতুন নোটিফিকেশন নেই।"
                    : "আপনার কাছে কোনো অপঠিত বিজ্ঞপ্তি নেই।"}
                </p>
              </div>
            ) : (
              displayedList.map((item) => {
                const isRead = readIds.has(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 group relative",
                      !isRead && "bg-indigo-50/30"
                    )}
                  >
                    {/* Unread indicator bar */}
                    {!isRead && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-amber-500 rounded-r"></span>
                    )}

                    {/* Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                        item.type === "payment"
                          ? "bg-amber-100 text-amber-700"
                          : item.type === "deletion"
                          ? "bg-rose-100 text-rose-700"
                          : item.category === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {item.type === "payment" ? (
                        <CreditCard className="w-4 h-4" />
                      ) : item.type === "deletion" ? (
                        <UserX className="w-4 h-4" />
                      ) : item.type === "exam" ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <Megaphone className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.2 rounded",
                            item.category === "admin"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          )}
                        >
                          {item.badge || (item.category === "admin" ? "অ্যাডমিন" : "শিক্ষার্থী")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <p className={cn("text-xs mt-1 leading-snug line-clamp-1", !isRead ? "font-black text-slate-900" : "font-semibold text-slate-700")}>
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0 mt-2" />
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                setIsOpen(false)
                router.push("/dashboard/owner/notices")
              }}
              className="text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-200/60"
            >
              <span>সকল নোটিশ পরিচালনা</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setIsOpen(false)
                router.push("/dashboard/owner/notices?action=new")
              }}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>নোটিশ পাঠান</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
