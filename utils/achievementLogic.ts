
import { User, AchievementCriteria } from '../types';

export const checkAchievementUnlock = (user: User, achievement: AchievementCriteria): boolean => {
  const { conditions } = achievement;
  
  if (conditions.minLevel && user.level < conditions.minLevel) return false;
  if (conditions.minTrainings && user.trainingsCompleted < conditions.minTrainings) return false;
  if (conditions.minStreak && user.streak < conditions.minStreak) return false;
  if (conditions.minTotalXp && user.totalXp < conditions.minTotalXp) return false;
  
  if (conditions.minSkillValue) {
    const userSkillValue = user.skills[conditions.minSkillValue.skill];
    if (userSkillValue < conditions.minSkillValue.value) return false;
  }

  return true;
};

export const getNewUnlockedAchievements = (user: User, allAchievements: AchievementCriteria[]): string[] => {
  return allAchievements
    .filter(ach => !user.achievements.includes(ach.id))
    .filter(ach => checkAchievementUnlock(user, ach))
    .map(ach => ach.id);
};
