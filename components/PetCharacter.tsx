import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PetMood, PetState } from '../types';

interface PetCharacterProps {
  state: PetState;
  mood: PetMood;
  color: string;
  isFacingLeft: boolean;
}

const PetCharacter: React.FC<PetCharacterProps> = ({ state, mood, color, isFacingLeft }) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // Blinking logic
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (state !== PetState.SLEEPING) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 200);
      }
    }, 4000);
    return () => clearInterval(blinkInterval);
  }, [state]);

  // Body animation variants
  const bodyVariants = {
    [PetState.IDLE]: {
      y: [0, -4, 0],
      scaleY: [1, 1.03, 1],
      transition: { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
    },
    [PetState.WALKING]: {
      y: [0, -12, 0],
      rotate: [0, -6, 6, 0],
      scaleX: [1, 1.05, 1],
      transition: { repeat: Infinity, duration: 0.5, ease: "linear" }
    },
    [PetState.SLEEPING]: {
      scaleY: [0.95, 1.05, 0.95],
      scaleX: [1.05, 0.95, 1.05],
      transition: { repeat: Infinity, duration: 3, ease: "easeInOut" }
    },
    [PetState.DRAGGING]: {
      scale: 1.15,
      rotate: [0, 8, -8, 0],
      transition: { repeat: Infinity, duration: 0.3 }
    },
    [PetState.CHATTING]: {
      y: [0, -3, 0],
      scale: [1, 1.02, 1],
      transition: { repeat: Infinity, duration: 0.8 }
    },
    [PetState.THINKING]: {
        y: 0,
        rotate: [0, 5, 0, -5, 0],
        transition: {repeat: Infinity, duration: 2}
    }
  };

  const getEyePath = (side: 'left' | 'right') => {
    if (state === PetState.SLEEPING) return "M -6 2 Q 0 6 6 2";
    if (isBlinking && state !== PetState.DRAGGING) return "M -6 0 L 6 0"; // Closed line
    if (mood === PetMood.EXCITED) return "M -6 0 Q 0 -6 6 0"; // Arc up
    if (state === PetState.DRAGGING) return "M -5 -5 L 5 5 M 5 -5 L -5 5"; // X eyes
    return "M 0 -7 A 6 8 0 1 1 0 7 A 6 8 0 1 1 0 -7"; // Open oval
  };

  const getMouthPath = () => {
    if (mood === PetMood.EXCITED || state === PetState.CHATTING) return "M -8 -2 Q 0 8 8 -2";
    if (state === PetState.DRAGGING) return "M -6 4 A 6 6 0 1 1 6 4"; // O mouth
    if (mood === PetMood.HAPPY) return "M -6 0 Q 0 5 6 0";
    return "M -4 2 L 4 2";
  };

  return (
    <motion.div
      style={{
        width: 140,
        height: 140,
        transformOrigin: "center bottom"
      }}
      animate={state}
      variants={bodyVariants}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="earGradient" x1="0%" y1="0%" x2="0%" y2="100%">
             <stop offset="0%" stopColor="#818cf8" />
             <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
           <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Shadow */}
        <ellipse cx="50" cy="95" rx="35" ry="6" fill="rgba(0,0,0,0.1)" filter="blur(2px)" />

        <motion.g 
          style={{ scaleX: isFacingLeft ? -1 : 1, originX: "50px" }}
        >
          {/* Back Leg Left */}
          <motion.path
            d="M 35 80 L 35 92 A 4 4 0 0 0 43 92 L 43 80"
            fill="url(#bodyGradient)"
            stroke="#1e1b4b"
            strokeWidth="3"
            animate={state === PetState.WALKING ? { y: [0, -6, 0], x: [0, 8, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.5, delay: 0.25 }}
          />

           {/* Back Leg Right */}
           <motion.path
            d="M 57 80 L 57 92 A 4 4 0 0 0 65 92 L 65 80"
            fill="url(#bodyGradient)"
            stroke="#1e1b4b"
            strokeWidth="3"
            animate={state === PetState.WALKING ? { y: [0, -6, 0], x: [0, -8, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.5 }}
          />

          {/* Main Body */}
          <path
            d="M 50 15 C 25 15 15 45 15 70 C 15 85 30 90 50 90 C 70 90 85 85 85 70 C 85 45 75 15 50 15 Z"
            fill="url(#bodyGradient)"
            stroke="#1e1b4b"
            strokeWidth="3"
          />

          {/* Belly Patch (Softened) */}
          <path
            d="M 50 45 C 38 45 30 60 30 75 C 30 82 38 85 50 85 C 62 85 70 82 70 75 C 70 60 62 45 50 45 Z"
            fill="white"
            opacity="0.3"
          />

          {/* Ears */}
          <path 
            d="M 30 25 L 20 5 L 45 20" 
            fill="url(#earGradient)"
            stroke="#1e1b4b" 
            strokeWidth="3" 
            strokeLinejoin="round" 
          />
          <path 
            d="M 28 22 L 23 10 L 40 19" 
            fill="#e0e7ff" 
          />
          
          <path 
            d="M 70 25 L 80 5 L 55 20" 
            fill="url(#earGradient)"
            stroke="#1e1b4b" 
            strokeWidth="3" 
            strokeLinejoin="round" 
          />
          <path 
             d="M 72 22 L 77 10 L 60 19" 
             fill="#e0e7ff" 
           />

          {/* Face */}
          <g transform="translate(50, 48)">
            
            {/* Left Eye */}
            <g transform="translate(-16, 0)">
               <motion.path 
                 d={getEyePath('left')}
                 fill={state === PetState.DRAGGING ? "none" : "#1e1b4b"}
                 stroke="#1e1b4b"
                 strokeWidth={state === PetState.DRAGGING || state === PetState.SLEEPING || isBlinking ? "3" : "0"}
                 strokeLinecap="round"
               />
               {!isBlinking && state !== PetState.SLEEPING && state !== PetState.DRAGGING && (
                 <circle cx="2" cy="-3" r="2.5" fill="white" />
               )}
            </g>

            {/* Right Eye */}
            <g transform="translate(16, 0)">
                <motion.path 
                 d={getEyePath('right')}
                 fill={state === PetState.DRAGGING ? "none" : "#1e1b4b"}
                 stroke="#1e1b4b"
                 strokeWidth={state === PetState.DRAGGING || state === PetState.SLEEPING || isBlinking ? "3" : "0"}
                 strokeLinecap="round"
               />
               {!isBlinking && state !== PetState.SLEEPING && state !== PetState.DRAGGING && (
                 <circle cx="2" cy="-3" r="2.5" fill="white" />
               )}
            </g>

            {/* Cheeks */}
            <ellipse cx="-22" cy="8" rx="6" ry="3.5" fill="#fda4af" opacity="0.6" />
            <ellipse cx="22" cy="8" rx="6" ry="3.5" fill="#fda4af" opacity="0.6" />

            {/* Mouth */}
            <g transform="translate(0, 8)">
               <motion.path
                 d={getMouthPath()}
                 fill="none"
                 stroke="#1e1b4b"
                 strokeWidth="2.5"
                 strokeLinecap="round"
                 strokeLinejoin="round"
               />
            </g>
          </g>

          {/* Zzz particles */}
          {state === PetState.SLEEPING && (
            <motion.g
              initial={{ opacity: 0, x: 60, y: 10 }}
              animate={{ opacity: [0, 1, 0], x: 90, y: -40, scale: [0.5, 1.2] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <text x="0" y="0" fontSize="28" fontFamily="Fredoka" fill="#818cf8" fontWeight="bold">Zzz</text>
            </motion.g>
          )}

          {/* Thinking mark */}
          {state === PetState.THINKING && (
              <motion.g
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              transform="translate(80, 20)"
            >
              <text x="0" y="0" fontSize="32" fontFamily="Fredoka" fill="#818cf8" fontWeight="bold">?</text>
            </motion.g>
          )}

        </motion.g>
      </svg>
    </motion.div>
  );
};

export default PetCharacter;