
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

// ============ Skill Level System ============

// XP thresholds for skill levels (cumulative)
// Level 1: 0-49 XP, Level 2: 50-149 XP, Level 3: 150-299 XP, etc.
const SKILL_LEVEL_THRESHOLDS = [
  0,      // Level 1: 0 XP
  50,     // Level 2: 50 XP
  150,    // Level 3: 150 XP
  300,    // Level 4: 300 XP
  500,    // Level 5: 500 XP
  750,    // Level 6: 750 XP
  1050,   // Level 7: 1050 XP
  1400,   // Level 8: 1400 XP
  1800,   // Level 9: 1800 XP
  2250,   // Level 10: 2250 XP (max)
];

const SKILL_RANK_TITLES = [
  'Новичок',           // Level 1
  'Ученик',            // Level 2
  'Практик',           // Level 3
  'Опытный',           // Level 4
  'Умелый',            // Level 5
  'Мастер',            // Level 6
  'Эксперт',           // Level 7
  'Виртуоз',           // Level 8
  'Гуру',              // Level 9
  'Легенда',           // Level 10
];

export interface SkillLevelInfo {
  level: number;           // Current skill level (1-10)
  currentXp: number;       // Total XP in this skill
  xpInCurrentLevel: number; // XP earned since last level
  xpForNextLevel: number;  // XP needed for next level
  progress: number;        // Progress percentage to next level (0-100)
  rankTitle: string;       // Title for this skill level
  isMaxLevel: boolean;     // Whether at max level
}

export const getSkillLevelInfo = (totalXp: number): SkillLevelInfo => {
  // Find current level based on XP
  let level = 1;
  for (let i = SKILL_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= SKILL_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const isMaxLevel = level >= SKILL_LEVEL_THRESHOLDS.length;
  const currentLevelThreshold = SKILL_LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelThreshold = SKILL_LEVEL_THRESHOLDS[level] || SKILL_LEVEL_THRESHOLDS[SKILL_LEVEL_THRESHOLDS.length - 1];
  
  const xpInCurrentLevel = totalXp - currentLevelThreshold;
  const xpForNextLevel = nextLevelThreshold - currentLevelThreshold;
  const progress = isMaxLevel ? 100 : Math.min(Math.floor((xpInCurrentLevel / xpForNextLevel) * 100), 100);
  const rankTitle = SKILL_RANK_TITLES[Math.min(level - 1, SKILL_RANK_TITLES.length - 1)];

  return {
    level,
    currentXp: totalXp,
    xpInCurrentLevel,
    xpForNextLevel,
    progress,
    rankTitle,
    isMaxLevel,
  };
};

export const getSkillLevelThresholds = () => SKILL_LEVEL_THRESHOLDS;
export const getSkillMaxLevel = () => SKILL_LEVEL_THRESHOLDS.length;