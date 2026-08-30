import React, { useState } from 'react';
import { Send, Cookie, Gamepad2, X, Languages, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '../types';
import SettingsPanel from './SettingsPanel';

interface ControlsProps {
  onSendMessage: (text: string) => void;
  onFeed: () => void;
  onPlay: () => void;
  onToggleLanguage: () => void;
  isThinking: boolean;
  language: Language;
  providerOverride: string | null;
  onSelectProvider: (id: string | null) => void;
  idleAI: boolean;
  onToggleIdleAI: (v: boolean) => void;
}

const Controls: React.FC<ControlsProps> = ({
  onSendMessage, onFeed, onPlay, onToggleLanguage, isThinking, language,
  providerOverride, onSelectProvider, idleAI, onToggleIdleAI,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  const t = {
    title: language === 'zh' ? "与 Lumi 聊天" : "Chat with Lumi",
    placeholder: language === 'zh' ? "说点什么..." : "Say something...",
    feed: language === 'zh' ? "投喂零食" : "Give Treat",
    play: language === 'zh' ? "一起玩耍" : "Play Game",
    settings: language === 'zh' ? "设置" : "Settings",
  };

  return (
    <div className="controls-container" data-lumi-interactive="true">
      {/* Settings Panel */}
      <SettingsPanel
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        providerOverride={providerOverride}
        onSelectProvider={onSelectProvider}
        idleAI={idleAI}
        onToggleIdleAI={onToggleIdleAI}
      />

      {/* Chat Input Area */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40, transition: { duration: 0.2 } }}
            className="chat-panel"
          >
            <div className="chat-header">
              <h3 className="chat-title">{t.title}</h3>
              <div className="header-actions">
                <button onClick={onToggleLanguage} className="icon-btn" title="中文 / EN">
                  <Languages size={20} />
                </button>
                <button onClick={() => setIsSettingsOpen((v) => !v)} className="icon-btn" title={t.settings}>
                  <Settings size={20} />
                </button>
                <button onClick={() => setIsOpen(false)} className="icon-btn">
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="input-group">
              <div className="input-wrapper">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={t.placeholder}
                  className="chat-input"
                  disabled={isThinking}
                />
                <button type="submit" disabled={!inputText.trim() || isThinking} className="input-send-btn">
                  <Send size={18} strokeWidth={2.5} />
                </button>
              </div>
            </form>

            <div className="action-row">
              <button onClick={onFeed} className="action-btn feed-btn">
                <div className="action-icon-wrapper"><Cookie size={20} strokeWidth={2.5} /></div>
                <span className="action-text">{t.feed}</span>
              </button>
              <button onClick={onPlay} className="action-btn play-btn">
                <div className="action-icon-wrapper"><Gamepad2 size={20} strokeWidth={2.5} /></div>
                <span className="action-text">{t.play}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Toggle Button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`toggle-btn ${isOpen ? 'open' : 'closed'}`}
      >
        {isOpen ? <X size={28} /> : <span style={{ fontSize: '32px' }}>💬</span>}
      </motion.button>
    </div>
  );
};

export default Controls;
