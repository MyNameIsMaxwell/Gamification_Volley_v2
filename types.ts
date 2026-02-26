
export enum UserRole {
  STUDENT = 'STUDENT',
  TRAINER = 'TRAINER',
  ADMIN = 'ADMIN'
}

export type Skills = Record<string, number>;

export interface SkillDefinition {
  id: string;
  label: string;
}

export interface TrainingRecord {
  id: string;
  date: string;
  skillFocus: string; // ID навыка или 'general'
  xpEarned: number;
  source?: 'manual' | 'qr';
  qrId?: string;
}

export interface QRSkill {
  skillId: string;
  xpAmount: number;
}

export interface QRCodeDefinition {
  id: string;
  title: string;
  branch: string;
  city: string;
  xpAmount: number;
  skillId?: string; // Если пусто, то общий опыт (legacy)
  skills?: QRSkill[]; // Несколько навыков для пресетов тренировок
  achievementId?: string; // Опционально: разблокировка ачивки
  isTrainingPreset?: boolean; // QR для тренировки
  maxUses?: number; // Максимальное количество сканирований
  usesCount?: number; // Текущее количество сканирований
  createdAt: string;
  expiresAt?: string;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
  level: number;
  xp: number;
  totalXp: number;
  skills: Skills;
  achievements: string[]; 
  city: string;
  branch: string; 
  trainingsCompleted: number;
  joinDate: string;
  trainingHistory?: TrainingRecord[];
  streak: number;
  lastTrainingDate?: string;
  lastQRScanDate?: string; // Дата последнего сканирования для лимита 1 раз в день
  assignedCity?: string | null; // Закрепленный город для тренера
  assignedBranch?: string | null; // Закрепленный филиал для тренера
}

export interface XpHistoryEntry {
  id: number;
  date: string;
  skillFocus: string;
  xpEarned: number;
  source: string; // 'xp_bonus' | 'xp_deduction' | 'training' | 'preset' | 'qr' | 'manual'
  qrId?: string;
  operatorId?: number;
  operatorName?: string;
  reason?: string;
  createdAt: string;
}

export interface AchievementConditions {
  minLevel?: number;
  minTrainings?: number;
  minSkillValue?: {
    skill: string; 
    value: number;
  };
  minStreak?: number;
  minTotalXp?: number;
}

export interface AchievementCriteria {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  conditions: AchievementConditions;
}

export interface XPConfig {
  xpPerLevel: number;
  multiplier: number;
}
