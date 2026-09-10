"use client"

import { useState } from "react"
import { KeyRound, Eye, EyeOff, Copy, Check, RefreshCw, Lock, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface StudentCredentialsCardProps {
  studentId: string
  studentCode: string
  studentName: string
  loginEmail: string
  initialPassword?: string | null
}

export default function StudentCredentialsCard({
  studentId,
  studentCode,
  studentName,
  loginEmail,
  initialPassword,
}: StudentCredentialsCardProps) {
  const [password, setPassword] = useState<string | null>(initialPassword || null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newPasswordInput, setNewPasswordInput] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard!`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const generateRandomPassword = () => {
    // Generate an easy-to-type, secure 8-character numeric or alphanumeric code
    const digits = Math.floor(100000 + Math.random() * 900000).toString()
    setNewPasswordInput(`ms${digits}`)
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPasswordInput || newPasswordInput.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/student/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          newPassword: newPasswordInput.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password")
      }

      setPassword(newPasswordInput.trim())
      setShowPassword(true)
      setIsModalOpen(false)
      setNewPasswordInput("")
      toast.success("Student password updated successfully! (পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে)")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl p-4 sm:p-6 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs flex-shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base truncate">Login Credentials (লগইন তথ্য)</h3>
              <p className="text-xs text-slate-500 font-medium">Student Portal Access Credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewPasswordInput("")
              setIsModalOpen(true)
            }}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-start xs:self-auto shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            <span>{password ? "Change Password" : "Set Password"}</span>
          </button>
        </div>

        <div className="space-y-3">
          {/* Student ID */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Student ID (লগইন আইডি)</span>
              <span className="font-mono font-black text-sm text-slate-900">{studentCode}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(studentCode, "Student ID")}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
              title="Copy Student ID"
            >
              {copiedField === "Student ID" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Login Email */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">System Email</span>
              <span className="font-mono text-xs text-slate-700 truncate block font-medium">{loginEmail}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(loginEmail, "Email")}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all shrink-0"
              title="Copy Email"
            >
              {copiedField === "Email" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Password */}
          <div className="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-xl">
            <div className="min-w-0 flex-1 mr-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-amber-700 block">Password (লগইন পাসওয়ার্ড)</span>
              {password ? (
                <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                  {showPassword ? password : "••••••••••••"}
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-700 italic">
                  Not recorded / Encrypted (Click &apos;Set Password&apos; to view)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {password && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-amber-200 transition-all"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-slate-700" /> : <Eye className="w-4 h-4 text-slate-700" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(password, "Password")}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-amber-200 transition-all"
                    title="Copy password"
                  >
                    {copiedField === "Password" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
          The student can sign in to the Student Portal with either their <b>Student ID</b> or <b>Email</b>.
        </p>
      </div>

      {/* Modal for setting/changing password */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{password ? "Change Student Password" : "Set Student Password"}</h4>
                  <p className="text-xs text-slate-500 font-medium">{studentName} ({studentCode})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">New Password (নতুন পাসওয়ার্ড)</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  required
                  placeholder="Min 6 characters (e.g. 123456 or ms928132)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <p className="font-bold">⚠️ Note for Admin:</p>
                <p>This will immediately update the student&apos;s login password in Supabase Auth and display it here on the student profile.</p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
