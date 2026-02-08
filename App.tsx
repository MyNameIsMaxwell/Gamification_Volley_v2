
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import { User, UserRole, XPConfig, AchievementCriteria, SkillDefinition, QRCodeDefinition } from './types';
import { calculateProgress, getXpForNextLevel, getRankTitle, getSkillLevelInfo, SkillLevelInfo } from './utils/levelLogic';
import SkillRadar from './components/SkillRadar';
import StudentProfile from './components/StudentProfile';
import AdminPanel from './components/AdminPanel';
import AchievementToast from './components/AchievementToast';
import QRScanner from './components/QRScanner';
import { getAiCoachAdvice } from './services/deepseekService';
import * as api from './services/api';
import { ChevronRight, Shield, QrCode, Award, Flame, Zap, Lock, Loader2 } from 'lucide-react';

// Telegram WebApp type declaration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          show: () => void;
          hide: () => void;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

const App: React.FC = () => {
  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User state
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState<User[]>([]);
  
  // AI Advice
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // QR state
  const [qrCodes, setQrCodes] = useState<QRCodeDefinition[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  // Skills state
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinition[]>([]);
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);

  // Achievements state
  const [unlockedAchievement, setUnlockedAchievement] = useState<AchievementCriteria | null>(null);
  const [achievementList, setAchievementList] = useState<AchievementCriteria[]>([]);

  // Settings state
  const [xpSettings, setXpSettings] = useState<XPConfig>({ xpPerLevel: 1000, multiplier: 1.2 });
  const [cityBranches, setCityBranches] = useState<Record<string, string[]>>({});
  const [leaderboardMode, setLeaderboardMode] = useState<'players' | 'branches' | 'cities'>('players');
  const [viewedStudentId, setViewedStudentId] = useState<string | null>(null);

  // Form state
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [xpToAward, setXpToAward] = useState(100);
  
  // Training form state
  const [trainingMode, setTrainingMode] = useState<'preset' | 'custom' | 'bonus'>('preset');
  const [trainingSkills, setTrainingSkills] = useState<{skillId: string; xpAmount: number}[]>([]);

  const isWeekend = useMemo(() => [0, 6].includes(new Date().getDay()), []);
  const canScanToday = useMemo(() => {
    if (!user) return false;
    const today = new Date().toISOString().split('T')[0];
    return user.lastQRScanDate !== today;
  }, [user?.lastQRScanDate]);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        
        // Initialize Telegram WebApp
        const tg = window.Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();
          
          const theme = tg.themeParams;
          if (theme) {
            const root = document.documentElement;
            if (theme.bg_color) root.style.setProperty('--tg-bg-color', theme.bg_color);
            if (theme.text_color) root.style.setProperty('--tg-text-color', theme.text_color);
            if (theme.hint_color) root.style.setProperty('--tg-hint-color', theme.hint_color);
            if (theme.link_color) root.style.setProperty('--tg-link-color', theme.link_color);
            if (theme.secondary_bg_color) root.style.setProperty('--tg-secondary-bg-color', theme.secondary_bg_color);
          }
        }

        // Load all data in parallel
        const [
          currentUser,
          allUsers,
          skills,
          achievements,
          qrCodesData,
          locations,
          xpConfig
        ] = await Promise.all([
          api.getCurrentUser(),
          api.getAllUsers(),
          api.getSkills(),
          api.getAchievements(),
          api.getQRCodes(),
          api.getLocations(),
          api.getXpSettings()
        ]);

        if (currentUser) {
          setUser(currentUser);
        }
        setStudents(allUsers);
        setSkillDefinitions(skills);
        setEnabledSkills(skills.filter((s: any) => s.enabled !== false).map(s => s.id));
        setAchievementList(achievements);
        setQrCodes(qrCodesData);
        setCityBranches(locations);
        setXpSettings(xpConfig);

        if (skills.length > 0) {
          setSelectedSkill(skills[0].id);
        }

      } catch (err) {
        console.error('Init error:', err);
        setError('Не удалось загрузить данные. Попробуйте обновить страницу.');
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Refresh data helper
  const refreshData = useCallback(async () => {
    try {
      const [currentUser, allUsers] = await Promise.all([
        user ? api.getUserById(user.id) : null,
        api.getAllUsers()
      ]);
      if (currentUser) setUser(currentUser);
      setStudents(allUsers);
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }, [user]);

  // Award XP handler
  const handleAwardXp = useCallback(async () => {
    if (!selectedStudentId || !xpToAward) {
      alert('Выберите ученика и укажите XP');
      return;
    }

    try {
      const result = await api.awardXp(selectedStudentId, xpToAward, selectedSkill);
      
      // Update user state immediately if awarding to self
      if (selectedStudentId === user?.id) {
        setUser(result.user);
      }
      
      if (result.newAchievements?.length > 0 && selectedStudentId === user?.id) {
        setUnlockedAchievement(result.newAchievements[0]);
      }
      
      await refreshData();
      
      // Show level up message if level changed
      const oldLevel = students.find(s => s.id === selectedStudentId)?.level || 1;
      const levelUpMsg = result.user.level > oldLevel ? ` 🎉 Новый уровень: ${result.user.level}!` : '';
      
      alert(`Начислено ${result.xpAwarded} XP${result.weekendBonus ? ' (x2 выходные!)' : ''}${levelUpMsg}`);
    } catch (err) {
      console.error('Award XP error:', err);
      alert('Ошибка при начислении XP');
    }
  }, [selectedStudentId, xpToAward, selectedSkill, user, refreshData, students]);

  // QR Scan handler
  const handleQRScan = useCallback(async (qrId: string) => {
    if (!user) return;

    try {
      const result = await api.scanQR(user.id, qrId);
      
      if (result.newAchievements?.length > 0) {
        setUnlockedAchievement(result.newAchievements[0]);
      }
      
      setUser(result.user);
      await refreshData();
      setShowScanner(false);
      alert(`+${result.xpAwarded} XP за ${result.qr.title}!`);
    } catch (err: any) {
      console.error('QR scan error:', err);
      alert(err.message || 'Ошибка при сканировании QR');
    }
  }, [user, refreshData]);

  // AI Advice
  const fetchAdvice = useCallback(async () => {
    if (!user) return;
    setLoadingAdvice(true);
    try {
      const advice = await getAiCoachAdvice(user.skills, user.level, skillDefinitions);
      setAiAdvice(advice);
    } catch (err) {
      console.error('Advice error:', err);
    } finally {
      setLoadingAdvice(false);
    }
  }, [user, skillDefinitions]);

  useEffect(() => {
    if (activeTab === 'skills' && !aiAdvice && user) fetchAdvice();
  }, [activeTab, aiAdvice, user, fetchAdvice]);

  // Rankings calculations
  const cityRankings = useMemo(() => {
    const counts: Record<string, { xp: number, students: number }> = {};
    students.forEach(s => {
      if (!counts[s.city]) counts[s.city] = { xp: 0, students: 0 };
      counts[s.city].xp += s.totalXp;
      counts[s.city].students += 1;
    });
    return Object.entries(counts).sort((a,b) => b[1].xp - a[1].xp);
  }, [students]);

  const branchRankings = useMemo(() => {
    const counts: Record<string, { xp: number, students: number, city: string }> = {};
    students.forEach(s => {
      const key = `${s.city}:${s.branch}`;
      if (!counts[key]) counts[key] = { xp: 0, students: 0, city: s.city };
      counts[key].xp += s.totalXp;
      counts[key].students += 1;
    });
    return Object.entries(counts).sort((a,b) => b[1].xp - a[1].xp);
  }, [students]);

  // Admin handlers
  const handleUpdateXpConfig = useCallback(async (config: XPConfig) => {
    try {
      const updated = await api.updateXpSettings(config);
      setXpSettings(updated);
    } catch (err) {
      console.error('Update XP config error:', err);
    }
  }, []);

  const handleAddAchievement = useCallback(async (ach: AchievementCriteria) => {
    try {
      const created = await api.createAchievement(ach);
      setAchievementList(prev => [...prev, created]);
    } catch (err) {
      console.error('Add achievement error:', err);
    }
  }, []);

  const handleUpdateAchievement = useCallback(async (ach: AchievementCriteria) => {
    try {
      const updated = await api.updateAchievement(ach.id, ach);
      setAchievementList(prev => prev.map(a => a.id === ach.id ? updated : a));
    } catch (err) {
      console.error('Update achievement error:', err);
    }
  }, []);

  const handleRemoveAchievement = useCallback(async (id: string) => {
    try {
      await api.deleteAchievement(id);
      setAchievementList(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Remove achievement error:', err);
    }
  }, []);

  const handleAddCity = useCallback(async (city: string) => {
    try {
      await api.addCity(city);
      setCityBranches(prev => ({ ...prev, [city]: [] }));
    } catch (err) {
      console.error('Add city error:', err);
    }
  }, []);

  const handleRemoveCity = useCallback(async (city: string) => {
    try {
      await api.removeCity(city);
      setCityBranches(prev => {
        const n = { ...prev };
        delete n[city];
        return n;
      });
    } catch (err) {
      console.error('Remove city error:', err);
    }
  }, []);

  const handleAddBranch = useCallback(async (city: string, branch: string) => {
    try {
      await api.addBranch(city, branch);
      setCityBranches(prev => ({ ...prev, [city]: [...(prev[city] || []), branch] }));
    } catch (err) {
      console.error('Add branch error:', err);
    }
  }, []);

  const handleRemoveBranch = useCallback(async (city: string, branch: string) => {
    try {
      await api.removeBranch(city, branch);
      setCityBranches(prev => ({ ...prev, [city]: prev[city].filter(b => b !== branch) }));
    } catch (err) {
      console.error('Remove branch error:', err);
    }
  }, []);

  const handleAddSkill = useCallback(async (label: string) => {
    try {
      const created = await api.createSkill(label);
      setSkillDefinitions(prev => [...prev, created]);
      setEnabledSkills(prev => [...prev, created.id]);
    } catch (err) {
      console.error('Add skill error:', err);
    }
  }, []);

  const handleToggleSkill = useCallback(async (id: string) => {
    try {
      const updated = await api.toggleSkill(id);
      if (updated.enabled) {
        setEnabledSkills(prev => [...prev, id]);
      } else {
        setEnabledSkills(prev => prev.filter(s => s !== id));
      }
    } catch (err) {
      console.error('Toggle skill error:', err);
    }
  }, []);

  const handleAddQR = useCallback(async (qr: QRCodeDefinition) => {
    try {
      const created = await api.createQRCode(qr);
      setQrCodes(prev => [...prev, created]);
    } catch (err) {
      console.error('Add QR error:', err);
    }
  }, []);

  const handleRemoveQR = useCallback(async (id: string) => {
    try {
      await api.deleteQRCode(id);
      setQrCodes(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error('Remove QR error:', err);
    }
  }, []);

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#007aff] animate-spin mx-auto mb-4" />
          <p className="text-[#6b7280] text-[14px]">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error || !user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-3xl p-6 shadow-sm max-w-sm">
          <p className="text-[#1a1a1a] text-[16px] mb-4">{error || 'Откройте приложение через Telegram'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-[#007aff] text-white px-6 py-3 rounded-2xl font-bold"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setViewedStudentId(null); }} 
      userRole={user.role} onBack={viewedStudentId ? () => setViewedStudentId(null) : undefined}
      title={viewedStudentId ? students.find(s=>s.id===viewedStudentId)?.name : undefined}
    >
      {unlockedAchievement && <AchievementToast achievement={unlockedAchievement} onClose={() => setUnlockedAchievement(null)} />}
      {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

      <div className="mx-4 mb-6 bg-[#007aff]/10 p-3 rounded-xl flex justify-between items-center text-[12px] border border-[#007aff]/20">
        <div className="flex items-center gap-2"><Shield size={14} className="text-[#007aff]" /><span className="font-bold text-[#007aff]">РЕЖИМ: {user.role === UserRole.STUDENT ? 'УЧЕНИК' : user.role === UserRole.TRAINER ? 'ТРЕНЕР' : 'АДМИН'}</span></div>
        <button onClick={async () => {
          const roles = [UserRole.STUDENT, UserRole.TRAINER, UserRole.ADMIN];
          const next = roles[(roles.indexOf(user.role) + 1) % roles.length];
          try {
            const updated = await api.updateUserRole(user.id, next);
            setUser(updated);
            setActiveTab('dashboard');
          } catch (err) {
            console.error('Role change error:', err);
          }
        }} className="bg-[#007aff] text-white px-3 py-1 rounded-lg font-bold active-scale">Сменить</button>
      </div>

      {viewedStudentId ? (
        <StudentProfile 
          student={students.find(s=>s.id===viewedStudentId)!} 
          masterAchievements={achievementList} 
          onBack={() => setViewedStudentId(null)} 
          skillDefinitions={skillDefinitions} 
          xpConfig={xpSettings}
          cityBranches={cityBranches}
          isOwnProfile={viewedStudentId === user.id}
          onUpdateProfile={viewedStudentId === user.id ? async (profile) => {
            const updated = await api.updateUserProfile(user.id, profile);
            setUser(updated);
            await refreshData();
          } : undefined}
        />
      ) : (
        <div className="animate-in fade-in duration-300">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="mx-4 bg-white rounded-3xl p-5 shadow-sm active-scale flex items-center gap-4 border border-[#e5e5e5]" onClick={() => setViewedStudentId(user.id)}>
                <img src={user.avatar} className="w-20 h-20 rounded-full object-cover shadow-inner bg-gray-100" />
                <div className="flex-1">
                  <h2 className="text-[22px] font-bold tracking-tight text-[#1a1a1a]">{user.name}</h2>
                  <p className="text-[14px] text-[#6b7280] font-medium">{user.city} • {user.branch}</p>
                  <div className="flex items-center gap-2 mt-2">
                     <span className="bg-[#007aff] text-white px-3 py-1 rounded-full text-[12px] font-bold">Ур. {user.level}</span>
                     <span className="text-[#007aff] text-[12px] font-semibold">{getRankTitle(user.level)}</span>
                  </div>
                </div>
                <ChevronRight size={24} className="text-[#c6c6c8]" />
              </div>

              {user.role === UserRole.STUDENT && (
                <div className="mx-4">
                  <button 
                    disabled={!canScanToday}
                    onClick={() => setShowScanner(true)} 
                    className={`w-full py-4 rounded-3xl flex items-center justify-center gap-3 font-bold active-scale shadow-lg transition-all ${canScanToday ? 'bg-gradient-to-r from-[#007aff] to-[#5856d6] text-white shadow-[#007aff]/30' : 'bg-[#c6c6c8] text-[#8e8e93] shadow-none cursor-not-allowed'}`}
                  >
                    {canScanToday ? <QrCode size={24} /> : <Lock size={20} />}
                    {canScanToday ? 'Отметиться в зале' : 'Уже отмечено сегодня'}
                  </button>
                </div>
              )}

              <div className="ios-list-group">
                <div className="p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[14px] font-bold text-[#1a1a1a]">Опыт уровня</span>
                    <span className="text-[13px] text-[#6b7280] font-bold">{user.xp} / {getXpForNextLevel(user.level, xpSettings)} XP</span>
                  </div>
                  <div className="w-full bg-[#efeff4] h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-[#007aff] h-full transition-all duration-1000 shadow-lg" style={{ width: `${calculateProgress(user.xp, user.level, xpSettings)}%` }} />
                  </div>
                </div>
              </div>

              <div className="ios-section-title">Статистика игрока</div>
              <div className="ios-list-group">
                <div className="ios-list-item"><div className="flex items-center gap-3"><Zap size={18} className="text-[#007aff]"/><span className="text-[#1a1a1a]">Всего накоплено XP</span></div><span className="font-bold text-[#1a1a1a]">{user.totalXp.toLocaleString()}</span></div>
                <div className="ios-list-item"><div className="flex items-center gap-3"><Award size={18} className="text-[#ff9500]"/><span className="text-[#1a1a1a]">Тренировок</span></div><span className="font-bold text-[#1a1a1a]">{user.trainingsCompleted}</span></div>
                {user.streak > 0 && <div className="ios-list-item"><div className="flex items-center gap-3"><Flame size={18} className="text-[#ff3b30]"/><span className="text-[#1a1a1a]">Стрик (дней)</span></div><span className="text-[#ff3b30] font-bold">{user.streak}</span></div>}
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6 pb-20">
               <div className="mx-4"><SkillRadar skills={user.skills} definitions={skillDefinitions} /></div>
               
               {/* Skill Levels Legend */}
               <div className="mx-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                 <div className="text-[12px] font-bold text-blue-800 mb-3">📊 Система уровней навыков</div>
                 <div className="text-[11px] text-blue-600 leading-relaxed mb-3">
                   Каждый навык прокачивается отдельно. Тренируйтесь и получайте XP за конкретные навыки!
                 </div>
                 {/* Skill level scale */}
                 <div className="flex flex-wrap gap-1">
                   {[
                     {lvl: 1, xp: 0, title: 'Новичок', color: 'bg-gray-400'},
                     {lvl: 2, xp: 50, title: 'Ученик', color: 'bg-green-500'},
                     {lvl: 3, xp: 150, title: 'Практик', color: 'bg-teal-500'},
                     {lvl: 4, xp: 300, title: 'Опытный', color: 'bg-cyan-500'},
                     {lvl: 5, xp: 500, title: 'Умелый', color: 'bg-blue-500'},
                     {lvl: 6, xp: 750, title: 'Мастер', color: 'bg-indigo-500'},
                     {lvl: 7, xp: 1050, title: 'Эксперт', color: 'bg-violet-500'},
                     {lvl: 8, xp: 1400, title: 'Виртуоз', color: 'bg-purple-500'},
                     {lvl: 9, xp: 1800, title: 'Гуру', color: 'bg-fuchsia-500'},
                     {lvl: 10, xp: 2250, title: 'Легенда', color: 'bg-amber-500'},
                   ].map(l => (
                     <div key={l.lvl} className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded-lg">
                       <span className={`w-5 h-5 ${l.color} rounded text-[10px] text-white font-bold flex items-center justify-center`}>{l.lvl}</span>
                       <span className="text-[9px] text-blue-700">{l.xp}+</span>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="ios-section-title">Прогресс навыков</div>
               <div className="mx-4 space-y-3">
                  {skillDefinitions.map(def => {
                    const skillXp = user.skills[def.id] || 0;
                    const info: SkillLevelInfo = getSkillLevelInfo(skillXp);
                    
                    // Color based on level
                    const levelColors = [
                      'from-gray-400 to-gray-500',      // 1
                      'from-green-400 to-green-500',    // 2
                      'from-teal-400 to-teal-500',      // 3
                      'from-cyan-400 to-cyan-500',      // 4
                      'from-blue-400 to-blue-500',      // 5
                      'from-indigo-400 to-indigo-500',  // 6
                      'from-violet-400 to-violet-500',  // 7
                      'from-purple-400 to-purple-500',  // 8
                      'from-fuchsia-400 to-fuchsia-500', // 9
                      'from-amber-400 to-orange-500',   // 10 (gold)
                    ];
                    const colorClass = levelColors[Math.min(info.level - 1, levelColors.length - 1)];
                    
                    return (
                      <div key={def.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#e5e5e5]">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-[14px] shadow-sm`}>
                              {info.level}
                            </span>
                            <div>
                              <div className="font-bold text-[15px] text-[#1a1a1a]">{def.label}</div>
                              <div className="text-[11px] text-[#6b7280]">{info.rankTitle}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[14px] text-[#007aff]">{skillXp} XP</div>
                            {!info.isMaxLevel && (
                              <div className="text-[10px] text-[#8e8e93]">
                                до ур. {info.level + 1}: {info.xpForNextLevel - info.xpInCurrentLevel} XP
                              </div>
                            )}
                            {info.isMaxLevel && (
                              <div className="text-[10px] text-amber-500 font-bold">MAX</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="h-2 bg-[#f2f2f7] rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500 ease-out`}
                            style={{ width: `${info.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-[#8e8e93]">Ур. {info.level}</span>
                          {!info.isMaxLevel && <span className="text-[9px] text-[#8e8e93]">Ур. {info.level + 1}</span>}
                          {info.isMaxLevel && <span className="text-[9px] text-amber-500">🏆</span>}
                        </div>
                      </div>
                    );
                  })}
               </div>

               <div className="ios-section-title">Советы AI-Тренера</div>
               <div className="mx-4 bg-white p-5 rounded-3xl shadow-sm border border-[#e5e5e5] italic text-[15px] text-[#374151] leading-relaxed">
                 {loadingAdvice ? "Анализирую твою игру..." : aiAdvice}
                 {!loadingAdvice && <button onClick={fetchAdvice} className="mt-4 block text-[#007aff] text-[12px] font-bold uppercase tracking-wider not-italic">Обновить советы</button>}
               </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
             <div className="space-y-4">
               <div className="mx-4 flex bg-[#f2f2f7] p-1 rounded-xl gap-1">
                <button onClick={() => setLeaderboardMode('players')} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${leaderboardMode === 'players' ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}>Игроки</button>
                <button onClick={() => setLeaderboardMode('branches')} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${leaderboardMode === 'branches' ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}>Филиалы</button>
                <button onClick={() => setLeaderboardMode('cities')} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${leaderboardMode === 'cities' ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}>Города</button>
              </div>
              <div className="ios-list-group">
                {leaderboardMode === 'players' && students.sort((a,b)=>b.totalXp - a.totalXp).map((s, idx) => (
                  <div key={s.id} className="ios-list-item cursor-pointer" onClick={() => setViewedStudentId(s.id)}>
                    <div className="flex items-center gap-3">
                      <span className={`w-5 text-[14px] font-bold ${idx < 3 ? 'text-[#007aff]' : 'text-[#6b7280]'}`}>{idx+1}</span>
                      <img src={s.avatar} className="w-10 h-10 rounded-full bg-gray-100"/>
                      <div><p className="text-[15px] font-bold leading-tight text-[#1a1a1a]">{s.name}</p><p className="text-[10px] text-[#6b7280] font-medium">{s.branch}</p></div>
                    </div>
                    <span className="font-bold text-[#007aff]">{s.totalXp.toLocaleString()}</span>
                  </div>
                ))}
                {leaderboardMode === 'branches' && branchRankings.map(([key, data], idx) => (
                  <div key={key} className="ios-list-item">
                    <span className="w-5 font-bold text-[#6b7280]">{idx+1}</span>
                    <div className="flex-1">
                      <span className="font-bold text-[#1a1a1a]">{key.split(':')[1]}</span>
                      <span className="text-[10px] text-[#6b7280] ml-2">{data.city}</span>
                    </div>
                    <span className="font-bold text-[#5856d6]">{data.xp.toLocaleString()}</span>
                  </div>
                ))}
                {leaderboardMode === 'cities' && cityRankings.map(([city, data], idx) => (
                  <div key={city} className="ios-list-item">
                    <span className="w-5 font-bold text-[#6b7280]">{idx+1}</span>
                    <span className="flex-1 font-bold text-[#1a1a1a]">{city}</span>
                    <span className="font-bold text-[#5856d6]">{data.xp.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trainer' && (
             <div className="space-y-6">
                {/* Mode selector */}
                <div className="mx-4 flex bg-[#f2f2f7] p-1 rounded-xl gap-1">
                  <button onClick={() => setTrainingMode('preset')} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${trainingMode === 'preset' ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}>Тренировка</button>
                  <button onClick={() => setTrainingMode('custom')} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${trainingMode === 'custom' ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}>Несколько навыков</button>
                  <button onClick={() => setTrainingMode('bonus')} className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-all ${trainingMode === 'bonus' ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}>Бонус XP</button>
                </div>

                {/* Student selector */}
                <div className="ios-list-group">
                  <div className="ios-list-item">
                    <span className="text-[#1a1a1a]">Ученик</span>
                    <select className="bg-transparent text-[#007aff] font-bold" value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}>
                      <option value="">Выбрать...</option>
                      {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Preset training mode */}
                {trainingMode === 'preset' && (
                  <>
                    <div className="ios-section-title">Выберите тип тренировки</div>
                    <div className="px-4 space-y-2">
                      {[
                        { name: 'Атака + Блок', skills: [{skillId: 'attack', xp: 15}, {skillId: 'block', xp: 15}] },
                        { name: 'Прием + Пас', skills: [{skillId: 'receive', xp: 15}, {skillId: 'set', xp: 15}] },
                        { name: 'Подача', skills: [{skillId: 'serve', xp: 25}] },
                        { name: 'Физподготовка', skills: [{skillId: 'stamina', xp: 30}] },
                        { name: 'Комплексная', skills: [{skillId: 'attack', xp: 10}, {skillId: 'receive', xp: 10}, {skillId: 'serve', xp: 10}] },
                      ].map((preset, idx) => (
                        <button 
                          key={idx}
                          disabled={!selectedStudentId}
                          onClick={async () => {
                            if (!selectedStudentId) return;
                            try {
                              const result = await api.logTraining(
                                selectedStudentId,
                                preset.skills.map(s => ({ skillId: s.skillId, xpAmount: s.xp })),
                                true,
                                preset.name
                              );
                              if (result.newAchievements?.length > 0 && selectedStudentId === user?.id) {
                                setUnlockedAchievement(result.newAchievements[0]);
                              }
                              await refreshData();
                              alert(`✅ Тренировка "${preset.name}" записана! +${result.totalXpAwarded} XP${result.weekendBonus ? ' (x2 выходные!)' : ''}`);
                            } catch (err) {
                              console.error(err);
                              alert('Ошибка записи тренировки');
                            }
                          }}
                          className="w-full bg-white p-4 rounded-2xl border border-[#e5e5e5] text-left active-scale disabled:opacity-50"
                        >
                          <div className="font-bold text-[#1a1a1a]">{preset.name}</div>
                          <div className="text-[11px] text-[#6b7280] mt-1">
                            {preset.skills.map(s => {
                              const skill = skillDefinitions.find(d => d.id === s.skillId);
                              return `${skill?.label || s.skillId}: +${s.xp} XP`;
                            }).join(' • ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Custom multi-skill training */}
                {trainingMode === 'custom' && (
                  <>
                    <div className="ios-section-title">Добавить навыки</div>
                    <div className="px-4 space-y-2">
                      {trainingSkills.map((ts, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-3 rounded-xl border border-[#e5e5e5]">
                          <select 
                            className="flex-1 bg-transparent text-[#007aff] font-bold outline-none"
                            value={ts.skillId}
                            onChange={e => {
                              const updated = [...trainingSkills];
                              updated[idx].skillId = e.target.value;
                              setTrainingSkills(updated);
                            }}
                          >
                            {skillDefinitions.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
                          </select>
                          <input 
                            type="number" 
                            className="w-16 text-right bg-[#f2f2f7] p-2 rounded-lg text-[#007aff] font-bold outline-none"
                            value={ts.xpAmount}
                            onChange={e => {
                              const updated = [...trainingSkills];
                              updated[idx].xpAmount = Number(e.target.value);
                              setTrainingSkills(updated);
                            }}
                          />
                          <span className="text-[#6b7280] text-[12px]">XP</span>
                          <button onClick={() => setTrainingSkills(trainingSkills.filter((_, i) => i !== idx))} className="text-[#ff3b30] p-1">×</button>
                        </div>
                      ))}
                      <button 
                        onClick={() => setTrainingSkills([...trainingSkills, { skillId: skillDefinitions[0]?.id || 'attack', xpAmount: 10 }])}
                        className="w-full bg-[#f2f2f7] p-3 rounded-xl text-[#007aff] font-bold text-[13px]"
                      >
                        + Добавить навык
                      </button>
                    </div>
                    <div className="px-4">
                      <button 
                        disabled={!selectedStudentId || trainingSkills.length === 0}
                        onClick={async () => {
                          if (!selectedStudentId || trainingSkills.length === 0) return;
                          try {
                            const result = await api.logTraining(selectedStudentId, trainingSkills, false);
                            if (result.newAchievements?.length > 0 && selectedStudentId === user?.id) {
                              setUnlockedAchievement(result.newAchievements[0]);
                            }
                            await refreshData();
                            setTrainingSkills([]);
                            alert(`✅ Тренировка записана! +${result.totalXpAwarded} XP${result.weekendBonus ? ' (x2 выходные!)' : ''}`);
                          } catch (err) {
                            console.error(err);
                            alert('Ошибка записи тренировки');
                          }
                        }}
                        className="w-full bg-[#007aff] text-white py-4 rounded-3xl font-bold shadow-lg disabled:opacity-50"
                      >
                        Записать тренировку ({trainingSkills.reduce((sum, s) => sum + s.xpAmount, 0)} XP)
                      </button>
                    </div>
                  </>
                )}

                {/* Bonus XP mode - does NOT count as training */}
                {trainingMode === 'bonus' && (
                  <>
                    <div className="ios-section-title">Начислить бонусный XP</div>
                    <p className="mx-4 text-[11px] text-[#ff9500] bg-[#ff9500]/10 p-3 rounded-xl">
                      ⚠️ Бонусный XP не засчитывается как тренировка и не увеличивает счетчик тренировок
                    </p>
                    <div className="ios-list-group">
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Навык</span>
                        <select className="bg-transparent text-[#007aff] font-bold" value={selectedSkill} onChange={e=>setSelectedSkill(e.target.value)}>
                          {skillDefinitions.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">XP</span>
                        <input type="number" className="text-right bg-transparent text-[#007aff] font-bold w-20" value={xpToAward} onChange={e=>setXpToAward(Number(e.target.value))}/>
                      </div>
                    </div>
                    <div className="px-4">
                      <button onClick={handleAwardXp} disabled={!selectedStudentId} className="w-full bg-[#ff9500] text-white py-4 rounded-3xl font-bold shadow-lg disabled:opacity-50">
                        Начислить бонус
                      </button>
                    </div>
                  </>
                )}
             </div>
          )}

          {activeTab === 'admin' && (
            <AdminPanel 
              xpConfig={xpSettings} onUpdateXpConfig={handleUpdateXpConfig}
              achievements={achievementList} onAddAchievement={handleAddAchievement}
              onUpdateAchievement={handleUpdateAchievement}
              onRemoveAchievement={handleRemoveAchievement}
              staff={[]} onAddStaff={()=>{}} cityBranches={cityBranches} 
              onAddCity={handleAddCity}
              onRemoveCity={handleRemoveCity}
              onAddBranch={handleAddBranch}
              onRemoveBranch={handleRemoveBranch}
              students={students} skillDefinitions={skillDefinitions}
              onAddSkillDefinition={handleAddSkill}
              enabledSkills={enabledSkills}
              onToggleSkill={handleToggleSkill}
              qrCodes={qrCodes} onAddQR={handleAddQR} onRemoveQR={handleRemoveQR}
              onUpdateStudentProfile={async (userId, profile) => {
                await api.updateUserProfile(userId, profile);
                await refreshData();
              }}
              onUpdateStudentStats={async (userId, stats) => {
                await api.updateUserStats(userId, stats);
                await refreshData();
              }}
              onGrantAchievement={async (userId, achievementId) => {
                await api.grantAchievement(userId, achievementId);
                await refreshData();
              }}
              onRevokeAchievement={async (userId, achievementId) => {
                await api.revokeAchievement(userId, achievementId);
                await refreshData();
              }}
            />
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;
