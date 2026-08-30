import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PetMood, PetState } from '../types';

export interface FXSignal {
  type: 'hearts' | 'sparkles' | 'none';
  id: number;
}

interface PetCharacterProps {
  state: PetState;
  mood: PetMood;
  color: string;
  isFacingLeft: boolean;
  fx?: FXSignal;
}

const INK = '#312e81';
const INNER_EAR = '#fbcfe8';
const BLUSH = '#fda4af';
const BELLY = '#eef2ff';

/* ------------------------------------------------------------------ */
/* Particle FX (hearts / sparkles) — retriggered via fx.id             */
/* ------------------------------------------------------------------ */

const Particles: React.FC<{ fx: FXSignal }> = ({ fx }) => {
  if (fx.type === 'none') return null;
  const isHearts = fx.type === 'hearts';
  const glyphs = isHearts ? ['💗', '💖', '💗', '💕', '💗'] : ['✨', '⭐', '✨', '💫', '✨'];
  return (
    <div className="fx-layer" key={fx.id}>
      {glyphs.map((g, i) => {
        const x0 = -34 + i * 17 + (i % 2 ? 6 : -6);
        return (
          <motion.span
            key={i}
            className="fx-particle"
            initial={{ opacity: 0, x: x0, y: -18, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -90 - i * 8,
              x: x0 + (i % 2 ? 14 : -12),
              scale: [0.4, 1.1, 0.9, 0.5],
              rotate: (i % 2 ? 1 : -1) * (20 + i * 8),
            }}
            transition={{ duration: 1.4 + i * 0.08, ease: 'easeOut', delay: i * 0.06 }}
          >
            {g}
          </motion.span>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Character                                                           */
/* ------------------------------------------------------------------ */

const PetCharacter: React.FC<PetCharacterProps> = ({ state, mood, isFacingLeft, fx }) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // Blinking (skip while sleeping / dizzy)
  useEffect(() => {
    let timeout: number;
    const schedule = () => {
      const delay = 2400 + Math.random() * 2800;
      timeout = window.setTimeout(() => {
        if (state !== PetState.SLEEPING && state !== PetState.DIZZY) {
          setIsBlinking(true);
          window.setTimeout(() => setIsBlinking(false), 140);
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [state]);

  /* ---------------- body motion variants ---------------- */

  const bodyVariants: Record<string, any> = {
    [PetState.IDLE]: {
      y: [0, -3, 0], scaleY: [1, 1.025, 1],
      transition: { repeat: Infinity, duration: 2.8, ease: 'easeInOut' },
    },
    [PetState.WALKING]: {
      y: [0, -9, 0], rotate: [0, -4, 4, 0],
      transition: { repeat: Infinity, duration: 0.55, ease: 'easeInOut' },
    },
    [PetState.SLEEPING]: {
      scaleY: [0.94, 1.05, 0.94], scaleX: [1.05, 0.96, 1.05],
      transition: { repeat: Infinity, duration: 3.2, ease: 'easeInOut' },
    },
    [PetState.DRAGGING]: {
      scale: 1.12, rotate: [0, 7, -7, 0],
      transition: { repeat: Infinity, duration: 0.4 },
    },
    [PetState.CHATTING]: {
      y: [0, -3, 0], scale: [1, 1.03, 1],
      transition: { repeat: Infinity, duration: 0.7 },
    },
    [PetState.THINKING]: {
      rotate: [0, 4, 0, -4, 0], y: 0,
      transition: { repeat: Infinity, duration: 2.2 },
    },
    [PetState.EATING]: {
      scaleY: [1, 0.92, 1], y: [0, 2, 0],
      transition: { repeat: Infinity, duration: 0.34, ease: 'easeIn' },
    },
    [PetState.PLAYING]: {
      y: [0, -16, 0], rotate: [0, 9, -9, 0],
      transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' },
    },
    [PetState.CHEERING]: {
      y: [0, -22, 0], scale: [1, 1.06, 1],
      transition: { repeat: Infinity, duration: 0.5, ease: 'easeOut' },
    },
    [PetState.DIZZY]: {
      rotate: [0, 9, 0, -9, 0], x: [-2, 2, -2],
      transition: { repeat: Infinity, duration: 0.45 },
    },
  };

  /* ---------------- tail / ears ---------------- */

  const tailWagFast =
    state === PetState.WALKING || state === PetState.PLAYING ||
    state === PetState.CHEERING || mood === PetMood.EXCITED;

  const tailVariants = {
    idle: {
      rotate: [0, 10, -6, 12, 0],
      transition: { repeat: Infinity, duration: 2.6, ease: 'easeInOut' },
    },
    wag: {
      rotate: [0, 26, -8, 26, 0],
      transition: { repeat: Infinity, duration: 0.45, ease: 'easeInOut' },
    },
    still: { rotate: 6, transition: { duration: 1 } },
  };

  const earWiggle = {
    rotate: [0, mood === PetMood.HAPPY || mood === PetMood.EXCITED ? 5 : 2.5, 0],
    transition: { repeat: Infinity, duration: mood === PetMood.HAPPY ? 1.6 : 3.4, ease: 'easeInOut' },
  };

  /* ---------------- eyes ---------------- */

  const sleepy = mood === PetMood.SLEEPY || mood === PetMood.TIRED || state === PetState.SLEEPING;
  const dizzy = state === PetState.DIZZY || state === PetState.DRAGGING;

  const Eye: React.FC<{ x: number }> = ({ x }) => {
    // closed-arc eyes
    if (state === PetState.SLEEPING) {
      return (
        <g transform={`translate(${x}, 0)`}>
          <path d="M -7 0 Q 0 5 7 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    }
    if (mood === PetMood.EXCITED && !isBlinking) {
      return (
        <g transform={`translate(${x}, 0)`}>
          <path d="M -7 2 Q 0 -6 7 2" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        </g>
      );
    }
    if (dizzy) {
      return (
        <g transform={`translate(${x}, 0)`} stroke={INK} strokeWidth="2.8" strokeLinecap="round">
          <path d="M -5 -5 L 5 5" /><path d="M 5 -5 L -5 5" />
        </g>
      );
    }
    if (mood === PetMood.SAD) {
      return (
        <g transform={`translate(${x}, 0)`}>
          <path d="M -6 2 Q 0 -3 6 2" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    }
    // glossy open eye (with blink squash)
    return (
      <motion.g
        transform={`translate(${x}, 0)`}
        animate={{ scaleY: isBlinking ? 0.08 : 1 }}
        transition={{ duration: 0.09 }}
        style={{ originY: '0px' }}
      >
        <ellipse cx="0" cy="0" rx="6.4" ry="8" fill={INK} />
        <ellipse cx="0" cy="1.5" rx="6.4" ry="8" fill="none" stroke={INK} strokeWidth="0" />
        <circle cx="2.2" cy="-3.2" r="2.6" fill="white" />
        <circle cx="-2" cy="3.4" r="1.3" fill="white" opacity="0.85" />
        {sleepy && <path d="M -7 -2 L 7 -2" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      </motion.g>
    );
  };

  /* ---------------- mouth ---------------- */

  const Mouth: React.FC = () => {
    if (state === PetState.EATING) {
      return (
        <g transform="translate(0, 8)">
          <ellipse cx="0" cy="1" rx="5" ry="4" fill={INK} opacity="0.9" />
        </g>
      );
    }
    if (mood === PetMood.EXCITED || state === PetState.CHATTING || state === PetState.CHEERING) {
      return (
        <g transform="translate(0, 8)">
          <path d="M -8 -1 Q 0 9 8 -1" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M -3 4 Q 0 8 3 4 Z" fill="#f9a8d4" />
        </g>
      );
    }
    if (mood === PetMood.SAD) {
      return <path d="M -5 5 Q 0 1 5 5" transform="translate(0, 6)" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />;
    }
    // default: cat ω mouth
    return (
      <g transform="translate(0, 8)">
        <path d="M -7 0 Q -3.5 4.5 0 0.5 Q 3.5 4.5 7 0" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  };

  /* ---------------- render ---------------- */

  return (
    <motion.div
      style={{ width: 150, height: 150, transformOrigin: 'center bottom', position: 'relative' }}
      animate={state}
      variants={bodyVariants}
    >
      <Particles fx={fx ?? { type: 'none', id: 0 }} />

      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="45%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <radialGradient id="glowGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="tailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>

        {/* soft ground shadow */}
        <motion.ellipse
          cx="50" cy="95" rx="30" ry="5" fill="rgba(30,27,75,0.18)"
          animate={state === PetState.WALKING || state === PetState.PLAYING || state === PetState.CHEERING
            ? { rx: [30, 24, 30], opacity: [1, 0.6, 1] }
            : { rx: 30, opacity: 1 }}
          transition={{ repeat: Infinity, duration: 0.55 }}
          style={{ filter: 'blur(1px)' }}
        />

        <motion.g style={{ scaleX: isFacingLeft ? -1 : 1, originX: '50px' }}>
          {/* ============ tail (behind body) ============ */}
          <motion.g
            style={{ originX: '74px', originY: '74px' }}
            animate={state === PetState.SLEEPING ? 'still' : tailWagFast ? 'wag' : 'idle'}
            variants={tailVariants}
          >
            <path
              d="M 74 74 C 92 76 98 62 94 50 C 92 43 85 42 84 47 C 83 51 88 52 88 56 C 88 62 82 66 74 66 Z"
              fill="url(#tailGrad)"
              stroke={INK}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </motion.g>

          {/* ============ back legs ============ */}
          <motion.path
            d="M 33 78 L 33 89 A 4.5 4.5 0 0 0 42 89 L 42 78 Z"
            fill="#818cf8" stroke={INK} strokeWidth="2.4" strokeLinejoin="round"
            animate={state === PetState.WALKING ? { y: [0, -7, 0], x: [0, 6, 0] } : { y: 0, x: 0 }}
            transition={{ repeat: Infinity, duration: 0.55, delay: 0.12 }}
          />
          <motion.path
            d="M 58 78 L 58 89 A 4.5 4.5 0 0 0 67 89 L 67 78 Z"
            fill="#818cf8" stroke={INK} strokeWidth="2.4" strokeLinejoin="round"
            animate={state === PetState.WALKING ? { y: [0, -7, 0], x: [0, -6, 0] } : { y: 0, x: 0 }}
            transition={{ repeat: Infinity, duration: 0.55 }}
          />

          {/* ============ ears ============ */}
          <motion.g animate={earWiggle} style={{ originX: '32px', originY: '26px' }}>
            <path d="M 30 28 L 21 6 Q 20 3 24 5 L 45 19 Z"
              fill="url(#bodyGrad)" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 29.5 24 L 25 12 L 38 19.5 Z" fill={INNER_EAR} opacity="0.9" />
          </motion.g>
          <motion.g animate={earWiggle} style={{ originX: '68px', originY: '26px' }}>
            <path d="M 70 28 L 79 6 Q 80 3 76 5 L 55 19 Z"
              fill="url(#bodyGrad)" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 70.5 24 L 75 12 L 62 19.5 Z" fill={INNER_EAR} opacity="0.9" />
          </motion.g>

          {/* ahoge (hair tuft) */}
          <motion.path
            d="M 50 13 C 48 7 52 3 57 4"
            fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round"
            animate={{ rotate: [0, -9, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            style={{ originX: '50px', originY: '13px' }}
          />

          {/* ============ body ============ */}
          <path
            d="M 50 14 C 26 14 14 42 14 68 C 14 85 30 92 50 92 C 70 92 86 85 86 68 C 86 42 74 14 50 14 Z"
            fill="url(#bodyGrad)"
            stroke={INK}
            strokeWidth="2.6"
          />
          {/* glossy light overlay */}
          <path
            d="M 50 14 C 26 14 14 42 14 68 C 14 85 30 92 50 92 C 70 92 86 85 86 68 C 86 42 74 14 50 14 Z"
            fill="url(#glowGrad)"
          />
          {/* belly */}
          <path
            d="M 50 47 C 39 47 31 62 31 76 C 31 84 39 88 50 88 C 61 88 69 84 69 76 C 69 62 61 47 50 47 Z"
            fill={BELLY}
            opacity="0.75"
          />

          {/* front paws */}
          <ellipse cx="40" cy="88" rx="7" ry="4" fill="#c7d2fe" stroke={INK} strokeWidth="2" />
          <ellipse cx="60" cy="88" rx="7" ry="4" fill="#c7d2fe" stroke={INK} strokeWidth="2" />

          {/* ============ face ============ */}
          <g transform="translate(50, 46)">
            <Eye x={-16} />
            <Eye x={16} />

            {/* blush */}
            <ellipse cx="-26" cy="8" rx="6.5" ry="3.6" fill={BLUSH} opacity="0.6" />
            <ellipse cx="26" cy="8" rx="6.5" ry="3.6" fill={BLUSH} opacity="0.6" />

            {/* nose + mouth */}
            <path d="M 0 2 Q 1.5 4.5 0 5 Q -1.5 4.5 0 2 Z" fill={INK} transform="translate(0, 0)" />
            <g transform="translate(0, 3)"><Mouth /></g>

            {/* whiskers */}
            <g stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
              <path d="M -30 2 L -42 0" /><path d="M -30 6 L -41 8" />
              <path d="M 30 2 L 42 0" /><path d="M 30 6 L 41 8" />
            </g>
          </g>

          {/* ============ state ornaments ============ */}
          {/* Zzz */}
          {state === PetState.SLEEPING && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0], x: [58, 88], y: [8, -36], scale: [0.5, 1.15] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeOut' }}
            >
              <text x="0" y="0" fontSize="22" fill="#818cf8" fontWeight="bold" fontFamily="inherit">Z z</text>
            </motion.g>
          )}

          {/* thinking ? */}
          {state === PetState.THINKING && (
            <motion.text
              x="72" y="24" fontSize="26" fill="#818cf8" fontWeight="bold" fontFamily="inherit"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: [0, 12, -12, 0] }}
              transition={{ duration: 0.5 }}
              style={{ originX: '78px', originY: '20px' }}
            >?</motion.text>
          )}

          {/* dizzy stars */}
          {state === PetState.DIZZY && (
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
              style={{ originX: '50px', originY: '20px' }}
            >
              <text x="34" y="14" fontSize="13">💫</text>
              <text x="60" y="12" fontSize="13">⭐</text>
            </motion.g>
          )}

          {/* eating cookie */}
          {state === PetState.EATING && (
            <motion.g
              animate={{ x: [-6, 0, -3], y: [0, 3, 0], rotate: [0, -15, 0], opacity: [0, 1, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              style={{ originX: '18px', originY: '52px' }}
            >
              <circle cx="14" cy="55" r="6.5" fill="#d97706" stroke={INK} strokeWidth="2" />
              <circle cx="12" cy="53" r="1" fill={BELLY} /><circle cx="16.5" cy="56" r="1" fill={BELLY} />
            </motion.g>
          )}

          {/* music note while idle-humming */}
          {state === PetState.IDLE && mood === PetMood.HAPPY && (
            <motion.text
              x="66" y="16" fontSize="14" fill="#f472b6"
              animate={{ opacity: [0, 1, 0], y: [16, 2] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: 'easeOut' }}
            >♪</motion.text>
          )}
        </motion.g>
      </svg>
    </motion.div>
  );
};

export default PetCharacter;
