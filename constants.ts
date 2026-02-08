
import { XPConfig, Skills, User, UserRole, SkillDefinition } from './types';

export const XP_CONFIG: XPConfig = {
  xpPerLevel: 1000,
  multiplier: 1.2
};

export const INITIAL_SKILLS: Skills = {
  serve: 1,
  receive: 1,
  attack: 1,
  block: 1,
  set: 1,
  stamina: 1
};

export const SKILL_LABELS: Record<keyof Skills, string> = {
  serve: 'Подача',
  receive: 'Прием',
  attack: 'Атака',
  block: 'Блок',
  set: 'Пас',
  stamina: 'Физо'
};

// Fix: Added INITIAL_SKILL_DEFINITIONS to match App.tsx imports
export const INITIAL_SKILL_DEFINITIONS: SkillDefinition[] = [
  { id: 'serve', label: 'Подача' },
  { id: 'receive', label: 'Прием' },
  { id: 'attack', label: 'Атака' },
  { id: 'block', label: 'Блок' },
  { id: 'set', label: 'Пас' },
  { id: 'stamina', label: 'Физо' }
];

export const MOCK_STUDENTS: User[] = [
  {
    id: '1',
    name: 'Артём Волков',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=artem',
    role: UserRole.STUDENT,
    level: 5,
    xp: 450,
    totalXp: 5450,
    city: 'Минск',
    branch: 'Центр',
    trainingsCompleted: 28,
    joinDate: '2023-09-15',
    streak: 4,
    skills: { serve: 12, receive: 10, attack: 15, block: 8, set: 7, stamina: 11 },
    achievements: ['ach_serve_1', 'ach_lvl_5'],
    trainingHistory: [
      { id: 't1', date: '2024-05-10', skillFocus: 'attack', xpEarned: 150 }
    ]
  },
  {
    id: '2',
    name: 'Марина Козлова',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marina',
    role: UserRole.STUDENT,
    level: 3,
    xp: 120,
    totalXp: 2120,
    city: 'Гомель',
    branch: 'Восток',
    trainingsCompleted: 14,
    joinDate: '2023-11-20',
    streak: 1,
    skills: { serve: 5, receive: 12, attack: 4, block: 3, set: 15, stamina: 9 },
    achievements: [],
    trainingHistory: []
  },
  {
    id: '3',
    name: 'Дмитрий Савицкий',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dima',
    role: UserRole.STUDENT,
    level: 4,
    xp: 800,
    totalXp: 4800,
    city: 'Брест',
    branch: 'Юг',
    trainingsCompleted: 21,
    joinDate: '2023-10-01',
    streak: 0,
    skills: { serve: 10, receive: 8, attack: 12, block: 14, set: 5, stamina: 10 },
    achievements: [],
    trainingHistory: []
  },
  {
    id: '4',
    name: 'Ольга Бондарь',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=olga',
    role: UserRole.STUDENT,
    level: 6,
    xp: 200,
    totalXp: 7200,
    city: 'Минск',
    branch: 'Уручье',
    trainingsCompleted: 42,
    joinDate: '2023-08-10',
    streak: 12,
    skills: { serve: 18, receive: 15, attack: 10, block: 5, set: 12, stamina: 14 },
    achievements: ['ach_train_10', 'ach_streak_7'],
    trainingHistory: []
  },
  {
    id: '7',
    name: 'Илья Кравченко',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ilya',
    role: UserRole.STUDENT,
    level: 5,
    xp: 150,
    totalXp: 5150,
    city: 'Минск',
    branch: 'Центр',
    trainingsCompleted: 26,
    joinDate: '2023-09-01',
    streak: 2,
    skills: { serve: 11, receive: 9, attack: 16, block: 7, set: 8, stamina: 13 },
    achievements: ['ach_lvl_5'],
    trainingHistory: []
  }
];

export const CITY_BRANCHES_MOCK: Record<string, string[]> = {
  'Минск': ['Центр', 'Уручье', 'Запад'],
  'Гомель': ['Восток', 'Север'],
  'Брест': ['Юг', 'Центр'],
  'Гродно': ['Замок', 'Лида-филиал']
};

export const CITIES = Object.keys(CITY_BRANCHES_MOCK).sort();
