"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { 
  Camera, X, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, 
  Volume2, VolumeX, Sparkles, User, Hash, Clock, ArrowRight, 
  ShieldAlert, Check, Calendar, Users, SwitchCamera
} from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import { toast } from "sonner"
import Image from "next/image"

export interface ScanResultData {
  success: boolean
  message: string
  student: {
    id: string
    name: string
    student_id: string
    roll_no: number | string
    phone?: string
    guardian_phone?: string
    photo_url?: string | null
    qr_code?: string
  }
  batch: {
    id: string
    name: string
    monthly_fee?: number
  }
  attendance: {
    id: string | null
    date: string
    status: string
    entry_method: string
    checked_in_at: string
    already_recorded: boolean
  }
  fee_status: {
    has_due: boolean
    due_date_exceeded: boolean
    due_exceeded: "yes" | "no"
    is_overdue: boolean
    due_amount: number
    earliest_due_date?: string | null
    exceeded_days: number
    dues_count: number
    alert_message: string
  }
}

interface AttendanceCameraScannerModalProps {
  isOpen: boolean
  onClose: () => void
  batches: Array<{ id: string; name: string; subject?: string }>
  currentBatchId?: string
  currentDate?: string
  onScanSuccess?: (data: ScanResultData) => void
}

// Simple Web Audio API sound generator (no external audio assets required)
function playTone(frequency: number, type: OscillatorType, duration: number, count = 1, delay = 0) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    for (let i = 0; i < count; i++) {
      const startTime = ctx.currentTime + (i * (duration + delay))
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = type
      osc.frequency.setValueAtTime(frequency, startTime)

      gain.gain.setValueAtTime(0.2, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startTime)
      osc.stop(startTime + duration)
    }
  } catch {}
}

function playSuccessChime() {
  // Pleasant two-pitch positive chime (880Hz then 1320Hz)
  playTone(880, "sine", 0.12)
  setTimeout(() => playTone(1320, "sine", 0.18), 110)
}

function playWarningChime() {
  // Urgent dual low warning buzzer
  playTone(420, "sawtooth", 0.18, 2, 0.08)
}

export default function AttendanceCameraScannerModal({
  isOpen,
  onClose,
  batches,
  currentBatchId,
  currentDate,
  onScanSuccess,
}: AttendanceCameraScannerModalProps) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(currentBatchId || (batches[0]?.id || ""))
  const [date, setDate] = useState<string>(currentDate || new Date().toISOString().split("T")[0])
  const [isScanning, setIsScanning] = useState(false)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [activeCameraId, setActiveCameraId] = useState<string>("")
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Manual code input
  const [manualCode, setManualCode] = useState("")
  const [processingCode, setProcessingCode] = useState(false)

  // Latest scan result
  const [latestResult, setLatestResult] = useState<ScanResultData | null>(null)
  const [recentScans, setRecentScans] = useState<ScanResultData[]>([])

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const lastScannedTimeRef = useRef<{ [code: string]: number }>({})
  const isMountedRef = useRef(true)

  // Keep state in sync with props
  useEffect(() => {
    if (currentBatchId) setSelectedBatchId(currentBatchId)
  }, [currentBatchId])

  useEffect(() => {
    if (currentDate) setDate(currentDate)
  }, [currentDate])

  // Process a QR code string
  const handleProcessQrCode = useCallback(async (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return
    const code = rawCode.trim()

    // 2-second debounce for same code
    const now = Date.now()
    if (lastScannedTimeRef.current[code] && now - lastScannedTimeRef.current[code] < 2200) {
      return
    }
    lastScannedTimeRef.current[code] = now

    setProcessingCode(true)
    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_code: code,
          batch_id: selectedBatchId || undefined,
          date: date,
          status: "present",
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (soundEnabled) playWarningChime()
        toast.error(data.error || "QR Code Student not found or enrollment missing.")
        return
      }

      const scanResult: ScanResultData = data
      setLatestResult(scanResult)
      setRecentScans((prev) => [scanResult, ...prev.filter((p) => p.student.id !== scanResult.student.id)].slice(0, 10))

      // Sound notification: if due date exceeded -> warning buzzer, else success chime
      if (soundEnabled) {
        if (scanResult.fee_status?.due_exceeded === "yes") {
          playWarningChime()
        } else {
          playSuccessChime()
        }
      }

      // Visual feedback toast
      if (scanResult.fee_status?.due_exceeded === "yes") {
        toast.warning(
          `⚠️ ${scanResult.student.name} (Roll #${scanResult.student.roll_no}): ফি প্রদানের মেয়াদ উত্তীর্ণ! বকেয়া: ৳${scanResult.fee_status.due_amount}`,
          { duration: 5000 }
        )
      } else if (scanResult.fee_status?.has_due) {
        toast.info(
          `ℹ️ ${scanResult.student.name} (Roll #${scanResult.student.roll_no}): বকেয়া ৳${scanResult.fee_status.due_amount} রয়েছে।`
        )
      } else {
        toast.success(`✅ ${scanResult.student.name} (Roll #${scanResult.student.roll_no}) উপস্থিতি গৃহীত`)
      }

      // Trigger parent callback
      if (onScanSuccess) {
        onScanSuccess(scanResult)
      }
    } catch (err: any) {
      if (soundEnabled) playWarningChime()
      toast.error(err?.message || "Failed to submit attendance scan")
    } finally {
      if (isMountedRef.current) {
        setProcessingCode(false)
        setManualCode("")
      }
    }
  }, [date, onScanSuccess, selectedBatchId, soundEnabled])

  // Initialize and list cameras
  useEffect(() => {
    if (!isOpen) return
    isMountedRef.current = true

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const list = devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 5)}` }))
          setCameras(list)
          // Default to back camera or last device
          const backCam = list.find((c) => c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("rear") || c.label.toLowerCase().includes("environment"))
          setActiveCameraId(backCam ? backCam.id : list[0].id)
        } else {
          setScannerError("No video cameras found on this device.")
        }
      })
      .catch((err) => {
        console.warn("Could not query camera devices:", err)
        setScannerError("Camera permission not granted or unavailable.")
      })

    return () => {
      isMountedRef.current = false
    }
  }, [isOpen])

  // Start / stop camera scanner
  useEffect(() => {
    if (!isOpen) {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {})
        }
        html5QrCodeRef.current = null
      }
      setIsScanning(false)
      return
    }

    let isCancelled = false
    const qrContainerId = "reader-attendance-camera"

    const startScanner = async () => {
      try {
        setScannerError(null)

        // Make sure container exists in DOM
        const container = document.getElementById(qrContainerId)
        if (!container) return

        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(qrContainerId)
        }

        const scanner = html5QrCodeRef.current

        if (scanner.isScanning) {
          await scanner.stop()
        }

        const config = {
          fps: 12,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        }

        const cameraConfig = activeCameraId
          ? { deviceId: { exact: activeCameraId } }
          : { facingMode: "environment" }

        await scanner.start(
          cameraConfig,
          config,
          (decodedText) => {
            if (!isCancelled) {
              handleProcessQrCode(decodedText)
            }
          },
          () => {
            // Frame scan failure is expected when no QR is in frame
          }
        )

        if (!isCancelled) {
          setIsScanning(true)
        }
      } catch (err: any) {
        console.warn("Html5Qrcode start error:", err)
        if (!isCancelled) {
          setIsScanning(false)
          setScannerError(err?.message || "Could not start camera feed. Please check camera permissions.")
        }
      }
    }

    // Short timeout to ensure modal DOM is mounted
    const timer = setTimeout(() => {
      startScanner()
    }, 150)

    return () => {
      isCancelled = true
      clearTimeout(timer)
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {})
        }
        html5QrCodeRef.current = null
      }
      setIsScanning(false)
    }
  }, [isOpen, activeCameraId, handleProcessQrCode])

  // Handle manual input submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    handleProcessQrCode(manualCode)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Digital ID QR Camera Scanner
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                  Live Attendance
                </span>
              </div>
              <p className="text-xs text-slate-300">
                স্ক্যানার দিয়ে স্টুডেন্ট আইডি কার্ড স্ক্যান করে স্বয়ংক্রিয় উপস্থিতি ও ফি চেক করুন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute Sound" : "Enable Sound"}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                soundEnabled
                  ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                  : "bg-white/10 text-slate-400 hover:bg-white/20 border border-white/10"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Batch Selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">Auto-Detect from Student Enrollment</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.subject ? `(${b.subject})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl font-semibold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Camera Switcher */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Video Input Device</span>
              {cameras.length > 1 && (
                <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                  <SwitchCamera className="w-3 h-3" /> {cameras.length} cameras
                </span>
              )}
            </label>
            <select
              value={activeCameraId}
              onChange={(e) => setActiveCameraId(e.target.value)}
              disabled={cameras.length === 0}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl font-semibold focus:outline-none focus:border-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {cameras.length === 0 ? (
                <option value="">Default Camera</option>
              ) : (
                cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Camera Viewfinder & Manual Barcode Input */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Viewfinder Container */}
            <div className="relative bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[290px] sm:min-h-[330px]">
              <div
                id="reader-attendance-camera"
                className="w-full h-full max-h-[380px] overflow-hidden rounded-xl"
              />

              {/* Scanning status banner */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-semibold">
                  <span className={`w-2 h-2 rounded-full ${isScanning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  <span>{isScanning ? "Camera Live & Scanning..." : "Starting Camera..."}</span>
                </div>

                {processingCode && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg animate-bounce">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>

              {/* Error overlay */}
              {scannerError && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
                  <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
                  <p className="font-bold text-sm text-rose-200">{scannerError}</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Please make sure your browser has permission to access the camera or use the manual text/barcode scanner below.
                  </p>
                </div>
              )}
            </div>

            {/* Manual QR / USB Barcode Scanner Wedge Form */}
            <form onSubmit={handleManualSubmit} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                USB Barcode Scanner / Manual Code Entry
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Paste QR URL or code (e.g. MSQR-...)"
                  className="flex-1 px-3.5 py-2 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={processingCode || !manualCode.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {processingCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Submit</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Active Scan Result & Fee Due Status */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {latestResult ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Result Top Badge */}
                <div
                  className={`px-4 py-3 flex items-center justify-between ${
                    latestResult.fee_status?.due_exceeded === "yes"
                      ? "bg-rose-50 border-b border-rose-200 text-rose-900"
                      : latestResult.fee_status?.has_due
                      ? "bg-amber-50 border-b border-amber-200 text-amber-900"
                      : "bg-emerald-50 border-b border-emerald-200 text-emerald-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {latestResult.fee_status?.due_exceeded === "yes" ? (
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    ) : latestResult.fee_status?.has_due ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider">
                        {latestResult.fee_status?.due_exceeded === "yes"
                          ? "মেয়াদ উত্তীর্ণ ফি বকেয়া!"
                          : latestResult.fee_status?.has_due
                          ? "বকেয়া ফি নোটিশ"
                          : "উপস্থিতি ও ফি নিয়মিত"}
                      </h4>
                      <p className="text-[11px] font-medium opacity-90">
                        {latestResult.attendance.status === "present" ? "উপস্থিত চিহ্নিত করা হয়েছে" : latestResult.attendance.status}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                      latestResult.fee_status?.due_exceeded === "yes"
                        ? "bg-rose-600 text-white"
                        : latestResult.fee_status?.has_due
                        ? "bg-amber-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {latestResult.fee_status?.due_exceeded === "yes" ? "DUE EXCEEDED" : "PRESENT"}
                  </span>
                </div>

                {/* Student Info Card */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                      {latestResult.student.photo_url ? (
                        <Image
                          src={latestResult.student.photo_url}
                          alt={latestResult.student.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <User className="w-7 h-7 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-slate-900 text-base leading-tight truncate">
                        {latestResult.student.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                          <Hash className="w-3 h-3" /> Roll #{latestResult.student.roll_no}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          ID: {latestResult.student.student_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Batch Details */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ব্যাচ:</span>
                      <span className="font-bold text-slate-800">{latestResult.batch.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">তারিখ:</span>
                      <span className="font-medium text-slate-700">{latestResult.attendance.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">স্ক্যান সময়:</span>
                      <span className="font-medium text-slate-700">
                        {new Date(latestResult.attendance.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* DUE DATE EXCEEDED / FEE ALERT BANNER */}
                  {latestResult.fee_status?.due_exceeded === "yes" ? (
                    <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-rose-900 animate-pulse">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-rose-800">
                            ফি প্রদানের শেষ তারিখ পার হয়ে গেছে!
                          </p>
                          <p className="text-xs text-rose-700 mt-0.5">
                            বকেয়া পরিমাণ: <strong className="text-rose-900 text-sm">৳{latestResult.fee_status.due_amount}</strong>
                            {latestResult.fee_status.exceeded_days > 0 && (
                              <span> ({latestResult.fee_status.exceeded_days} দিন পূর্বে শেষ হয়েছে)</span>
                            )}
                          </p>
                          <p className="text-[11px] text-rose-600 mt-1">
                            দয়া করে একাউন্টস শাখায় ফি পরিশোধ নিশ্চিত করুন।
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : latestResult.fee_status?.has_due ? (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">চলতি বকেয়া নোটিশ</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            মোট বকেয়া: <strong>৳{latestResult.fee_status.due_amount}</strong>
                            {latestResult.fee_status.earliest_due_date && (
                              <span> (পরিশোধের শেষ তারিখ: {latestResult.fee_status.earliest_due_date})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <p className="text-xs font-bold text-emerald-800">
                        কোন ফি বকেয়া নেই — সকল ফি পরিশোধিত!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center flex flex-col items-center justify-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">আইডি কার্ড স্ক্যান করুন</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  শিক্ষার্থীর আইডি কার্ডের কিউআর কোডটি ক্যামেরার সামনে ধরুন। স্বয়ংক্রিয়ভাবে উপস্থিতি রেকর্ড হয়ে ফি স্ট্যাটাস দেখাবে।
                </p>
              </div>
            )}

            {/* Recent Scans in this session */}
            {recentScans.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recent Scans ({recentScans.length})
                  </span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {recentScans.map((scan, i) => (
                    <div
                      key={scan.student.id + "-" + i}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                          #{scan.student.roll_no}
                        </span>
                        <span className="font-bold text-slate-900 truncate">{scan.student.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {scan.fee_status?.due_exceeded === "yes" ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px]">
                            Due Exceeded
                          </span>
                        ) : scan.fee_status?.has_due ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-medium text-[10px]">
                            Due ৳{scan.fee_status.due_amount}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            Clear
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            HTTPS API: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-amber-800">/api/attendance/scan</code>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  )
}
