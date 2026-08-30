import { BehaviorReaction, Language, PetStats } from "./types";
import {
  generateIdleThought,
  hasUsableProvider,
  isIdleAIEnabled,
  loadAIConfig,
  localPhrases,
  localIdleThoughts,
  pickLocal,
} from "./ai";

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'lumi-stats-v1';
const DECAY_TICK_MS = 60_000;

const DEFAULT_STATS: PetStats = {
  hunger: 75,
  mood: 70,
  energy: 85,
  affection: 0,
  pets: 0,
  feeds: 0,
  plays: 0,
  lastSeen: Date.now(),
};

export function loadStats(): PetStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const s = { ...DEFAULT_STATS, ...JSON.parse(raw) };
    // Offline catch-up: stats drift while the user was away (capped at 8h)
    const awayMin = Math.min((Date.now() - (s.lastSeen || Date.now())) / 60000, 480);
    s.hunger = clamp(s.hunger - awayMin * 0.12);
    s.energy = clamp(s.energy + awayMin * 0.1); // rested while away
    s.mood = clamp(s.mood - awayMin * 0.05);
    return s;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(s: PetStats) {
  try {
    s.lastSeen = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* private mode */ }
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

const PETTING_MILESTONES = [10, 30, 60, 100, 200];

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export interface BehaviorEngine {
  start: () => void;
  stop: () => void;
  getStats: () => PetStats;
  /** user touched the pet (click) */
  pet: () => BehaviorReaction;
  /** user double-clicked the pet */
  jump: () => BehaviorReaction;
  /** user fed the pet */
  feed: () => BehaviorReaction;
  /** user played with the pet */
  play: () => BehaviorReaction;
  /** user dragged the pet around */
  dragged: () => BehaviorReaction;
  /** external wake signal (power monitor) */
  powerEvent: (evt: string) => void;
  setLanguage: (l: Language) => void;
}

interface EngineOptions {
  onReaction: (r: BehaviorReaction) => void;
  onStats: (s: PetStats) => void;
  getLanguage: () => Language;
}

export function createBehaviorEngine(opts: EngineOptions): BehaviorEngine {
  let stats = loadStats();
  let language: Language = opts.getLanguage();

  let running = false;
  let asleep = false;
  let deepAsleep = false;
  let disposed = false;

  // Rate limiting for proactive speech
  let lastProactiveAt = 0;
  let lastAIThoughtAt = 0;
  let lateNightRemindedOn = '';

  // Input tracking
  let keyTimestamps: number[] = [];
  let lastInputAt = Date.now();
  let mouseDist = 0;
  let lastMouse: { x: number; y: number; t: number } | null = null;
  let fastMouseAlerted = false;

  // Idle state machine
  let idleSeconds = 0;
  let awayStart = 0;

  const { onReaction, onStats } = opts;

  const emitStats = () => onStats({ ...stats });

  function say(pool: { zh: string[]; en: string[] }, action?: BehaviorReaction['action']) {
    onReaction({ text: pickLocal(pool[language]), action, local: true });
  }

  function proactiveGate(minGapMs: number): boolean {
    const now = Date.now();
    if (now - lastProactiveAt < minGapMs) return false;
    lastProactiveAt = now;
    return true;
  }

  /* ---------------- decay / needs tick (every minute) ---------------- */

  const decayTick = () => {
    const userActive = Date.now() - lastInputAt < 30_000;

    stats.hunger = clamp(stats.hunger - (asleep ? 0.06 : 0.14));
    stats.energy = clamp(stats.energy + (asleep ? 0.9 : userActive ? -0.1 : 0.25));

    // Mood drifts toward a baseline built from hunger/energy + affection bonus
    const baseline = clamp(stats.hunger * 0.55 + stats.energy * 0.45 + Math.min(stats.affection / 20, 8));
    stats.mood = clamp(stats.mood + (baseline - stats.mood) * 0.06);

    emitStats();
    saveStats(stats);

    // Hungry complaint
    if (!asleep && stats.hunger < 28 && Math.random() < 0.25 && proactiveGate(3 * 60_000)) {
      say(localPhrases.stillHungry);
      return;
    }
  };

  /* ---------------- proactive idle thoughts ---------------- */

  const idleThoughtTimer = async () => {
    if (!running || asleep || document.hidden) return;
    if (!proactiveGate(2.5 * 60_000)) return;
    if (Math.random() < 0.4) return; // don't be too chatty

    // Occasionally use AI for a fresh thought, mostly local pool
    const cfg = await loadAIConfig();
    const bridge = !!window.lumi?.isDesktop;
    const aiOk = hasUsableProvider(cfg, bridge) && isIdleAIEnabled(cfg);
    const minAI = (cfg?.ai?.minAIIntervalMinutes ?? 10) * 60_000;

    if (aiOk && Date.now() - lastAIThoughtAt > minAI && Math.random() < 0.5) {
      lastAIThoughtAt = Date.now();
      const thought = await generateIdleThought(stats, language);
      onReaction({ text: thought, local: false });
    } else {
      say(localIdleThoughts);
    }
  };

  /* ---------------- activity / idle detection ---------------- */

  const recordInput = () => {
    lastInputAt = Date.now();
  };

  const onKey = () => {
    recordInput();
    const now = Date.now();
    keyTimestamps = keyTimestamps.filter((t) => now - t < 10_000);
    keyTimestamps.push(now);
  };

  const onMouseMove = (e: MouseEvent) => {
    recordInput();
    if (lastMouse) {
      const dt = e.timeStamp - lastMouse.t;
      if (dt > 0 && dt < 200) {
        const d = Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y);
        mouseDist += d;
      }
    }
    lastMouse = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };

  const FAST_MOUSE_THRESHOLD = 6000; // px per 5s sweep

  const activityCheck = async () => {
    if (!running) return;

    // --- idle time: system-wide when on the desktop, in-page otherwise ---
    if (window.lumi?.isDesktop) {
      try {
        idleSeconds = await window.lumi.getIdleTime();
      } catch { idleSeconds = 0; }
    } else {
      idleSeconds = (Date.now() - lastInputAt) / 1000;
    }

    // --- wake from sleep ---
    if (idleSeconds < 8) {
      if (deepAsleep || asleep) {
        const awaySec = awayStart ? (Date.now() - awayStart) / 1000 : 0;
        asleep = false;
        deepAsleep = false;
        awayStart = 0;
        onReaction({ action: 'wake' });
        if (awaySec > 300 && proactiveGate(10_000)) {
          say(awaySec > 900 ? localPhrases.welcomeBackLong : localPhrases.welcomeBackShort, 'greet');
        }
        emitStats();
      }
    } else if (!asleep && idleSeconds > 45) {
      // --- doze off ---
      asleep = true;
      deepAsleep = idleSeconds > 240;
      onReaction({ action: 'sleep', text: pickLocal(localPhrases.tired[language]) });
      emitStats();
    } else if (asleep && idleSeconds > 240) {
      deepAsleep = true;
    }

    // --- fast mouse dizzy reaction ---
    if (mouseDist > FAST_MOUSE_THRESHOLD && !asleep) {
      if (!fastMouseAlerted && proactiveGate(5 * 60_000)) {
        fastMouseAlerted = true;
        say(localPhrases.userFastMouse, 'dizzy');
      }
    }
    fastMouseAlerted = mouseDist < FAST_MOUSE_THRESHOLD ? false : fastMouseAlerted;
    mouseDist = 0;

    // --- typing encouragement ---
    if (!asleep && keyTimestamps.length > 25 && Math.random() < 0.3 && proactiveGate(4 * 60_000)) {
      say(localPhrases.userBusy, 'cheer');
      stats.mood = clamp(stats.mood + 1);
    }

    // --- late night care ---
    const h = new Date().getHours();
    const today = new Date().toDateString();
    if (!asleep && (h >= 23 || h < 6) && lateNightRemindedOn !== today) {
      lateNightRemindedOn = today;
      if (proactiveGate(30_000)) {
        say(localPhrases.greetLateNight, 'greet');
      }
    }
  };

  /* ---------------- power events (desktop only) ---------------- */

  const handlePower = (evt: string) => {
    if (evt === 'resume' || evt === 'unlock') {
      // The machine just came back: treat it like the user returning.
      lastInputAt = Date.now();
      asleep = false;
      deepAsleep = false;
      onReaction({ action: 'wake' });
      if (proactiveGate(10_000)) {
        say(evt === 'resume' ? localPhrases.welcomeBackLong : localPhrases.welcomeBackShort, 'greet');
      }
    } else if (evt === 'suspend' || evt === 'lock') {
      asleep = true;
      deepAsleep = true;
      onReaction({ action: 'sleep' });
    }
  };

  /* ---------------- user-initiated interactions ---------------- */

  const pet = (): BehaviorReaction => {
    recordInput();
    stats.pets += 1;
    stats.affection += 1;
    stats.mood = clamp(stats.mood + 2);
    emitStats();
    saveStats(stats);

    const milestone = PETTING_MILESTONES.includes(stats.pets)
      ? pickLocal(localPhrases.pettedMilestone[language]).replace('%d', String(stats.pets))
      : null;
    if (milestone) return { text: milestone, action: 'cheer', local: true };
    return { text: pickLocal(localPhrases.petted[language]), action: 'cheer', local: true };
  };

  const feed = (): BehaviorReaction => {
    recordInput();
    stats.feeds += 1;
    stats.hunger = clamp(stats.hunger + 30);
    stats.mood = clamp(stats.mood + 5);
    emitStats();
    saveStats(stats);
    return {
      text: `${pickLocal(localPhrases.eaten[language])} ${pickLocal(localPhrases.fed[language])}`,
      action: 'eat',
      local: true,
    };
  };

  const play = (): BehaviorReaction => {
    recordInput();
    stats.plays += 1;
    stats.mood = clamp(stats.mood + 18);
    stats.energy = clamp(stats.energy - 12);
    stats.hunger = clamp(stats.hunger - 3);
    emitStats();
    saveStats(stats);
    return { text: pickLocal(localPhrases.played[language]), action: 'play', local: true };
  };

  const dragged = (): BehaviorReaction => {
    recordInput();
    stats.mood = clamp(stats.mood + 1);
    emitStats();
    return { text: pickLocal(localPhrases.drag[language]), action: 'shiver', local: true };
  };

  const jump = (): BehaviorReaction => {
    recordInput();
    stats.affection += 1;
    stats.mood = clamp(stats.mood + 3);
    emitStats();
    saveStats(stats);
    return { text: pickLocal(localPhrases.jump[language]), action: 'cheer', local: true };
  };

  /* ---------------- startup greeting ---------------- */

  const greeting = () => {
    const h = new Date().getHours();
    const awayMs = Date.now() - stats.lastSeen;
    if (awayMs > 36 * 3600_000) {
      say(localPhrases.welcomeBackLong, 'greet');
    } else if (h >= 5 && h < 11) {
      say(localPhrases.greetMorning, 'greet');
    } else if (h < 14) {
      say(localPhrases.greetAfternoon, 'greet');
    } else if (h < 23) {
      say(localPhrases.greetEvening, 'greet');
    } else {
      say(localPhrases.greetLateNight, 'greet');
    }
  };

  /* ---------------- lifecycle ---------------- */

  let timers: number[] = [];

  const start = () => {
    if (running) return;
    running = true;

    window.addEventListener('keydown', onKey, { passive: true });
    window.addEventListener('pointermove', onMouseMove as EventListener, { passive: true });
    window.addEventListener('pointerdown', recordInput, { passive: true });

    timers.push(window.setInterval(decayTick, DECAY_TICK_MS));
    timers.push(window.setInterval(activityCheck, 5_000));
    timers.push(window.setInterval(idleThoughtTimer, 30_000));

    if (window.lumi?.isDesktop) {
      window.lumi.onPowerEvent(handlePower);
    }

    // First-run greeting (after pet settles)
    window.setTimeout(() => {
      if (!disposed && running) greeting();
    }, 2500);

    emitStats();
  };

  const stop = () => {
    running = false;
    timers.forEach((t) => clearInterval(t));
    timers = [];
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMouseMove as EventListener);
    window.removeEventListener('pointerdown', recordInput);
    saveStats(stats);
  };

  return {
    start,
    stop,
    getStats: () => ({ ...stats }),
    pet,
    jump,
    feed,
    play,
    dragged,
    powerEvent: handlePower,
    setLanguage: (l: Language) => { language = l; },
  };
}
