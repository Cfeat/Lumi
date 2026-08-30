/* eslint-disable @typescript-eslint/no-var-requires */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  powerMonitor,
  screen,
  nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let win = null;
let tray = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

function findConfigPath() {
  const appPath = app.getAppPath(); // project root when unpackaged
  const candidates = [
    path.join(app.getPath('userData'), 'config.json'),                  // user override
    path.join(process.resourcesPath || '', 'config', 'config.json'),    // packaged (extraResources)
    path.join(appPath, 'public', 'config', 'config.json'),              // source tree
    path.join(appPath, 'dist', 'config', 'config.json'),                // built bundle
    path.join(appPath, '..', 'public', 'config', 'config.json'),        // fallback
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) { /* ignore */ }
  }
  return null;
}

function loadConfig() {
  const p = findConfigPath();
  if (!p) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.error('[lumi] config parse error:', e.message);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* AI proxy (OpenAI-compatible: /chat/completions)                     */
/* ------------------------------------------------------------------ */

async function chatWithProvider(provider, payload) {
  const url = provider.baseURL.replace(/\/+$/, '') + '/chat/completions';
  const body = {
    model: provider.model,
    messages: payload.messages,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 1.1,
    max_tokens: typeof payload.maxTokens === 'number' ? payload.maxTokens : 600,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    const content =
      data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';
    return { ok: true, content: (content || '').trim() };
  } catch (e) {
    return { ok: false, error: e.message || 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

/** Try the requested provider first; on failure fall back to any other configured one. */
async function handleAIChat(_event, payload) {
  const cfg = loadConfig();
  if (!cfg || !cfg.providers) return { ok: false, error: 'config_missing' };

  const requested = payload.provider || cfg.activeProvider || 'gpt';
  const order = [
    requested,
    ...Object.keys(cfg.providers).filter((k) => k !== requested),
  ];

  let lastError = 'no_provider';
  for (const id of order) {
    const provider = cfg.providers[id];
    if (!provider || !provider.apiKey || !provider.baseURL) continue;
    const result = await chatWithProvider(provider, payload);
    if (result.ok) return result;
    console.warn(`[lumi] provider "${id}" failed:`, result.error);
    lastError = `${id}: ${result.error}`;
  }
  return { ok: false, error: lastError };
}

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    thickFrame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start fully click-through; the renderer flips this when the pointer
  // hovers the pet / UI panels (see setIgnoreMouseEvents forwarding).
  win.setIgnoreMouseEvents(true, { forward: true });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[lumi] renderer loaded');
    // Automated end-to-end test hook (opt-in): LUMI_AUTOTEST=1 npx electron .
    if (process.env.LUMI_AUTOTEST) {
      setTimeout(() => {
        win.webContents.executeJavaScript(
          'window.dispatchEvent(new CustomEvent("lumi-autotest"))'
        ).catch((e) => console.log('[lumi] autotest dispatch failed:', e.message));
      }, 4000);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Tray                                                                */
/* ------------------------------------------------------------------ */

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    // 1x1 transparent fallback so Tray never throws
    img = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    );
  }
  tray = new Tray(img);
  tray.setToolTip('Lumi - 你的桌面萌宠');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示 / 隐藏 Lumi',
        click: () => {
          if (!win) return;
          if (win.isVisible()) win.hide();
          else win.show();
        },
      },
      { type: 'separator' },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
        },
      },
      { type: 'separator' },
      {
        label: '退出 Lumi',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle('lumi:getConfig', () => {
  const cfg = loadConfig();
  if (!cfg) return null;
  // strip keys before handing to renderer in web-parity; renderer never
  // needs the raw key because AI calls are proxied through main.
  const safe = JSON.parse(JSON.stringify(cfg));
  if (safe.providers) {
    for (const k of Object.keys(safe.providers)) {
      if (safe.providers[k].apiKey) safe.providers[k].apiKey = '***';
    }
  }
  return safe;
});

ipcMain.handle('lumi:aiChat', handleAIChat);
ipcMain.handle('lumi:getIdleTime', () => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch (_) {
    return 0;
  }
});

ipcMain.on('lumi:setIgnoreMouse', (_e, ignore) => {
  if (!win) return;
  try {
    win.setIgnoreMouseEvents(!!ignore, { forward: true });
  } catch (_) { /* window may be gone */ }
});

ipcMain.on('lumi:hide', () => win && win.hide());
ipcMain.on('lumi:quit', () => {
  quitting = true;
  app.quit();
});

/* ------------------------------------------------------------------ */
/* Power events (sleep / resume / lock / unlock)                       */
/* ------------------------------------------------------------------ */

function forwardPower(evt) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('lumi:power-event', evt);
  }
}

/* ------------------------------------------------------------------ */
/* App lifecycle                                                       */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    powerMonitor.on('resume', () => forwardPower('resume'));
    powerMonitor.on('suspend', () => forwardPower('suspend'));
    powerMonitor.on('unlock-screen', () => forwardPower('unlock'));
    powerMonitor.on('lock-screen', () => forwardPower('lock'));

    console.log('[lumi] desktop pet started');
  });

  // Keep running in tray when window closed
  app.on('window-all-closed', (e) => {
    // do nothing: stay alive in tray
  });

  app.on('before-quit', () => {
    quitting = true;
  });
}
