export enum PetState {
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  SLEEPING = 'SLEEPING',
  CHATTING = 'CHATTING',
  DRAGGING = 'DRAGGING',
  THINKING = 'THINKING',
  EATING = 'EATING',
  PLAYING = 'PLAYING',
  CHEERING = 'CHEERING',
  DIZZY = 'DIZZY'
}

export enum PetMood {
  HAPPY = 'HAPPY',
  NEUTRAL = 'NEUTRAL',
  EXCITED = 'EXCITED',
  TIRED = 'TIRED',
  SAD = 'SAD',
  SLEEPY = 'SLEEPY'
}

export type Language = 'en' | 'zh';

export interface Coordinates {
  x: number;
  y: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface PetConfig {
  name: string;
  color: string;
}

/* ---------- AI provider config ---------- */

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface AIConfig {
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  ai?: {
    /** Allow the pet to occasionally chat via AI on its own initiative */
    idleThoughts?: boolean;
    /** Minimum minutes between proactive AI calls */
    minAIIntervalMinutes?: number;
  };
}

export interface AIChatResult {
  ok: boolean;
  content?: string;
  error?: string;
}

/* ---------- Pet vitals / stats ---------- */

export interface PetStats {
  hunger: number;   // 0-100, 100 = full
  mood: number;     // 0-100
  energy: number;   // 0-100
  affection: number; // total pet points ever
  pets: number;     // times petted
  feeds: number;
  plays: number;
  lastSeen: number; // timestamp
}

/* ---------- Behavior engine ---------- */

export type BehaviorAction =
  | 'sleep' | 'wake' | 'cheer' | 'dizzy' | 'greet'
  | 'eat' | 'play' | 'wave' | 'shiver';

export interface BehaviorReaction {
  text?: string;
  action?: BehaviorAction;
  /** true when text came from the local phrase pool (instant) */
  local?: boolean;
}

/* ---------- Renderer bridge exposed by Electron preload ---------- */

export interface LumiBridge {
  isDesktop: true;
  getConfig: () => Promise<AIConfig | null>;
  aiChat: (payload: {
    messages: { role: string; content: string }[];
    temperature?: number;
    maxTokens?: number;
    provider?: string;
  }) => Promise<AIChatResult>;
  getIdleTime: () => Promise<number>;
  setIgnoreMouse: (ignore: boolean) => void;
  onPowerEvent: (cb: (evt: string) => void) => void;
  hide: () => void;
  quit: () => void;
}

declare global {
  interface Window {
    lumi?: LumiBridge;
  }
}
