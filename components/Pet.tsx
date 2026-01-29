import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import PetCharacter from './PetCharacter';
import ChatBubble from './ChatBubble';
import { PetState, PetMood, Coordinates } from '../types';

interface PetProps {
  currentMessage: string | null;
  isThinking: boolean;
  onPositionChange?: (pos: Coordinates) => void;
  onInteract: () => void;
}

const MOVEMENT_INTERVAL = 5000; // Time between random movements
const PET_SIZE = 120;

const Pet: React.FC<PetProps> = ({ currentMessage, isThinking, onPositionChange, onInteract }) => {
  // State
  const [position, setPosition] = useState<Coordinates>({ 
    x: window.innerWidth / 2 - PET_SIZE/2, 
    y: window.innerHeight / 2 - PET_SIZE/2 
  });
  const [petState, setPetState] = useState<PetState>(PetState.IDLE);
  const [mood, setMood] = useState<PetMood>(PetMood.HAPPY);
  const [isFacingLeft, setIsFacingLeft] = useState(false);
  
  const controls = useAnimationControls();
  const timerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Screen boundaries
  const getBounds = () => ({
    width: window.innerWidth - PET_SIZE,
    height: window.innerHeight - PET_SIZE
  });

  // Random movement logic
  const wander = useCallback(() => {
    if (isDraggingRef.current || isThinking || currentMessage) return;

    // 30% chance to sleep, 30% chance to stay idle, 40% chance to walk
    const choice = Math.random();

    if (choice < 0.3) {
      setPetState(PetState.SLEEPING);
    } else if (choice < 0.6) {
      setPetState(PetState.IDLE);
    } else {
      setPetState(PetState.WALKING);
      
      const bounds = getBounds();
      const targetX = Math.random() * bounds.width;
      const targetY = Math.random() * bounds.height;
      
      setIsFacingLeft(targetX < position.x);

      // Animate movement
      controls.start({
        x: targetX,
        y: targetY,
        transition: { duration: 2 + Math.random() * 2, ease: "easeInOut" } // 2-4 seconds walk
      }).then(() => {
        setPosition({ x: targetX, y: targetY });
        setPetState(PetState.IDLE);
      });
    }
  }, [position, isThinking, currentMessage, controls]);

  // Effect loop for behavior
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Set new timer
    timerRef.current = setInterval(wander, MOVEMENT_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [wander]);

  // Reaction to thinking/chatting
  useEffect(() => {
    if (isThinking) {
      setPetState(PetState.THINKING);
      controls.stop(); // Stop moving if thinking
    } else if (currentMessage) {
      setPetState(PetState.CHATTING);
      controls.stop();
      setMood(PetMood.EXCITED);
    } else if (petState === PetState.THINKING || petState === PetState.CHATTING) {
      setPetState(PetState.IDLE);
    }
  }, [isThinking, currentMessage]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    setPetState(PetState.DRAGGING);
    controls.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleDragEnd = (event: any, info: any) => {
    isDraggingRef.current = false;
    // Update internal position state based on where drag ended
    // We use the point relative to the viewport
    const newX = position.x + info.offset.x;
    const newY = position.y + info.offset.y;
    
    // Clamp to screen
    const bounds = getBounds();
    const clampedX = Math.max(0, Math.min(newX, bounds.width));
    const clampedY = Math.max(0, Math.min(newY, bounds.height));

    setPosition({ x: clampedX, y: clampedY });
    // Reset visual transform offset because we updated absolute position
    // Framer motion drag offset needs reset logic usually, but here we can just snap.
    // However, to keep it simple with framer motion layout:
    
    setPetState(PetState.IDLE);
    // Restart wander loop
    timerRef.current = setInterval(wander, MOVEMENT_INTERVAL);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      animate={controls}
      // Initial position
      style={{ x: position.x, y: position.y, position: 'absolute', cursor: 'grab' }}
      whileTap={{ cursor: 'grabbing' }}
      onClick={onInteract}
      className="z-40"
    >
      <div className="relative">
        <ChatBubble message={currentMessage} isThinking={isThinking} />
        <PetCharacter 
          state={petState} 
          mood={mood} 
          color="#a5b4fc" 
          isFacingLeft={isFacingLeft} 
        />
      </div>
    </motion.div>
  );
};

export default Pet;