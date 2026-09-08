"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App boundary caught error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold mb-2">পৃষ্ঠাটি লোড হতে সাময়িক সমস্যা হয়েছে</h2>
        <p className="text-sm text-slate-300 mb-6">
          পৃষ্ঠাটি রিলোড দিন অথবা মূল পাতায় ফিরে যান।
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> পুনরায় চেষ্টা করুন (Reload)
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl text-sm transition-all"
          >
            <Home className="w-4 h-4" /> মূল পাতা (Home)
          </Link>
        </div>
      </div>
    </div>
  )
}
