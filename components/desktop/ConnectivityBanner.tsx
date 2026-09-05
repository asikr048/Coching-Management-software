"use client"
import { useEffect, useState } from "react"
import { Wifi, WifiOff, RefreshCw, HardDrive } from "lucide-react"

export default function ConnectivityBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [showReconnectedToast, setShowReconnectedToast] = useState<boolean>(false)
  const [isElectron, setIsElectron] = useState<boolean>(false)

  useEffect(() => {
    // Check if running inside our Electron desktop app
    const hasElectron = typeof window !== "undefined" && !!(window as any).electronAPI
    setIsElectron(hasElectron)

    // Initial browser online status
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnectedToast(true)
      setTimeout(() => setShowReconnectedToast(false), 5000)

      if (hasElectron) {
        ;(window as any).electronAPI.notify(
          "🟢 Cloud Server Connected",
          "Internet connection restored. Synchronizing live data with server..."
        )
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnectedToast(false)

      if (hasElectron) {
        ;(window as any).electronAPI.notify(
          "📡 Offline Mode Active",
          "Working without internet data. Local PC database is active."
        )
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Also listen to Electron IPC if available
    if (hasElectron) {
      const unsub = (window as any).electronAPI.onNetworkStatusChanged((data: { isOnline: boolean }) => {
        if (data.isOnline) {
          handleOnline()
        } else {
          handleOffline()
        }
      })
      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
        if (unsub) unsub()
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  function openOfflineVault() {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      ;(window as any).electronAPI.loadOffline()
    }
  }

  if (isOnline && !showReconnectedToast) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 w-full transition-all duration-300">
      {!isOnline ? (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Offline Mode Active: You are working without internet data.
            </span>
            <span className="hidden sm:inline font-normal text-amber-100">
              Your PC is running locally with local vault cache.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isElectron && (
              <button
                onClick={openOfflineVault}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" /> Open Local PC Vault
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-white text-amber-900 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reconnect
            </button>
          </div>
        </div>
      ) : showReconnectedToast ? (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-bold">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>🟢 Reconnected to Cloud Server! Live synchronization active.</span>
          </div>
          <button
            onClick={() => setShowReconnectedToast(false)}
            className="text-emerald-100 hover:text-white text-xs cursor-pointer font-bold px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  )
}
