const { app, BrowserWindow, ipcMain, Notification, Menu, shell, net } = require("electron")
const path = require("path")
const fs = require("fs")

// Default Cloud Server URL
const DEFAULT_SERVER_URL = process.env.APP_SERVER_URL || "https://medhashiree.vercel.app"

let mainWindow = null
let isOnlineState = true
let lastOnlineCheck = Date.now()
let heartbeatInterval = null

// Paths for persistent local storage on the PC
function getStorageDir() {
  const userData = app.getPath("userData")
  const storageDir = path.join(userData, "MedhaShireeVault")
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }
  return storageDir
}

function getVaultPath() {
  return path.join(getStorageDir(), "local-vault.json")
}

function getQueuePath() {
  return path.join(getStorageDir(), "offline-queue.json")
}

// Read local vault safely
function readLocalVault() {
  try {
    const p = getVaultPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8")
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error("Error reading local vault:", err)
  }
  return {
    lastSyncedAt: null,
    students: [],
    batches: [],
    dues: [],
    payments: [],
    attendance: [],
    exams: [],
    staff: [],
    courses: [],
  }
}

// Write local vault atomically
function writeLocalVault(data) {
  try {
    const p = getVaultPath()
    const tmp = p + ".tmp"
    const payload = {
      ...data,
      lastSyncedAt: new Date().toISOString(),
    }
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8")
    fs.renameSync(tmp, p)
    return true
  } catch (err) {
    console.error("Error saving local vault:", err)
    return false
  }
}

// Offline action queue (attendance recorded without internet)
function readQueue() {
  try {
    const p = getQueuePath()
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8"))
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (err) {
    console.error("Error reading offline queue:", err)
  }
  return []
}

function writeQueue(entries) {
  try {
    const p = getQueuePath()
    const tmp = p + ".tmp"
    fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), "utf8")
    fs.renameSync(tmp, p)
    return true
  } catch (err) {
    console.error("Error saving offline queue:", err)
    return false
  }
}

function appendQueue(entries) {
  const incoming = Array.isArray(entries) ? entries : []
  const queue = readQueue()
  const indexById = new Map()

  queue.forEach((entry, index) => {
    if (entry && entry.client_id) indexById.set(entry.client_id, index)
  })

  for (const entry of incoming) {
    if (!entry || !entry.client_id) continue
    if (indexById.has(entry.client_id)) {
      // Same local action recorded again (e.g. corrected status) — replace it.
      queue[indexById.get(entry.client_id)] = entry
    } else {
      indexById.set(entry.client_id, queue.length)
      queue.push(entry)
    }
  }

  const ok = writeQueue(queue)
  return { success: ok, count: queue.length }
}

// Push queued offline actions to the server. Only entries the server
// acknowledges are removed from the queue so nothing is lost on failure.
async function syncQueue() {
  const entries = readQueue()
  if (entries.length === 0) {
    return { success: true, processed: 0, failed: 0, remaining: 0, message: "Nothing to sync" }
  }

  if (!isOnlineState) {
    return { success: false, processed: 0, failed: entries.length, remaining: entries.length, message: "Offline" }
  }

  const token = process.env.VAULT_SYNC_TOKEN || ""
  if (!token) {
    return {
      success: false,
      processed: 0,
      failed: entries.length,
      remaining: entries.length,
      message: "VAULT_SYNC_TOKEN is not configured on this PC",
    }
  }

  try {
    const response = await fetch(`${DEFAULT_SERVER_URL}/api/vault/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ entries }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        success: false,
        processed: 0,
        failed: entries.length,
        remaining: entries.length,
        message: data.error || `Server responded with HTTP ${response.status}`,
      }
    }

    const acknowledgedIds = new Set(
      (data.results || []).filter((r) => r && r.ok).map((r) => r.client_id)
    )
    const remaining = entries.filter((e) => !acknowledgedIds.has(e.client_id))
    writeQueue(remaining)

    const summary = {
      success: true,
      processed: acknowledgedIds.size,
      failed: remaining.length,
      remaining: remaining.length,
      message: data.message || `Synced ${acknowledgedIds.size} of ${entries.length} queued action(s)`,
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("queue:synced", summary)
    }
    if (acknowledgedIds.size > 0) {
      showDesktopNotification("☁️ Offline Data Synced", summary.message)
    }

    return summary
  } catch (err) {
    console.error("Queue sync failed:", err)
    return {
      success: false,
      processed: 0,
      failed: entries.length,
      remaining: entries.length,
      message: err?.message || "Could not reach the server",
    }
  }
}

// Show native Windows notification
function showDesktopNotification(title, body, isSilent = false) {
  if (Notification.isSupported()) {
    try {
      const iconPath = fs.existsSync(path.join(__dirname, "icon.ico"))
        ? path.join(__dirname, "icon.ico")
        : path.join(__dirname, "..", "app", "favicon.ico")
      const notif = new Notification({
        title,
        body,
        silent: isSilent,
        icon: iconPath,
      })
      notif.show()
    } catch (e) {
      console.warn("Notification error:", e)
    }
  }
}

// Heartbeat ping to server
async function checkConnectivity() {
  return new Promise((resolve) => {
    try {
      const req = net.request({
        method: "HEAD",
        url: DEFAULT_SERVER_URL,
      })
      req.on("response", () => {
        resolve(true)
      })
      req.on("error", () => {
        resolve(false)
      })
      // 4-second timeout
      setTimeout(() => {
        try { req.abort() } catch {}
        resolve(false)
      }, 4000)
      req.end()
    } catch {
      resolve(false)
    }
  })
}

// Handle network state transitions
async function updateConnectivityState(newOnlineStatus) {
  if (isOnlineState !== newOnlineStatus) {
    isOnlineState = newOnlineStatus

    if (!isOnlineState) {
      // Switched to OFFLINE
      showDesktopNotification(
        "📡 Offline Mode Active",
        "Disconnected from server. Working smoothly from your local PC database without internet data."
      )
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("network:status-changed", {
          isOnline: false,
          message: "Offline Mode Active (Running locally)",
          lastSyncedAt: readLocalVault().lastSyncedAt,
        })
      }
    } else {
      // Switched to ONLINE
      showDesktopNotification(
        "🟢 Cloud Server Connected",
        "Internet connection restored! Synchronizing with server..."
      )
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("network:status-changed", {
          isOnline: true,
          message: "Connected to Server (Live Sync)",
          lastSyncedAt: readLocalVault().lastSyncedAt,
        })
      }
      // Flush any actions recorded while offline.
      syncQueue().catch((err) => console.error("Reconnect queue flush error:", err))
    }
  }
}

// Create Main Application Window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: "MedhaShiree - Coaching Management System (PC Edition)",
    icon: fs.existsSync(path.join(__dirname, "icon.ico"))
      ? path.join(__dirname, "icon.ico")
      : path.join(__dirname, "..", "app", "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  })

  // Start with live server, or fallback to offline UI if failed
  loadApplication()

  // Handle load failures (e.g. initial launch with no internet)
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.warn("Failed to load live server, falling back to local offline UI:", errorCode, errorDescription)
    updateConnectivityState(false)
    loadOfflineUI()
  })

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url)
    }
    return { action: "deny" }
  })

  // Build Desktop Menu
  createAppMenu()

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// Load live server
function loadApplication() {
  if (!mainWindow) return
  mainWindow.loadURL(DEFAULT_SERVER_URL).catch(() => {
    loadOfflineUI()
  })
}

// Load embedded offline UI
function loadOfflineUI() {
  if (!mainWindow) return
  const offlineHtmlPath = path.join(__dirname, "offline", "index.html")
  mainWindow.loadFile(offlineHtmlPath)
}

// App Menu definition
function createAppMenu() {
  const template = [
    {
      label: "MedhaShiree",
      submenu: [
        {
          label: "Sync with Cloud Server",
          accelerator: "CmdOrCtrl+S",
          click: async () => {
            const online = await checkConnectivity()
            updateConnectivityState(online)
            if (online) {
              showDesktopNotification("🔄 Syncing", "Connecting to server to sync latest updates...")
              loadApplication()
            } else {
              showDesktopNotification("⚠️ Still Offline", "Cannot reach server. Continuing in offline mode.")
            }
          },
        },
        {
          label: "Work Offline (Local PC Mode)",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            updateConnectivityState(false)
            loadOfflineUI()
          },
        },
        { type: "separator" },
        {
          label: "Open Local Vault Directory",
          click: () => {
            shell.openPath(getStorageDir())
          },
        },
        { type: "separator" },
        { label: "Exit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow && mainWindow.reload() },
        { label: "Toggle Full Screen", accelerator: "F11", click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About MedhaShiree PC",
          click: () => {
            showDesktopNotification(
              "MedhaShiree Coaching System",
              `Version: 1.0.0 (PC Desktop Edition)\nServer: ${DEFAULT_SERVER_URL}\nLocal Storage: Enabled`
            )
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// IPC Handlers
function setupIpcHandlers() {
  // Vault data getters and setters
  ipcMain.handle("vault:get", () => {
    return readLocalVault()
  })

  ipcMain.handle("vault:save", (event, data) => {
    const ok = writeLocalVault(data)
    return { success: ok }
  })

  ipcMain.handle("vault:get-info", () => {
    const v = readLocalVault()
    return {
      storageDir: getStorageDir(),
      vaultPath: getVaultPath(),
      lastSyncedAt: v.lastSyncedAt,
      isOnline: isOnlineState,
      counts: {
        students: v.students?.length || 0,
        batches: v.batches?.length || 0,
        dues: v.dues?.length || 0,
        payments: v.payments?.length || 0,
      },
      queueCount: readQueue().length,
    }
  })

  // Offline action queue
  ipcMain.handle("queue:get", () => readQueue())

  ipcMain.handle("queue:append", (event, entries) => appendQueue(entries))

  ipcMain.handle("queue:clear", () => {
    const ok = writeQueue([])
    return { success: ok, count: 0 }
  })

  ipcMain.handle("queue:sync", () => syncQueue())

  // Trigger manual connectivity check
  ipcMain.handle("network:check", async () => {
    const online = await checkConnectivity()
    await updateConnectivityState(online)
    return { isOnline: online }
  })

  // Switch to live server
  ipcMain.handle("app:load-server", () => {
    loadApplication()
    return true
  })

  // Switch to offline UI
  ipcMain.handle("app:load-offline", () => {
    loadOfflineUI()
    return true
  })

  // Trigger desktop notification from frontend
  ipcMain.handle("app:notify", (event, { title, body, silent }) => {
    showDesktopNotification(title, body, silent)
    return true
  })
}

// App lifecycle
app.whenReady().then(async () => {
  setupIpcHandlers()
  createMainWindow()

  // Initial connectivity check
  const online = await checkConnectivity()
  updateConnectivityState(online)

  // Flush actions queued during the previous (offline) session.
  if (online) {
    syncQueue().catch((err) => console.error("Startup queue flush error:", err))
  }

  // Periodic heartbeat monitoring every 8 seconds
  heartbeatInterval = setInterval(async () => {
    const isUp = await checkConnectivity()
    updateConnectivityState(isUp)
  }, 8000)

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  if (process.platform !== "darwin") {
    app.quit()
  }
})
