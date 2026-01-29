import React, { useState } from 'react';
import Pet from './components/Pet';
import Controls from './components/Controls';
import { generatePetResponse, generateIdleThought } from './api';
import { ChatMessage, PetMood, Language } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentBubbleMessage, setCurrentBubbleMessage] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [language, setLanguage] = useState<Language>('en');

  // Background clicking effect (visual polish)
  const [clicks, setClicks] = useState<{x:number, y:number, id: number}[]>([]);

  const handleStageClick = (e: React.MouseEvent) => {
    // Only trigger if clicking the background directly
    if ((e.target as HTMLElement).id === 'stage') {
      const id = Date.now();
      setClicks([...clicks, { x: e.clientX, y: e.clientY, id }]);
      setTimeout(() => {
        setClicks(prev => prev.filter(c => c.id !== id));
      }, 1000);
    }
  };

  const handleSendMessage = async (text: string) => {
    setIsThinking(true);
    setCurrentBubbleMessage(null); // Clear previous

    // Add user message to history for UI
    const userMsg: ChatMessage = { role: 'user' as const, text };
    const historyForUI = [...messages, userMsg];
    setMessages(historyForUI);

    // Get response
    const response = await generatePetResponse(messages, text, PetMood.HAPPY, language);
    
    setIsThinking(false);
    setCurrentBubbleMessage(response);
    setMessages([...historyForUI, { role: 'model' as const, text: response }]);
  };

  const handleFeed = async () => {
    const msg = language === 'zh' ? "我给你好吃的！ 🍪" : "I am giving you a delicious treat! 🍪";
    handleSendMessage(msg);
  };

  const handlePlay = async () => {
    const msg = language === 'zh' ? "我们来玩游戏吧！" : "Let's play a game! You are it!";
    handleSendMessage(msg);
  };

  const handlePetInteract = () => {
    // Random interaction sound or small thought
    if (!currentBubbleMessage && !isThinking) {
        setIsThinking(true);
        generateIdleThought(language).then(thought => {
            setIsThinking(false);
            setCurrentBubbleMessage(thought);
        });
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const uiText = {
    subtitle: language === 'zh' ? "你的 AI 浏览器伙伴" : "Your AI Browser Companion"
  };

  return (
    <div 
      id="stage"
      onClick={handleStageClick}
    >
      {/* Background decorations */}
      <div className="bg-decoration"></div>
      
      {/* Click Effects */}
      {clicks.map(c => (
        <div 
          key={c.id} 
          className="bg-click"
          style={{ left: c.x, top: c.y }}
        />
      ))}

      {/* Intro Text */}
      <div className="intro-text">
        <h1 className="intro-title">Lumi</h1>
        <p className="intro-subtitle">{uiText.subtitle}</p>
      </div>

      <div className="pet-container">
        <Pet 
            currentMessage={currentBubbleMessage}
            isThinking={isThinking}
            onInteract={handlePetInteract}
        />
      </div>

      <Controls 
        onSendMessage={handleSendMessage} 
        onFeed={handleFeed}
        onPlay={handlePlay}
        onToggleLanguage={toggleLanguage}
        isThinking={isThinking}
        language={language}
      />
    </div>
  );
};

export default App;