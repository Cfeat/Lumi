import React, { useState, useEffect, useRef, useCallback } from 'react';
import Pet from './components/Pet';
import Controls from './components/Controls';
import StatsBar from './components/StatsBar';
import { generatePetResponse } from './ai';
import { createBehaviorEngine, BehaviorEngine } from './behavior';
import { ChatMessage, Language, PetStats, BehaviorAction } from './types';

const isDesktop = !!(window as any).lumi?.isDesktop;

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbleMessage, setBubbleMessage] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [language, setLanguage] = useState<Language>(() =>
    (localStorage.getItem('lumi-lang') as Language) || (navigator.language.startsWith('zh') ? 'zh' : 'en')
  );
  const [stats, setStats] = useState<PetStats | null>(null);
  const [actionSignal, setActionSignal] = useState<{ action: BehaviorAction; id: number } | null>(null);

  const [providerOverride, setProviderOverride] = useState<string | null>(() =>
    localStorage.getItem('lumi-provider')
  );
  const [idleAI, setIdleAI] = useState<boolean>(() =>
    localStorage.getItem('lumi-ai-idle') !== '0'
  );

  const engineRef = useRef<BehaviorEngine | null>(null);
  const bubbleTimer = useRef<number | null>(null);
  const actionIdRef = useRef(0);
  const langRef = useRef(language);
  langRef.current = language;

  /* ---------------- behavior engine ---------------- */

  useEffect(() => {
    const engine = createBehaviorEngine({
      getLanguage: () => langRef.current,
      onReaction: (r) => {
        if (r.text) showBubble(r.text);
        if (r.action) {
          actionIdRef.current += 1;
          setActionSignal({ action: r.action, id: actionIdRef.current });
        }
      },
      onStats: (s) => setStats(s),
    });
    engineRef.current = engine;
    engine.setLanguage(language);
    engine.start();
    return () => engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setLanguage(language);
    localStorage.setItem('lumi-lang', language);
  }, [language]);

  const showBubble = (text: string) => {
    setBubbleMessage(text);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubbleMessage(null), 9000);
  };

  /* ---------------- click-through management (desktop) ---------------- */

  useEffect(() => {
    if (!isDesktop) return;
    const setIgnore = (ignore: boolean) => (window as any).lumi.setIgnoreMouse(ignore);
    let lastIgnore: boolean | null = null;

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const interactive = !!(el && el.closest && el.closest('[data-lumi-interactive]'));
      if (interactive !== lastIgnore) {
        lastIgnore = interactive;
        setIgnore(!interactive);
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      setIgnore(true);
    };
  }, []);

  /* ---------------- chat ---------------- */

  const handleSendMessage = useCallback(async (text: string) => {
    setIsThinking(true);
    setBubbleMessage(null);

    const userMsg: ChatMessage = { role: 'user', text };
    const historyForUI = [...messages, userMsg];
    setMessages(historyForUI.slice(-20));

    const response = await generatePetResponse(messages.slice(-12), text, engineRef.current?.getStats() ?? null, langRef.current);

    setIsThinking(false);
    showBubble(response);
    setMessages([...historyForUI, { role: 'model', text: response }].slice(-20));
  }, [messages]);

  const handleFeed = useCallback(() => {
    const r = engineRef.current?.feed();
    if (r?.text) showBubble(r.text);
    if (r?.action) {
      actionIdRef.current += 1;
      setActionSignal({ action: r.action, id: actionIdRef.current });
    }
  }, []);

  const handlePlay = useCallback(() => {
    const r = engineRef.current?.play();
    if (r?.text) showBubble(r.text);
    if (r?.action) {
      actionIdRef.current += 1;
      setActionSignal({ action: r.action, id: actionIdRef.current });
    }
  }, []);

  const handlePetted = useCallback(() => {
    const r = engineRef.current?.pet();
    if (r?.text) showBubble(r.text);
    if (r?.action) {
      actionIdRef.current += 1;
      setActionSignal({ action: r.action, id: actionIdRef.current });
    }
  }, []);

  const handleDragged = useCallback(() => {
    const r = engineRef.current?.dragged();
    if (r?.text) showBubble(r.text);
    if (r?.action) {
      actionIdRef.current += 1;
      setActionSignal({ action: r.action, id: actionIdRef.current });
    }
  }, []);

  const handleDoublePetted = useCallback(() => {
    const r = engineRef.current?.jump();
    if (r?.text) showBubble(r.text);
    if (r?.action) {
      actionIdRef.current += 1;
      setActionSignal({ action: r.action, id: actionIdRef.current });
    }
  }, []);

  /* ---------------- settings ---------------- */

  const handleSelectProvider = (id: string | null) => {
    setProviderOverride(id);
    if (id) localStorage.setItem('lumi-provider', id);
    else localStorage.removeItem('lumi-provider');
  };

  const handleToggleIdleAI = (v: boolean) => {
    setIdleAI(v);
    localStorage.setItem('lumi-ai-idle', v ? '1' : '0');
  };

  const toggleLanguage = () => setLanguage((p) => (p === 'en' ? 'zh' : 'en'));

  const uiText = {
    subtitle: language === 'zh' ? '你的 AI 桌面萌宠' : 'Your AI Desktop Pet',
  };

  return (
    <div id="stage" className={isDesktop ? 'desktop-mode' : 'web-mode'}>
      {/* Web-mode decorations (hidden on desktop) */}
      {!isDesktop && <div className="bg-decoration" />}
      {!isDesktop && (
        <div className="intro-text">
          <h1 className="intro-title">Lumi</h1>
          <p className="intro-subtitle">{uiText.subtitle}</p>
        </div>
      )}

      {/* Pet (whole window is transparent on desktop; pet floats above the wallpaper) */}
      <Pet
        currentMessage={bubbleMessage}
        isThinking={isThinking}
        stats={stats}
        actionSignal={actionSignal}
        onPetted={handlePetted}
        onDoublePetted={handleDoublePetted}
        onDragged={handleDragged}
      />

      <StatsBar stats={stats ?? {
        hunger: 75, mood: 70, energy: 85, affection: 0, pets: 0, feeds: 0, plays: 0, lastSeen: 0,
      }} language={language} />

      <Controls
        onSendMessage={handleSendMessage}
        onFeed={handleFeed}
        onPlay={handlePlay}
        onToggleLanguage={toggleLanguage}
        isThinking={isThinking}
        language={language}
        providerOverride={providerOverride}
        onSelectProvider={handleSelectProvider}
        idleAI={idleAI}
        onToggleIdleAI={handleToggleIdleAI}
      />
    </div>
  );
};

export default App;
