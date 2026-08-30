import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import PetCharacter, { FXSignal } from './PetCharacter';
import ChatBubble from './ChatBubble';
import { PetState, PetMood, Coordinates, BehaviorAction } from '../types';

interface PetProps {
  currentMessage: string | null;
  isThinking: boolean;
  stats: PetStatsLike | null;
  /** one-shot behavior action from the engine: {action, id} */
  actionSignal: { action: BehaviorAction; id: number } | null;
  onPetted: () => void;
  onDoublePetted: () => void;
  onDragged: () => void;
}

interface PetStatsLike {
  hunger: number;
  mood: number;
  energy: number;
}

const PET_SIZE = 150;
const EDGE = 12;

/** Map a BehaviorAction to a temporary pet state + face mood */
const ACTION_STATE: Record<string, { state: PetState; mood?: PetMood; fx?: FXSignal['type']; ms: number }> = {
  eat: { state: PetState.EATING, mood: PetMood.HAPPY, fx: 'none', ms: 2200 },
  play: { state: PetState.PLAYING, mood: PetMood.EXCITED, fx: 'sparkles', ms: 2400 },
  cheer: { state: PetState.CHEERING, mood: PetMood.EXCITED, fx: 'sparkles', ms: 1800 },
  dizzy: { state: PetState.DIZZY, mood: PetMood.NEUTRAL, fx: 'none', ms: 1600 },
  greet: { state: PetState.CHEERING, mood: PetMood.HAPPY, fx: 'sparkles', ms: 1400 },
  shiver: { state: PetState.DIZZY, mood: PetMood.NEUTRAL, fx: 'none', ms: 1200 },
  wake: { state: PetState.CHEERING, mood: PetMood.HAPPY, fx: 'none', ms: 900 },
  sleep: { state: PetState.SLEEPING, mood: PetMood.SLEEPY, fx: 'none', ms: 0 },
};

function deriveMoodLocal(stats: PetStatsLike | null): PetMood {
  if (!stats) return PetMood.HAPPY;
  if (stats.energy < 25) return PetMood.SLEEPY;
  if (stats.hunger < 25) return PetMood.SAD;
  if (stats.mood > 80) return PetMood.HAPPY;
  if (stats.energy < 45) return PetMood.TIRED;
  return PetMood.NEUTRAL;
}

const Pet: React.FC<PetProps> = ({
  currentMessage, isThinking, stats, actionSignal, onPetted, onDoublePetted, onDragged,
}) => {
  const [position, setPosition] = useState<Coordinates>(() => ({
    x: window.innerWidth - PET_SIZE - 80,
    y: window.innerHeight - PET_SIZE - 60,
  }));
  const [petState, setPetState] = useState<PetState>(PetState.IDLE);
  const [isFacingLeft, setIsFacingLeft] = useState(false);
  const [fx, setFx] = useState<FXSignal>({ type: 'none', id: 0 });

  const controls = useAnimationControls();
  const wanderTimer = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const asleepRef = useRef(false);
  const walkingRef = useRef(false);
  const actionUntilRef = useRef(0);
  const actionStateRef = useRef<PetState | null>(null);
  const actionMoodRef = useRef<PetMood | null>(null);
  const fxIdRef = useRef(0);

  const getBounds = () => ({
    maxX: window.innerWidth - PET_SIZE - EDGE,
    maxY: window.innerHeight - PET_SIZE - EDGE,
  });

  const triggerFx = (type: FXSignal['type']) => {
    if (type === 'none') return;
    fxIdRef.current += 1;
    setFx({ type, id: fxIdRef.current });
  };

  /* ---------------- one-shot actions from the behavior engine ---------------- */

  useEffect(() => {
    if (!actionSignal) return;
    const { action } = actionSignal;

    if (action === 'sleep') {
      asleepRef.current = true;
      walkingRef.current = false;
      controls.stop();
      setPetState(PetState.SLEEPING);
      return;
    }
    if (action === 'wake') {
      asleepRef.current = false;
      // brief happy bounce handled below via ACTION_STATE
    }

    const conf = ACTION_STATE[action];
    if (!conf) return;

    if (action !== 'sleep') asleepRef.current = false;
    actionStateRef.current = conf.state;
    actionMoodRef.current = conf.mood ?? null;
    actionUntilRef.current = Date.now() + conf.ms;
    triggerFx(conf.fx ?? 'none');
    setPetState(conf.state);

    if (conf.ms > 0) {
      window.setTimeout(() => {
        if (Date.now() >= actionUntilRef.current - 10) {
          actionStateRef.current = null;
          actionMoodRef.current = null;
          if (!isThinking && !currentMessage && !asleepRef.current && !walkingRef.current) {
            setPetState(PetState.IDLE);
          }
        }
      }, conf.ms + 20);
    }
  }, [actionSignal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- reaction to thinking / chatting ---------------- */

  useEffect(() => {
    if (isThinking) {
      walkingRef.current = false;
      controls.stop();
      setPetState(PetState.THINKING);
    } else if (currentMessage) {
      walkingRef.current = false;
      controls.stop();
      setPetState((s) => (s === PetState.SLEEPING || actionStateRef.current ? s : PetState.CHATTING));
    } else if (petState === PetState.THINKING || petState === PetState.CHATTING) {
      if (!asleepRef.current && !actionStateRef.current) setPetState(PetState.IDLE);
    }
  }, [isThinking, currentMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- wander ---------------- */

  const wander = useCallback(() => {
    if (isDraggingRef.current || isThinking || currentMessage || asleepRef.current) return;
    if (actionStateRef.current && Date.now() < actionUntilRef.current) return;
    if (document.hidden) return;

    const roll = Math.random();
    if (roll < 0.34) {
      // stroll within the comfort zone: lower half + side edges, away from center work area
      const { maxX, maxY } = getBounds();
      const comfortTop = window.innerHeight * 0.42;
      const preferEdge = Math.random() < 0.5;
      const targetX = preferEdge
        ? (Math.random() < 0.5 ? EDGE + Math.random() * 60 : maxX - Math.random() * 60)
        : EDGE + Math.random() * maxX;
      const targetY = comfortTop + Math.random() * Math.max(1, maxY - comfortTop);

      setIsFacingLeft(targetX < position.x);
      walkingRef.current = true;
      setPetState(PetState.WALKING);
      controls.start({
        x: targetX,
        y: targetY,
        transition: { duration: 1.6 + Math.random() * 1.8, ease: 'easeInOut' },
      }).then(() => {
        walkingRef.current = false;
        setPosition({ x: targetX, y: targetY });
        if (!asleepRef.current && !actionStateRef.current && !currentMessage && !isThinking) {
          setPetState(PetState.IDLE);
        }
      });
    } else if (roll < 0.42) {
      // quick nap
      setPetState(PetState.SLEEPING);
      window.setTimeout(() => {
        if (petStateRef.current === PetState.SLEEPING && !asleepRef.current) {
          setPetState(PetState.IDLE);
        }
      }, 4000 + Math.random() * 4000);
    }
    // otherwise stay idle
  }, [position.x, isThinking, currentMessage, controls]);

  const petStateRef = useRef<PetState>(petState);
  petStateRef.current = petState;

  useEffect(() => {
    if (wanderTimer.current) clearInterval(wanderTimer.current);
    wanderTimer.current = window.setInterval(wander, 4500 + Math.random() * 2500);
    return () => {
      if (wanderTimer.current) clearInterval(wanderTimer.current);
    };
  }, [wander]);

  /* ---------------- dragging ---------------- */

  const handleDragStart = () => {
    isDraggingRef.current = true;
    walkingRef.current = false;
    controls.stop();
    setPetState(PetState.DRAGGING);
    if (wanderTimer.current) clearInterval(wanderTimer.current);
  };

  const handleDragEnd = (_e: any, info: any) => {
    isDraggingRef.current = false;
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;
    const { maxX, maxY } = getBounds();
    const clamped = {
      x: Math.max(EDGE, Math.min(newX, maxX)),
      y: Math.max(EDGE, Math.min(newY, maxY)),
    };
    setPosition(clamped);
    // snap the motion transform to the new anchor
    controls.set({ x: clamped.x, y: clamped.y });
    actionStateRef.current = null;
    asleepRef.current = false;
    setPetState(PetState.IDLE);
    onDragged();
    wanderTimer.current = window.setInterval(wander, 4500 + Math.random() * 2500);
  };

  const handleClick = () => {
    if (asleepRef.current) {
      // waking the pet by clicking
      asleepRef.current = false;
      setPetState(PetState.IDLE);
    }
    triggerFx('hearts');
    onPetted();
  };

  /* ---------------- face mood ---------------- */

  const mood = actionMoodRef.current ?? deriveMoodLocal(stats);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.2}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ x: position.x, y: position.y }}
      style={{ position: 'absolute', left: 0, top: 0, cursor: 'grab', zIndex: 40 }}
      whileTap={{ cursor: 'grabbing' }}
      onClick={handleClick}
      onDoubleClick={onDoublePetted}
      data-lumi-interactive="true"
      className="lumi-pet"
    >
      <div className="relative">
        <ChatBubble message={currentMessage} isThinking={isThinking} />
        <PetCharacter
          state={petState}
          mood={mood}
          color="#a5b4fc"
          isFacingLeft={isFacingLeft}
          fx={fx}
        />
      </div>
    </motion.div>
  );
};

export default Pet;
