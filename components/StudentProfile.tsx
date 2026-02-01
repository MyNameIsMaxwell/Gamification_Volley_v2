
import React from 'react';
import { User, Skills, AchievementCriteria, SkillDefinition, XPConfig } from '../types';
import SkillRadar from './SkillRadar';
import { calculateProgress, getXpForNextLevel, getRankTitle } from '../utils/levelLogic';
import { Award, Flame, Lock } from 'lucide-react';

interface StudentProfileProps {
  student: User;
  onBack: () => void;
  masterAchievements: AchievementCriteria[];
  skillDefinitions: SkillDefinition[];
  xpConfig: XPConfig;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, masterAchievements, skillDefinitions, xpConfig }) => {
  const getSkillLabel = (id: string) => {
    const def = skillDefinitions.find(d => d.id === id);
    if (def) return def.label;
    if (id === 'general') return 'Общий опыт';
    return id;
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 pb-12">
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-3">
          <img src={student.avatar} className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-lg" />
          {student.streak > 0 && (
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md">
               <div className="bg-[#ff3b30] text-white text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                 <Flame size={12} fill="currentColor" /> {student.streak}
               </div>
            </div>
          )}
        </div>
        <h2 className="text-[24px] font-bold tracking-tight">{student.name}</h2>
        <p className="text-[#8e8e93] text-[15px] font-medium">{getRankTitle(student.level)} • Уровень {student.level}</p>
      </div>

      <div className="ios-list-group">
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] font-semibold">Прогресс до Ур. {student.level + 1}</span>
            <span className="text-[13px] text-[#8e8e93] font-bold">{student.xp} / {getXpForNextLevel(student.level, xpConfig)}</span>
          </div>
          <div className="w-full bg-[#efeff4] h-2 rounded-full overflow-hidden">
            <div className="bg-[#007aff] h-full" style={{ width: `${calculateProgress(student.xp, student.level, xpConfig)}%` }} />
          </div>
        </div>
      </div>

      <div className="ios-section-title">Диаграмма навыков</div>
      <div className="mx-4 mb-6"><SkillRadar skills={student.skills} definitions={skillDefinitions} /></div>

      <div className="ios-section-title">Награды</div>
      <div className="px-4 mb-6 grid grid-cols-2 gap-3">
        {masterAchievements.map((ach) => {
          const isUnlocked = student.achievements.includes(ach.id);
          return (
            <div key={ach.id} className={`bg-white p-3 rounded-2xl border border-[#c6c6c8]/30 shadow-sm flex flex-col items-center text-center ${!isUnlocked ? 'opacity-40 grayscale' : 'active-scale'}`}>
              <div className="w-16 h-16 mb-2 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                 {isUnlocked ? (ach.imageUrl ? <img src={ach.imageUrl} className="w-full h-full object-cover" /> : <Award size={32} className="text-[#ff9500]"/>) : <Lock size={20} className="text-[#8e8e93]"/>}
              </div>
              <p className="text-[12px] font-bold leading-tight">{ach.title}</p>
              {!isUnlocked && <p className="text-[9px] text-[#8e8e93] mt-1">Заблокировано</p>}
            </div>
          );
        })}
      </div>

      <div className="ios-section-title">Последние достижения</div>
      <div className="ios-list-group">
        {student.trainingHistory?.map((rec) => (
          <div key={rec.id} className="ios-list-item">
            <div><p className="text-[16px] font-medium">{getSkillLabel(rec.skillFocus)}</p><p className="text-[11px] text-[#8e8e93]">{new Date(rec.date).toLocaleDateString()}</p></div>
            <span className="text-[#4cd964] font-bold">+{rec.xpEarned} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentProfile;
