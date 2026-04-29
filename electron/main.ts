import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import { IncomingMessage } from "http";

const isDev = process.env.NODE_ENV === "development";
const RENDERER_URL = "http://localhost:5173";

// ─── Paths ──────────────────────────────────────────────────────────────────
const userDataPath = app.getPath("userData");
const ITEMS_CACHE_PATH = path.join(userDataPath, "items-cache.json");
const RECIPES_CACHE_PATH = path.join(userDataPath, "recipes-cache.json");

// ─── HTTP helper (no fetch in main to avoid CORS) ───────────────────────────
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    let data = "";
    const req = (protocol as typeof https).get(
      url,
      { timeout: 30000 },
      (res: IncomingMessage) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          httpsGet(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

// Rate limiter for Albion Data Project API (180 req/min, 300 req/5min)
const requestTimestamps: number[] = [];
function canMakeRequest(): boolean {
  const now = Date.now();
  // Remove timestamps older than 5 minutes
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 300_000) {
    requestTimestamps.shift();
  }
  // Check 5-min limit (300) and 1-min limit (180)
  const lastMinute = requestTimestamps.filter((t) => t > now - 60_000).length;
  return requestTimestamps.length < 290 && lastMinute < 175;
}

// ─── IPC: Fetch market prices ────────────────────────────────────────────────
ipcMain.handle(
  "fetch-prices",
  async (_event, itemIds: string[], locations: string[], quality: number) => {
    if (!itemIds.length) return [];

    // Batch into chunks of 100 items
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
      batches.push(itemIds.slice(i, i + BATCH_SIZE));
    }

    const results: unknown[] = [];
    const locationStr = locations.join(",");

    for (const batch of batches) {
      if (!canMakeRequest()) {
        // Wait a bit and retry
        await new Promise((r) => setTimeout(r, 2000));
      }
      const url = `https://europe.albion-online-data.com/api/v2/stats/prices/${batch.join(",")}.json?locations=${locationStr}&qualities=${quality}`;
      try {
        requestTimestamps.push(Date.now());
        const raw = await httpsGet(url);
        const data = JSON.parse(raw);
        results.push(...data);
      } catch (err) {
        console.error("fetch-prices error:", err);
      }
    }
    return results;
  },
);

// ─── IPC: Fetch items list (id → display name) ──────────────────────────────
ipcMain.handle("fetch-items", async () => {
  // Check cache
  if (fs.existsSync(ITEMS_CACHE_PATH)) {
    try {
      const cached = fs.readFileSync(ITEMS_CACHE_PATH, "utf8");
      return JSON.parse(cached);
    } catch {
      // fall through to re-download
    }
  }

  const url =
    "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";
  const raw = await httpsGet(url);
  const data = JSON.parse(raw);
  fs.writeFileSync(ITEMS_CACHE_PATH, JSON.stringify(data));
  return data;
});

// ─── IPC: Fetch & process recipes ───────────────────────────────────────────
ipcMain.handle("fetch-recipes", async () => {
  // Check cache
  if (fs.existsSync(RECIPES_CACHE_PATH)) {
    try {
      const cached = fs.readFileSync(RECIPES_CACHE_PATH, "utf8");
      return JSON.parse(cached);
    } catch {
      // fall through to re-download
    }
  }

  const url =
    "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json";
  const raw = await httpsGet(url);
  const fullData = JSON.parse(raw);

  // Extract only craftable items with their recipes
  const recipes: Record<string, unknown> = {};
  const categories = [
    "equipmentitem",
    "weapon",
    "consumableitem",
    "consumable",
    "simpleitem",
    "farmableitem",
    "mount",
    "furnitureitem",
    "journalitem",
    "labourercontract",
  ];

  for (const category of categories) {
    const items = fullData?.items?.[category];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const id: string = item?.["@uniquename"];
      if (!id) continue;
      const craftReqs = item?.craftingrequirements;
      if (!craftReqs) continue;
      // Normalize to array
      const reqArray = Array.isArray(craftReqs) ? craftReqs : [craftReqs];
      recipes[id] = reqArray;
    }
  }

  fs.writeFileSync(RECIPES_CACHE_PATH, JSON.stringify(recipes));
  return recipes;
});

// ─── IPC: Clear cache ────────────────────────────────────────────────────────
ipcMain.handle("clear-cache", () => {
  if (fs.existsSync(ITEMS_CACHE_PATH)) fs.unlinkSync(ITEMS_CACHE_PATH);
  if (fs.existsSync(RECIPES_CACHE_PATH)) fs.unlinkSync(RECIPES_CACHE_PATH);
  return true;
});

// ─── IPC: Open external URL safely ──────────────────────────────────────────
ipcMain.handle("open-external", (_event, url: string) => {
  // Only allow https URLs
  if (url.startsWith("https://")) {
    shell.openExternal(url);
  }
});

// ─── BrowserWindow ───────────────────────────────────────────────────────────
function createWindow() {
  const preloadPath = isDev
    ? path.join(__dirname, "../../dist/preload/preload.js")
    : path.join(__dirname, "../preload/preload.js");

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Albion Craft Calculator EU",
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL(RENDERER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Prevent navigation to external URLs in the window
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(RENDERER_URL) && !url.startsWith("file://")) {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
