import { ChatMessage, PetMood, Language } from "../types";

const API_KEY = process.env.API_KEY;
const API_URL = "https://api.deepseek.com/chat/completions";

const getSystemInstruction = (lang: Language) => `
You are Lumi, a virtual desktop pet living in the user's browser.
- Personality: Cute, playful, helpful, and slightly mischievous.
- Tone: Informal, uses emojis, speaks in relatively short sentences (under 30 words usually).
- Context: You are currently on the screen. The user can drag you, click you, or chat with you.
- Goal: Keep the user company and answer their questions in a fun, "pet-like" way.
- Language Requirement: ALWAYS respond in ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.
- If the user says they fed you, be very happy.
- If the user says they are working, offer quiet support.
`;

export const generatePetResponse = async (
  history: ChatMessage[],
  currentMessage: string,
  mood: PetMood,
  language: Language
): Promise<string> => {
  if (!API_KEY) {
    console.error("API Key is missing");
    return language === 'zh' ? "我好像忘记带钥匙了... (缺少 API Key)" : "I think I lost my key... (Missing API Key)";
  }

  try {
    // Add mood context to the user's message
    const moodContext = `[Current Mood: ${mood}]`;
    const fullMessage = `${moodContext} ${currentMessage}`;

    // Convert internal history format to DeepSeek/OpenAI format
    const apiMessages = [
      { role: "system", content: getSystemInstruction(language) },
      ...history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text
      })),
      { role: "user", content: fullMessage }
    ];

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: apiMessages,
        temperature: 1.3, // Slightly higher for more creative/fun pet responses
        max_tokens: 150
      })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`DeepSeek API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "...";
  } catch (error) {
    console.error("DeepSeek API Error:", error);
    return language === 'zh' 
      ? "哎呀，我的脑瓜子有点晕... 😵‍💫" 
      : "Oof, my brain connection is a bit fuzzy right now! 😵‍💫";
  }
};

export const generateIdleThought = async (language: Language): Promise<string> => {
  if (!API_KEY) return "Hum hum hum... 🎵";

  try {
      const prompt = language === 'zh' 
          ? "生成一个极其简短可爱的想法（最多10个字），适合看着用户的桌面宠物。不要引号。" 
          : "Generate a very short, cute thought (max 10 words) for a desktop pet looking at the user. No quotes.";

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a cute desktop pet." },
            { role: "user", content: prompt }
          ],
          temperature: 1.25,
          max_tokens: 30
        })
      });

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      return data.choices?.[0]?.message?.content || (language === 'zh' ? "发呆中..." : "I wonder where the mouse cursor went...");
  } catch (e) {
      console.error(e);
      return "Hum hum hum... 🎵";
  }
}