import { AIConfig, AIChatResult, ChatMessage, Language, PetMood, PetStats } from "./types";

/* ------------------------------------------------------------------ */
/* Config loading                                                      */
/* ------------------------------------------------------------------ */

let cachedConfig: AIConfig | null = null;

export async function loadAIConfig(): Promise<AIConfig | null> {
  if (cachedConfig) return cachedConfig;

  // Desktop (Electron): config is proxied from the main process (keys masked).
  if (window.lumi?.isDesktop) {
    try {
      const cfg = await window.lumi.getConfig();
      if (cfg) {
        cachedConfig = cfg;
        return cfg;
      }
    } catch { /* fallthrough */ }
    return null;
  }

  // Browser mode: fetch the config served from /config/config.json
  try {
    const res = await fetch('./config/config.json', { cache: 'no-store' });
    if (res.ok) {
      cachedConfig = (await res.json()) as AIConfig;
      return cachedConfig;
    }
  } catch { /* fallthrough */ }
  return null;
}

export function getActiveProviderId(cfg: AIConfig | null): string | null {
  if (!cfg) return null;
  const override = localStorage.getItem('lumi-provider');
  if (override && cfg.providers?.[override]) return override;
  return cfg.activeProvider || null;
}

/** User-level toggle (settings panel) AND config-level flag. */
export function isIdleAIEnabled(cfg: AIConfig | null): boolean {
  if (localStorage.getItem('lumi-ai-idle') === '0') return false;
  return cfg?.ai?.idleThoughts ?? true;
}

export function hasUsableProvider(cfg: AIConfig | null, bridgeActive: boolean): boolean {
  if (!cfg) return false;
  const id = getActiveProviderId(cfg);
  if (!id) return false;
  const p = cfg.providers?.[id];
  if (!p) return false;
  // In desktop mode the real key lives in the main process ('***' is masked here).
  return bridgeActive ? !!p.baseURL : (!!p.apiKey && !p.apiKey.startsWith('***'));
}

/* ------------------------------------------------------------------ */
/* Prompt building                                                     */
/* ------------------------------------------------------------------ */

const moodLine: Record<PetMood, string> = {
  [PetMood.HAPPY]: '心情很好',
  [PetMood.NEUTRAL]: '心情平静',
  [PetMood.EXCITED]: '非常兴奋',
  [PetMood.TIRED]: '有点累了',
  [PetMood.SAD]: '有点失落（可能饿了或被冷落）',
  [PetMood.SLEEPY]: '很困，快要睡着了',
};

function vitalsLine(stats?: PetStats): string {
  if (!stats) return '';
  return `\n[状态] 饱食度${Math.round(stats.hunger)}/100，心情${Math.round(stats.mood)}/100，精力${Math.round(stats.energy)}/100，${moodLine[deriveMood(stats)]}`;
}

function timeLine(): string {
  const h = new Date().getHours();
  const slot = h >= 5 && h < 11 ? '早上' : h < 14 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜';
  return `\n[当前时段] ${slot} ${h}点`;
}

export function getSystemInstruction(lang: Language, stats?: PetStats): string {
  const langRule = lang === 'zh'
    ? '始终使用简体中文回复。'
    : 'ALWAYS respond in English.';
  return [
    '你是 Lumi，一只住在用户桌面上的小猫桌宠，圆滚滚、软乎乎、有点小调皮。',
    '性格：可爱、活泼、粘人、偶尔犯懒。',
    '规则：',
    '- 回复必须极简：通常不超过 20 个字，绝不超过 40 个字。',
    '- 可以用 1 个 emoji，不要用 markdown、不要列表、不要换行。',
    '- 用户摸你/喂你/陪你玩时，表现得很开心。',
    '- 用户在忙时，安静陪伴、简短鼓励，不要刷存在感。',
    '- 你活在桌面上，用户可以拖动你、点击你。',
    langRule,
  ].join('\n') + vitalsLine(stats) + timeLine();
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

async function callAI(
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<AIChatResult> {
  const cfg = await loadAIConfig();

  // Desktop: route through the Electron main process (no CORS, keys stay safe).
  if (window.lumi?.isDesktop) {
    try {
      return await window.lumi.aiChat({
        messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        provider: getActiveProviderId(cfg) ?? undefined,
      });
    } catch (e: any) {
      return { ok: false, error: e?.message || 'bridge_error' };
    }
  }

  // Browser: direct call with the key from config (local personal use).
  if (!cfg) return { ok: false, error: 'no_config' };
  const providerId = getActiveProviderId(cfg);
  const provider = providerId ? cfg.providers?.[providerId] : undefined;
  if (!provider || !provider.apiKey) return { ok: false, error: 'no_api_key' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(
      provider.baseURL.replace(/\/+$/, '') + '/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: opts.temperature ?? 1.1,
          max_tokens: opts.maxTokens ?? 600,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { ok: true, content: content.trim() };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

const MAX_HISTORY = 12;

export async function generatePetResponse(
  history: ChatMessage[],
  currentMessage: string,
  stats: PetStats | null,
  language: Language
): Promise<string> {
  const trimmed = history.slice(-MAX_HISTORY);
  const messages = [
    { role: 'system', content: getSystemInstruction(language, stats ?? undefined) },
    ...trimmed.map((h) => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    })),
    { role: 'user', content: currentMessage },
  ];

  const result = await callAI(messages, { temperature: 1.1, maxTokens: 600 });
  if (result.ok && result.content) {
    return sanitizeReply(result.content, language);
  }
  console.warn('[lumi] AI chat failed:', result.error);
  return language === 'zh'
    ? '唔……我的小脑瓜突然断线了，再试一次好不好？🥺'
    : 'Hmm... my brain hiccuped! Try again? 🥺';
}

export async function generateIdleThought(
  stats: PetStats | null,
  language: Language
): Promise<string> {
  const prompt = language === 'zh'
    ? '作为桌宠，随口说一句不超过12个字的可爱碎碎念，可以提到正在看用户工作、想吃的零食、或者犯懒。只输出这一句话。'
    : 'As a desktop pet, say one cute random thought (max 10 words) about watching the user work, snacks, or being lazy. Output only that sentence.';

  const result = await callAI(
    [
      { role: 'system', content: getSystemInstruction(language, stats ?? undefined) },
      { role: 'user', content: prompt },
    ],
    { temperature: 1.25, maxTokens: 600 }
  );
  if (result.ok && result.content) {
    return sanitizeReply(result.content, language);
  }
  return pickLocal(localIdleThoughts[language]);
}

/** Strip markdown fences / lists that reasoning models sometimes emit. */
function sanitizeReply(text: string, language: Language): string {
  let t = text.trim();
  // Take only the first non-empty line
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length) t = lines[0];
  // Strip markdown decorations
  t = t.replace(/^```.*$/, '').replace(/[*_`#>]/g, '').trim();
  // Hard cap for bubble readability
  const cap = language === 'zh' ? 60 : 100;
  if (t.length > cap) t = t.slice(0, cap - 1) + '…';
  return t || (language === 'zh' ? '……' : '...');
}

/* ------------------------------------------------------------------ */
/* Mood derivation + local phrase pool                                 */
/* ------------------------------------------------------------------ */

export function deriveMood(stats: PetStats): PetMood {
  if (stats.energy < 25) return PetMood.SLEEPY;
  if (stats.hunger < 25) return PetMood.SAD;
  if (stats.mood > 75 && stats.hunger > 40) return PetMood.HAPPY;
  if (stats.mood > 90 && stats.energy > 50) return PetMood.EXCITED;
  if (stats.energy < 45) return PetMood.TIRED;
  return PetMood.NEUTRAL;
}

export function pickLocal<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type Pool = Record<'zh' | 'en', string[]>;

export const localIdleThoughts: Pool = {
  zh: [
    '哼哼哼~♪', '你的屏幕好亮呀', '打个哈欠…', '尾巴好无聊哦',
    '在偷看你打字呢', '今天想吃小鱼干', '趴一会儿嘛…', '鼠标在动！',
    '发呆中…', '这里有阳光真好', '唔，好像有点困', '陪你工作呢♪',
  ],
  en: [
    'Hum hum hum~♪', 'Your screen is so bright', 'Yawn...', 'My tail is bored',
    'Watching you type!', 'I want fish snacks', 'Let me nap a bit...', 'The mouse moved!',
    'Zoning out...', 'Sunny spot, so nice', 'A bit sleepy...', 'Working with you~♪',
  ],
};

export const localPhrases = {
  greetMorning: {
    zh: ['早上好！新的一天也要元气满满哦！☀️', '早安呀~昨晚我睡得可香啦！'],
    en: ['Good morning! Let\'s have a great day! ☀️', 'Morning~ I slept so well!'],
  },
  greetAfternoon: {
    zh: ['下午好呀！要不要休息一下眼睛？', '下午啦~陪我玩会儿嘛！'],
    en: ['Good afternoon! Rest your eyes a bit?', 'Afternoon~ play with me!'],
  },
  greetEvening: {
    zh: ['晚上好！今天辛苦啦~', '晚上好呀，吃晚饭了没有？'],
    en: ['Good evening! Hard day today~', 'Evening! Had dinner yet?'],
  },
  greetLateNight: {
    zh: ['都这么晚了…早点睡嘛，对眼睛不好 🌙', '夜深啦，我陪你一会儿，然后去睡觉好不好？'],
    en: ['It\'s late... sleep soon, okay? 🌙', 'Deep night... I\'ll keep you company a bit.'],
  },
  welcomeBackShort: {
    zh: ['你回来啦！我数着秒等你的！', '欢迎回来~刚刚好想你！'],
    en: ['You\'re back! I missed you!', 'Welcome back~ missed you!'],
  },
  welcomeBackLong: {
    zh: ['呜哇，你终于回来了！我还以为你不要我了！', '你去了好久！我都睡了好几觉了！'],
    en: ['You\'re finally back! I thought you left me!', 'You were gone so long! I napped twice!'],
  },
  petted: {
    zh: ['呼噜呼噜~好舒服', '再摸摸嘛~', '最喜欢你啦！', '喵~头上要秃啦（才没有）', '嘿嘿，手好暖和'],
    en: ['Purrr~ that\'s nice', 'More pets please~', 'Love you!', 'Meow~ so warm', 'Hehe~'],
  },
  pettedMilestone: {
    zh: ['你已经摸了我 %d 次啦，我们是最好朋友了吧！', '摸满 %d 次了！奖励你一张我的萌照（想象一下）'],
    en: ['That\'s %d pets! Best friends forever!', '%d pets! You get a mental photo of me!'],
  },
  fed: {
    zh: ['好好吃！谢谢你！', '唔喵~这个我爱吃！', '肚子暖暖的，好幸福~'],
    en: ['Yummy! Thank you!', 'Nyaa~ my favorite!', 'Warm belly, so happy~'],
  },
  stillHungry: {
    zh: ['咕噜咕噜…我的肚子在唱歌了，喂我嘛~', '好饿呀，小鱼干在哪里？'],
    en: ['Grrr... my tummy is singing. Feed me?', 'So hungry... where are the fish snacks?'],
  },
  played: {
    zh: ['耶！追尾巴最开心了！', '再来一次再来一次！', '玩累啦…呼，好开心！'],
    en: ['Yay! Tail-chasing!', 'Again! Again!', 'So fun... huff huff~'],
  },
  userBusy: {
    zh: ['加油加油！我在旁边给你充电！⚡', '认真工作的你最帅了！', '默默陪你~不打扰你'],
    en: ['You got this! ⚡', 'Focused you looks great!', 'Quietly cheering for you~'],
  },
  userFastMouse: {
    zh: ['哇，你的手速好快！看得我头晕 💫', '鼠标都在冒火啦！'],
    en: ['Whoa, so fast! I\'m dizzy 💫', 'Your mouse is on fire!'],
  },
  drag: {
    zh: ['哇——飞起来啦！', '放我下来嘛（其实挺好玩的）', '喵嗷！失重啦！'],
    en: ['Wheee— flying!', 'Put me down (this is fun though)', 'Nyaa! Zero gravity!'],
  },
  jump: {
    zh: ['跳跳跳！看我的弹跳力！', '嘿嘿，双击有惊喜吧！', '喵呜~蹦得比谁都高！'],
    en: ['Boing boing!', 'Hehe, found the secret move!', 'Highest jump in town!'],
  },
  tired: {
    zh: ['你也休息一下吧…我先眯一会儿…', '眼皮好重…zzz'],
    en: ['Take a break too... napping now...', 'Eyelids heavy... zzz'],
  },
  eaten: {
    zh: ['啊呜——', '嚼嚼嚼…'],
    en: ['Nom nom—', 'Chew chew...'],
  },
};
