import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Opt-in automated test: dispatched by the Electron main process when
// launched with LUMI_AUTOTEST=1. Runs one full AI chat round-trip and
// logs the result (no user interaction needed).
window.addEventListener('lumi-autotest', async () => {
  try {
    const { generatePetResponse } = await import('./ai');
    const t0 = Date.now();
    const reply = await generatePetResponse([], '你好呀Lumi，用一句话介绍一下你自己吧！', null, 'zh');
    console.log('[lumi:autotest]', JSON.stringify({ ok: true, ms: Date.now() - t0, reply }));
  } catch (e: any) {
    console.log('[lumi:autotest]', JSON.stringify({ ok: false, error: String(e?.message || e) }));
  }
});