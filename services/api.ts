import { User, AchievementCriteria, SkillDefinition, QRCodeDefinition, XPConfig, XpHistoryEntry } from '../types';

const API_BASE = '/api';

// Get Telegram initData
function getTelegramInitData(): string | null {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) {
    // Development mode: return null, server will use mock user
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return null;
    }
    return null;
  }
  return tg.initData || null;
}

// Helper for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const initData = getTelegramInitData();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add Telegram initData to headers if available
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401/403 specifically
    if (response.status === 401) {
      const error = await response.json().catch(() => ({ error: 'Authentication required' }));
      throw new Error(error.error || 'Необходима авторизация через Telegram');
    }
    if (response.status === 403) {
      const error = await response.json().catch(() => ({ error: 'Insufficient permissions' }));
      throw new Error(error.error || 'Недостаточно прав доступа');
    }
    
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Get Telegram user data (or mock for local testing)
function getTelegramUser() {
  const tg = (window as any).Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  
  // If no Telegram user, use mock for local testing only
  if (!user && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return {
      id: 123456789,
      first_name: 'Тест',
      last_name: 'Пользователь',
      username: 'testuser'
    };
  }
  
  return user || null;
}

// ============ Users API ============

export async function getCurrentUser(): Promise<User | null> {
  const tgUser = getTelegramUser();
  if (!tgUser) {
    // In production, require Telegram
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      throw new Error('Откройте приложение через Telegram');
    }
    return null;
  }

  try {
    return await apiCall<User>('/users/me');
  } catch (error: any) {
    // User not found, register
    if (error.message?.includes('not found')) {
      return registerUser();
    }
    throw error;
  }
}

export async function registerUser(): Promise<User | null> {
  const tgUser = getTelegramUser();
  if (!tgUser) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      throw new Error('Откройте приложение через Telegram');
    }
    return null;
  }

  return apiCall<User>('/users/register', {
    method: 'POST',
    body: JSON.stringify({
      name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Player',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${tgUser.id}`,
    }),
  });
}

export async function getAllUsers(): Promise<User[]> {
  return apiCall<User[]>('/users');
}

export async function getUserById(id: string): Promise<User> {
  return apiCall<User>(`/users/${id}`);
}

export async function awardXp(
  userId: string,
  xpAmount: number,
  skillId?: string,
  reason?: string
): Promise<{ user: User; xpAwarded: number; weekendBonus: boolean; newAchievements: AchievementCriteria[] }> {
  return apiCall('/users/award-xp', {
    method: 'POST',
    body: JSON.stringify({ userId, xpAmount, skillId, reason }),
  });
}

export async function deductXp(
  userId: string,
  xpAmount: number,
  skillId?: string,
  reason?: string
): Promise<{ user: User; xpDeducted: number; newAchievements: AchievementCriteria[] }> {
  return apiCall('/users/deduct-xp', {
    method: 'POST',
    body: JSON.stringify({ userId, xpAmount, skillId, reason }),
  });
}

export async function getXpHistory(userId: string): Promise<XpHistoryEntry[]> {
  return apiCall<XpHistoryEntry[]>(`/users/${userId}/xp-history`);
}

export async function getZoneStudents(): Promise<User[]> {
  return apiCall<User[]>('/users/zone/students');
}

export async function updateTrainerAssignment(
  userId: string,
  assignedCity: string | null,
  assignedBranch: string | null
): Promise<User> {
  return apiCall(`/users/${userId}/assignment`, {
    method: 'PUT',
    body: JSON.stringify({ assignedCity, assignedBranch }),
  });
}

export interface TrainingSkill {
  skillId: string;
  xpAmount: number;
}

export async function logTraining(
  userId: string,
  skills: TrainingSkill[],
  isPreset?: boolean,
  presetName?: string
): Promise<{ user: User; totalXpAwarded: number; weekendBonus: boolean; newAchievements: AchievementCriteria[] }> {
  return apiCall('/users/log-training', {
    method: 'POST',
    body: JSON.stringify({ userId, skills, isPreset, presetName }),
  });
}

export async function scanQR(
  qrId: string
): Promise<{ user: User; qr: any; xpAwarded: number; weekendBonus: boolean; newAchievements: AchievementCriteria[] }> {
  return apiCall('/users/scan-qr', {
    method: 'POST',
    body: JSON.stringify({ qrId }),
  });
}

export async function updateUserRole(userId: string, role: string): Promise<User> {
  return apiCall(`/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export interface ProfileUpdate {
  name?: string;
  avatar?: string;
  city?: string;
  branch?: string;
}

export async function updateUserProfile(userId: string, profile: ProfileUpdate): Promise<User> {
  return apiCall(`/users/${userId}/profile`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export interface StatsUpdate {
  xp?: number;
  totalXp?: number;
  level?: number;
  trainingsCompleted?: number;
  streak?: number;
}

export async function updateUserStats(userId: string, stats: StatsUpdate): Promise<User> {
  return apiCall(`/users/${userId}/stats`, {
    method: 'PUT',
    body: JSON.stringify(stats),
  });
}

export async function grantAchievement(userId: string, achievementId: string): Promise<void> {
  await apiCall(`/users/${userId}/achievements/${achievementId}`, {
    method: 'POST',
  });
}

export async function revokeAchievement(userId: string, achievementId: string): Promise<void> {
  await apiCall(`/users/${userId}/achievements/${achievementId}`, {
    method: 'DELETE',
  });
}

export async function recalculateSkills(userId: string): Promise<{ user: User; recalculatedSkills: Record<string, number>; newAchievements: { id: string; title: string }[] }> {
  return apiCall(`/users/${userId}/recalculate-skills`, {
    method: 'POST',
  });
}

// ============ Rankings API ============

export interface RankingPlayer {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  level: number;
  totalXp: number;
  city: string;
  branch: string;
  streak: number;
}

export interface RankingBranch {
  rank: number;
  city: string;
  branch: string;
  studentCount: number;
  totalXp: number;
  avgXp: number;
}

export interface RankingCity {
  rank: number;
  city: string;
  studentCount: number;
  branchCount: number;
  totalXp: number;
  avgXp: number;
}

export async function getPlayersRanking(city?: string, branch?: string): Promise<RankingPlayer[]> {
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (branch) params.set('branch', branch);
  const query = params.toString() ? `?${params}` : '';
  return apiCall<RankingPlayer[]>(`/rankings/players${query}`);
}

export async function getBranchesRanking(city?: string): Promise<RankingBranch[]> {
  const query = city ? `?city=${city}` : '';
  return apiCall<RankingBranch[]>(`/rankings/branches${query}`);
}

export async function getCitiesRanking(): Promise<RankingCity[]> {
  return apiCall<RankingCity[]>('/rankings/cities');
}

// ============ Achievements API ============

export async function getAchievements(): Promise<AchievementCriteria[]> {
  return apiCall<AchievementCriteria[]>('/achievements');
}

export async function createAchievement(achievement: Omit<AchievementCriteria, 'id'>): Promise<AchievementCriteria> {
  return apiCall('/achievements', {
    method: 'POST',
    body: JSON.stringify(achievement),
  });
}

export async function updateAchievement(id: string, achievement: Partial<AchievementCriteria>): Promise<AchievementCriteria> {
  return apiCall(`/achievements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(achievement),
  });
}

export async function deleteAchievement(id: string): Promise<void> {
  await apiCall(`/achievements/${id}`, { method: 'DELETE' });
}

// ============ QR Codes API ============

export async function getQRCodes(): Promise<QRCodeDefinition[]> {
  return apiCall<QRCodeDefinition[]>('/qrcodes');
}

export async function createQRCode(qr: Omit<QRCodeDefinition, 'id' | 'createdAt' | 'usesCount'>): Promise<QRCodeDefinition> {
  return apiCall('/qrcodes', {
    method: 'POST',
    body: JSON.stringify(qr),
  });
}

export async function getQRCodeById(id: string): Promise<QRCodeDefinition & { stats: { totalScans: number; uniqueUsers: number; totalXpAwarded: number } }> {
  return apiCall(`/qrcodes/${id}`);
}

export async function deleteQRCode(id: string): Promise<void> {
  await apiCall(`/qrcodes/${id}`, { method: 'DELETE' });
}

// ============ Skills API ============

export async function getSkills(): Promise<SkillDefinition[]> {
  return apiCall<(SkillDefinition & { enabled: boolean })[]>('/skills');
}

export async function getEnabledSkills(): Promise<SkillDefinition[]> {
  return apiCall<SkillDefinition[]>('/skills/enabled');
}

export async function createSkill(label: string): Promise<SkillDefinition> {
  return apiCall('/skills', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export async function toggleSkill(id: string): Promise<SkillDefinition & { enabled: boolean }> {
  return apiCall(`/skills/${id}/toggle`, { method: 'PUT' });
}

// ============ Locations API ============

export async function getLocations(): Promise<Record<string, string[]>> {
  return apiCall<Record<string, string[]>>('/locations');
}

export async function addCity(name: string): Promise<void> {
  await apiCall('/locations/cities', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function removeCity(name: string): Promise<void> {
  await apiCall(`/locations/cities/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function addBranch(city: string, name: string): Promise<void> {
  await apiCall('/locations/branches', {
    method: 'POST',
    body: JSON.stringify({ city, name }),
  });
}

export async function removeBranch(city: string, name: string): Promise<void> {
  await apiCall('/locations/branches', {
    method: 'DELETE',
    body: JSON.stringify({ city, name }),
  });
}

// ============ Settings API ============

export async function getXpSettings(): Promise<XPConfig> {
  return apiCall<XPConfig>('/settings/xp');
}

export async function updateXpSettings(settings: Partial<XPConfig>): Promise<XPConfig> {
  return apiCall('/settings/xp', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
