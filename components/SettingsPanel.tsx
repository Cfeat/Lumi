import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Sparkles, MessageCircleHeart } from 'lucide-react';
import { AIConfig, Language, ProviderConfig } from '../types';
import { loadAIConfig } from '../ai';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  language: Language;
  providerOverride: string | null;
  onSelectProvider: (id: string | null) => void;
  idleAI: boolean;
  onToggleIdleAI: (v: boolean) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  open, onClose, language, providerOverride, onSelectProvider, idleAI, onToggleIdleAI,
}) => {
  const [config, setConfig] = useState<AIConfig | null>(null);

  useEffect(() => {
    if (open && !config) loadAIConfig().then(setConfig);
  }, [open, config]);

  const t = {
    title: language === 'zh' ? '设置' : 'Settings',
    provider: language === 'zh' ? 'AI 大脑' : 'AI Brain',
    idle: language === 'zh' ? 'AI 主动搭话' : 'AI small talk',
    idleHint: language === 'zh' ? '允许 Lumi 偶尔自己发起话题' : 'Let Lumi start topics sometimes',
    auto: language === 'zh' ? '跟随配置' : 'Follow config',
    offlineHint: language === 'zh'
      ? '未配置任何 API Key —— Lumi 将使用本地萌语，依然会陪伴你。'
      : 'No API key configured — Lumi will use local phrases and still keep you company.',
    desktopHint: language === 'zh'
      ? '密钥保存在本地 config.json 中，由主进程调用。'
      : 'Keys stay in local config.json, called from the main process.',
  };

  const providerEntries: [string, ProviderConfig][] = config?.providers
    ? Object.entries(config.providers)
    : [];
  const activeId = providerOverride || config?.activeProvider || null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30, transition: { duration: 0.18 } }}
          className="settings-panel"
          data-lumi-interactive="true"
        >
          <div className="chat-header">
            <h3 className="chat-title">{t.title}</h3>
            <button onClick={onClose} className="icon-btn"><X size={20} /></button>
          </div>

          <div className="settings-section">
            <div className="settings-label"><Bot size={15} /> {t.provider}</div>
            <div className="provider-list">
              <button
                className={`provider-item ${activeId === null ? 'active' : ''}`}
                onClick={() => onSelectProvider(null)}
              >
                <Sparkles size={15} /> {t.auto}
              </button>
              {providerEntries.map(([id, p]) => (
                <button
                  key={id}
                  className={`provider-item ${activeId === id ? 'active' : ''}`}
                  onClick={() => onSelectProvider(id)}
                >
                  <MessageCircleHeart size={15} /> {p.name || id}
                  <span className="provider-model">{p.model}</span>
                </button>
              ))}
            </div>
            {!config && (
              <p className="settings-hint">{t.offlineHint}</p>
            )}
            {config && window.lumi?.isDesktop && (
              <p className="settings-hint">{t.desktopHint}</p>
            )}
          </div>

          <div className="settings-section">
            <label className="switch-row">
              <span>
                <div className="settings-label" style={{ marginBottom: 2 }}>{t.idle}</div>
                <div className="settings-hint">{t.idleHint}</div>
              </span>
              <span className={`switch ${idleAI ? 'on' : ''}`} onClick={() => onToggleIdleAI(!idleAI)}>
                <span className="switch-knob" />
              </span>
            </label>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
