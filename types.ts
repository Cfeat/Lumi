export enum PetState {
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  SLEEPING = 'SLEEPING',
  CHATTING = 'CHATTING',
  DRAGGING = 'DRAGGING',
  THINKING = 'THINKING'
}

export enum PetMood {
  HAPPY = 'HAPPY',
  NEUTRAL = 'NEUTRAL',
  EXCITED = 'EXCITED',
  TIRED = 'TIRED'
}

export type Language = 'en' | 'zh';

export interface Coordinates {
  x: number;
  y: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface PetConfig {
  name: string;
  color: string;
}