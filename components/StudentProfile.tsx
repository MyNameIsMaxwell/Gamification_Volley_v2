
import React, { useState } from 'react';
import { User, Skills, AchievementCriteria, SkillDefinition, XPConfig } from '../types';
import SkillRadar from './SkillRadar';
import { calculateProgress, getXpForNextLevel, getRankTitle, getSkillLevelInfo } from '../utils/levelLogic';
import { Award, Flame, Lock, Edit2, X, MapPin, Check, Info, Calendar, Zap, Target } from 'lucide-react';

// Avatar seeds for gallery
const AVATAR_SEEDS = [
  'felix', 'aneka', 'jade', 'milo', 'nala', 'oscar', 'pepper', 'rocky', 
  'shadow', 'tiger', 'whiskers', 'zoe', 'max', 'bella', 'charlie', 'luna',
  'cooper', 'daisy', 'buddy', 'sadie', 'jack', 'molly', 'duke', 'maggie'
];

interface StudentProfileProps {
  student: User;
  onBack: () => void;
  masterAchievements: AchievementCriteria[];
  skillDefinitions: SkillDefinition[];
  xpConfig: XPConfig;
  cityBranches?: Record<string, string[]>;
  onUpdateProfile?: (profile: { name?: string; avatar?: string; city?: string; branch?: string }) => Promise<void>;
  isOwnProfile?: boolean;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ 
  student, masterAchievements, skillDefinitions, xpConfig, 
  cityBranches = {}, onUpdateProfile, isOwnProfile = false 
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementCriteria | null>(null);
  const [editForm, setEditForm] = useState({
    name: student.name,
    avatar: student.avatar || '',
    city: student.city,
    branch: student.branch
  });
  const [saving, setSaving] = useState(false);

  const getSkillLabel = (id: string) => {
    const def = skillDefinitions.find(d => d.id === id);
    if (def) return def.label;
    if (id === 'general') return 'Общий опыт';
    return id;
  };

  const handleSaveProfile = async () => {
    if (!onUpdateProfile) return;
    setSaving(true);
    try {
      await onUpdateProfile(editForm);
      setShowEditModal(false);
    } catch (err) {
      console.error('Save profile error:', err);
      alert('Ошибка сохранения профиля');
    } finally {
      setSaving(false);
    }
  };

  const getAvatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 pb-12">
      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[20px] font-bold text-[#1a1a1a]">Редактировать профиль</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 text-[#6b7280]">
                <X size={24} />
              </button>
            </div>

            {/* Name */}
            <div className="mb-6">
              <label className="text-[12px] font-bold text-[#6b7280] uppercase mb-2 block">Имя</label>
              <input 
                type="text"
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                className="w-full bg-[#f2f2f7] p-4 rounded-2xl text-[#1a1a1a] outline-none"
                placeholder="Ваше имя"
              />
            </div>

            {/* Avatar Gallery */}
            <div className="mb-6">
              <label className="text-[12px] font-bold text-[#6b7280] uppercase mb-2 block">Аватар</label>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_SEEDS.map(seed => {
                  const url = getAvatarUrl(seed);
                  const isSelected = editForm.avatar === url;
                  return (
                    <button
                      key={seed}
                      onClick={() => setEditForm({...editForm, avatar: url})}
                      className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-[#007aff] scale-110 shadow-lg' : 'border-transparent'}`}
                    >
                      <img src={url} alt={seed} className="w-full h-full object-cover bg-gray-100" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City & Branch */}
            {Object.keys(cityBranches).length > 0 && (
              <>
                <div className="mb-4">
                  <label className="text-[12px] font-bold text-[#6b7280] uppercase mb-2 block">Город</label>
                  <select 
                    value={editForm.city}
                    onChange={e => setEditForm({...editForm, city: e.target.value, branch: cityBranches[e.target.value]?.[0] || ''})}
                    className="w-full bg-[#f2f2f7] p-4 rounded-2xl text-[#007aff] font-bold outline-none"
                  >
                    {Object.keys(cityBranches).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-6">
                  <label className="text-[12px] font-bold text-[#6b7280] uppercase mb-2 block">Филиал</label>
                  <select 
                    value={editForm.branch}
                    onChange={e => setEditForm({...editForm, branch: e.target.value})}
                    className="w-full bg-[#f2f2f7] p-4 rounded-2xl text-[#007aff] font-bold outline-none"
                  >
                    {(cityBranches[editForm.city] || []).map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-[#007aff] text-white py-4 rounded-2xl font-bold active-scale disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center py-6">
        <div className="relative mb-3">
          <img src={student.avatar} className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-lg bg-gray-100" />
          {student.streak > 0 && (
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md">
               <div className="bg-[#ff3b30] text-white text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                 <Flame size={12} fill="currentColor" /> {student.streak}
               </div>
            </div>
          )}
          {isOwnProfile && onUpdateProfile && (
            <button 
              onClick={() => setShowEditModal(true)}
              className="absolute -top-1 -right-1 bg-[#007aff] text-white p-1.5 rounded-full shadow-md"
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>
        <h2 className="text-[24px] font-bold tracking-tight text-[#1a1a1a]">{student.name}</h2>
        <p className="text-[#6b7280] text-[15px] font-medium">{getRankTitle(student.level)} • Уровень {student.level}</p>
        <p className="text-[#8e8e93] text-[12px] mt-1 flex items-center gap-1">
          <MapPin size={12} /> {student.city} • {student.branch}
        </p>
      </div>

      <div className="ios-list-group">
        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] font-semibold text-[#1a1a1a]">Прогресс до Ур. {student.level + 1}</span>
            <span className="text-[13px] text-[#6b7280] font-bold">{student.xp} / {getXpForNextLevel(student.level, xpConfig)}</span>
          </div>
          <div className="w-full bg-[#efeff4] h-2 rounded-full overflow-hidden">
            <div className="bg-[#007aff] h-full" style={{ width: `${calculateProgress(student.xp, student.level, xpConfig)}%` }} />
          </div>
        </div>
      </div>

      <div className="ios-section-title">Диаграмма навыков</div>
      <div className="mx-4 mb-4"><SkillRadar skills={student.skills} definitions={skillDefinitions} /></div>
      
      {/* Skill Levels Grid */}
      <div className="mx-4 mb-6 grid grid-cols-3 gap-2">
        {skillDefinitions.map(def => {
          const skillXp = student.skills[def.id] || 0;
          const info = getSkillLevelInfo(skillXp);
          
          const levelColors = [
            'bg-gray-400',      // 1
            'bg-green-500',     // 2
            'bg-teal-500',      // 3
            'bg-cyan-500',      // 4
            'bg-blue-500',      // 5
            'bg-indigo-500',    // 6
            'bg-violet-500',    // 7
            'bg-purple-500',    // 8
            'bg-fuchsia-500',   // 9
            'bg-amber-500',     // 10
          ];
          const colorClass = levelColors[Math.min(info.level - 1, levelColors.length - 1)];
          
          return (
            <div key={def.id} className="bg-white p-2 rounded-xl shadow-sm border border-[#e5e5e5] text-center">
              <div className={`w-7 h-7 ${colorClass} rounded-lg mx-auto mb-1 flex items-center justify-center text-white font-bold text-[12px]`}>
                {info.level}
              </div>
              <div className="text-[11px] font-bold text-[#1a1a1a] truncate">{def.label}</div>
              <div className="text-[9px] text-[#8e8e93]">{skillXp} XP</div>
              {/* Mini progress bar */}
              <div className="h-1 bg-[#f2f2f7] rounded-full overflow-hidden mt-1">
                <div 
                  className={`h-full ${colorClass} transition-all`}
                  style={{ width: `${info.progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Achievement Detail Modal */}
      {selectedAchievement && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedAchievement(null)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                {selectedAchievement.imageUrl ? (
                  <img src={selectedAchievement.imageUrl} className="w-full h-full object-cover" alt="" />
                ) : (
                  <Award size={32} className="text-[#ff9500]"/>
                )}
              </div>
              <button onClick={() => setSelectedAchievement(null)} className="p-2 text-[#6b7280]">
                <X size={20} />
              </button>
            </div>
            <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-2">{selectedAchievement.title}</h3>
            <p className="text-[14px] text-[#6b7280] mb-4">{selectedAchievement.description || 'Нет описания'}</p>
            
            {/* Conditions */}
            <div className="bg-[#f2f2f7] rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-bold text-[#6b7280] uppercase">Условия получения:</p>
              {selectedAchievement.conditions.minLevel && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Target size={14} className="text-[#007aff]"/>
                  <span>Достичь уровня {selectedAchievement.conditions.minLevel}</span>
                </div>
              )}
              {selectedAchievement.conditions.minTrainings && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Calendar size={14} className="text-[#ff9500]"/>
                  <span>Пройти {selectedAchievement.conditions.minTrainings} тренировок</span>
                </div>
              )}
              {selectedAchievement.conditions.minStreak && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Flame size={14} className="text-[#ff3b30]"/>
                  <span>Стрик {selectedAchievement.conditions.minStreak} дней</span>
                </div>
              )}
              {selectedAchievement.conditions.minTotalXp && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Zap size={14} className="text-[#5856d6]"/>
                  <span>Накопить {selectedAchievement.conditions.minTotalXp.toLocaleString()} XP</span>
                </div>
              )}
              {selectedAchievement.conditions.minSkillValue && (
                <div className="flex items-center gap-2 text-[13px]">
                  <Target size={14} className="text-[#4cd964]"/>
                  <span>{skillDefinitions.find(s => s.id === selectedAchievement.conditions.minSkillValue?.skill)?.label || selectedAchievement.conditions.minSkillValue.skill} до {selectedAchievement.conditions.minSkillValue.value}</span>
                </div>
              )}
              {Object.keys(selectedAchievement.conditions).length === 0 && (
                <p className="text-[13px] text-[#6b7280]">Особые условия</p>
              )}
            </div>

            {student.achievements.includes(selectedAchievement.id) ? (
              <div className="mt-4 bg-[#4cd964]/10 text-[#4cd964] p-3 rounded-xl text-center font-bold text-[14px] flex items-center justify-center gap-2">
                <Check size={18}/> Получено!
              </div>
            ) : (
              <div className="mt-4 bg-[#ff3b30]/10 text-[#ff3b30] p-3 rounded-xl text-center font-bold text-[14px] flex items-center justify-center gap-2">
                <Lock size={16}/> Не получено
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ios-section-title">Награды ({student.achievements.length}/{masterAchievements.length})</div>
      <div className="px-4 mb-6 grid grid-cols-2 gap-3">
        {masterAchievements.map((ach) => {
          const isUnlocked = student.achievements.includes(ach.id);
          return (
            <div 
              key={ach.id} 
              onClick={() => setSelectedAchievement(ach)}
              className={`bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center text-center cursor-pointer active-scale ${isUnlocked ? 'border-[#4cd964]' : 'border-[#e5e5e5] opacity-50 grayscale'}`}
            >
              <div className="w-16 h-16 mb-2 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center relative">
                 {isUnlocked ? (
                   ach.imageUrl ? <img src={ach.imageUrl} className="w-full h-full object-cover" alt="" /> : <Award size={32} className="text-[#ff9500]"/>
                 ) : (
                   <Lock size={20} className="text-[#6b7280]"/>
                 )}
                 {isUnlocked && (
                   <div className="absolute -top-1 -right-1 bg-[#4cd964] rounded-full p-0.5">
                     <Check size={10} className="text-white"/>
                   </div>
                 )}
              </div>
              <p className="text-[12px] font-bold leading-tight text-[#1a1a1a]">{ach.title}</p>
              <button className="text-[9px] text-[#007aff] mt-1 flex items-center gap-0.5">
                <Info size={10}/> Подробнее
              </button>
            </div>
          );
        })}
      </div>

      <div className="ios-section-title">История активности</div>
      <div className="ios-list-group">
        {student.trainingHistory && student.trainingHistory.length > 0 ? (
          student.trainingHistory.map((rec) => (
            <div key={rec.id} className="ios-list-item">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  rec.source === 'qr' ? 'bg-[#5856d6]/10' : 
                  rec.source === 'training' || rec.source === 'preset' ? 'bg-[#4cd964]/10' : 
                  'bg-[#ff9500]/10'
                }`}>
                  {rec.source === 'qr' ? <Target size={14} className="text-[#5856d6]"/> :
                   rec.source === 'training' || rec.source === 'preset' ? <Calendar size={14} className="text-[#4cd964]"/> :
                   <Zap size={14} className="text-[#ff9500]"/>}
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#1a1a1a]">{getSkillLabel(rec.skillFocus)}</p>
                  <p className="text-[10px] text-[#6b7280]">
                    {new Date(rec.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    {rec.source === 'qr' && ' • QR'}
                    {(rec.source === 'training' || rec.source === 'preset') && ' • Тренировка'}
                    {rec.source === 'xp_bonus' && ' • Бонус'}
                  </p>
                </div>
              </div>
              <span className="text-[#22c55e] font-bold">+{rec.xpEarned}</span>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-[#6b7280] text-[14px]">
            История пуста
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProfile;
