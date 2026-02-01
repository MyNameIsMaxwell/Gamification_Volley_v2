
import { XPConfig } from '../types';

export const getXpForNextLevel = (level: number, config: XPConfig): number => {
  return Math.floor(config.xpPerLevel * Math.pow(config.multiplier, level - 1));
};

export const calculateProgress = (xp: number, level: number, config: XPConfig): number => {
  const nextLevelXp = getXpForNextLevel(level, config);
  return Math.min(Math.floor((xp / nextLevelXp) * 100), 100);
};

export const addXp = (currentXp: number, currentLevel: number, amount: number, config: XPConfig) => {
  let newXp = currentXp + amount;
  let newLevel = currentLevel;
  
  while (newXp >= getXpForNextLevel(newLevel, config)) {
    newXp -= getXpForNextLevel(newLevel, config);
    newLevel++;
  }
  
  return { xp: newXp, level: newLevel };
};

export const getRankTitle = (level: number): string => {
  if (level <= 2) return 'Новичок';
  if (level <= 5) return 'Игрок основы';
  if (level <= 8) return 'Мастер площадки';
  return 'Легенда волейбола';
};
