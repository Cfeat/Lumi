import React from 'react';
import { PetStats } from '../types';

interface StatsBarProps {
  stats: PetStats;
  language: 'en' | 'zh';
}

const Bar: React.FC<{ label: string; emoji: string; value: number; className: string }> = ({
  label, emoji, value, className,
}) => (
  <div className="stat-row" title={`${label}: ${Math.round(value)}/100`}>
    <span className="stat-emoji">{emoji}</span>
    <div className="stat-track">
      <div className={`stat-fill ${className}`} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  </div>
);

const StatsBar: React.FC<StatsBarProps> = ({ stats, language }) => {
  const affectionLevel = Math.floor(stats.affection / 30);
  const t = {
    hunger: language === 'zh' ? '饱食' : 'Food',
    mood: language === 'zh' ? '心情' : 'Mood',
    energy: language === 'zh' ? '精力' : 'Energy',
    bond: language === 'zh' ? `羁绊 Lv.${affectionLevel + 1}` : `Bond Lv.${affectionLevel + 1}`,
  };

  return (
    <div className="stats-bar" data-lumi-interactive="true">
      <div className="stats-bond">{t.bond} <span className="bond-hearts">{'💗'.repeat(Math.min(5, affectionLevel + 1))}</span></div>
      <Bar label={t.hunger} emoji="🍜" value={stats.hunger} className="fill-hunger" />
      <Bar label={t.mood} emoji="💕" value={stats.mood} className="fill-mood" />
      <Bar label={t.energy} emoji="⚡" value={stats.energy} className="fill-energy" />
    </div>
  );
};

export default StatsBar;
