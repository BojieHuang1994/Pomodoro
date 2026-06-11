const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// 统计数据存放在用户数据目录，跨重启持久化
const STATS_FILE = path.join(app.getPath('userData'), 'stats.json');
const EMPTY_DAY_STATS = Object.freeze({ focusCount: 0, focusMinutes: 0 });
const todayKey = () => new Date().toISOString().slice(0, 10);

function readStats() {
  try {
    return JSON.parse(fs.readFileSync(statsFile(), 'utf-8'));
  } catch {
    return {}; // 结构：{ "2026-05-31": { focusCount: 3, focusMinutes: 75 }, ... }
  }
}

function writeStats(data) {
  try {
    fs.writeFileSync(statsFile(), JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('写入统计失败:', err);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 560,
    resizable: false,
    title: '番茄钟',
    backgroundColor: '#1f2233',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 关闭窗口时隐藏到托盘而非退出（macOS 习惯）
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // 用空图标 + 文字标题，避免依赖外部图片资源
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('🍅');
  tray.setToolTip('番茄钟');
  const menu = Menu.buildFromTemplate([
    { label: '显示', click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  // 保留托盘常驻，不在此退出
});

// ---- IPC ----
ipcMain.handle('stats:get', () => readStats());

ipcMain.handle('stats:record', (_e, minutes) => {
  const data = readStats();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD（本地日期近似）
  const day = data[today] || { focusCount: 0, focusMinutes: 0 };
  day.focusCount += 1;
  day.focusMinutes += minutes;
  data[today] = day;
  writeStats(data);
  return data;
});

ipcMain.on('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body });
    n.on('click', () => mainWindow && mainWindow.show());
    n.show();
  }
});
