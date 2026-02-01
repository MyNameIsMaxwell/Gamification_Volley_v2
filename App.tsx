
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import { User, UserRole, XPConfig, AchievementCriteria, SkillDefinition, QRCodeDefinition } from './types';
import { MOCK_STUDENTS, XP_CONFIG, CITY_BRANCHES_MOCK, INITIAL_SKILL_DEFINITIONS } from './constants';
import { calculateProgress, getXpForNextLevel, addXp, getRankTitle } from './utils/levelLogic';
import { getNewUnlockedAchievements } from './utils/achievementLogic';
import SkillRadar from './components/SkillRadar';
import StudentProfile from './components/StudentProfile';
import AdminPanel from './components/AdminPanel';
import AchievementToast from './components/AchievementToast';
import QRScanner from './components/QRScanner';
import { getAiCoachAdvice } from './services/geminiService';
import { ChevronRight, MapPin, Shield, Building, Globe, QrCode, Award, Flame, Zap, Lock } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User>(MOCK_STUDENTS[0] as User);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState<User[]>(MOCK_STUDENTS as User[]);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // QR state
  const [qrCodes, setQrCodes] = useState<QRCodeDefinition[]>([
    { id: 'qr_default_branch', title: 'Тренировка в зале', city: 'Минск', branch: 'Центр', xpAmount: 150, createdAt: new Date().toISOString() }
  ]);
  const [showScanner, setShowScanner] = useState(false);

  // Skill definitions state
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinition[]>(INITIAL_SKILL_DEFINITIONS);
  const [enabledSkills, setEnabledSkills] = useState<string[]>(INITIAL_SKILL_DEFINITIONS.map(d => d.id));

  // Achievement state
  const [unlockedAchievement, setUnlockedAchievement] = useState<AchievementCriteria | null>(null);
  const [achievementList, setAchievementList] = useState<AchievementCriteria[]>([
    { id: 'ach_serve_1', title: 'Первый эйс', description: 'Достигни уровня подачи 15', imageUrl: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif', conditions: { minSkillValue: { skill: 'serve', value: 15 } } },
    { id: 'ach_lvl_5', title: 'Минский Тигр', description: 'Достигни 5 уровня', imageUrl: 'https://img.icons8.com/color/96/tiger.png', conditions: { minLevel: 5 } }
  ]);

  // Admin / General Settings
  const [xpSettings, setXpSettings] = useState<XPConfig>(XP_CONFIG);
  const [cityBranches, setCityBranches] = useState(CITY_BRANCHES_MOCK);
  const [leaderboardMode, setLeaderboardMode] = useState<'players' | 'branches' | 'cities'>('players');
  const [viewedStudentId, setViewedStudentId] = useState<string | null>(null);

  // UI State for forms
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>(enabledSkills[0] || '');
  const [xpToAward, setXpToAward] = useState(100);

  const isWeekend = useMemo(() => [0, 6].includes(new Date().getDay()), []);
  const canScanToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return user.lastQRScanDate !== today;
  }, [user.lastQRScanDate]);

  const updateStudentData = (studentId: string, options: { 
    xpToAdd: number, 
    skillToLevel?: string, 
    source: 'manual' | 'qr',
    qrId?: string,
    achievementId?: string
  }) => {
    const today = new Date().toISOString().split('T')[0];
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const { xp, level } = addXp(s.xp, s.level, options.xpToAdd, xpSettings);
        const newSkills = { ...s.skills };
        if (options.skillToLevel) {
          newSkills[options.skillToLevel] = (newSkills[options.skillToLevel] || 0) + Math.floor(options.xpToAdd / 50);
        }
        
        const updatedUser: User = {
          ...s, xp, level, totalXp: s.totalXp + options.xpToAdd, skills: newSkills,
          trainingsCompleted: s.trainingsCompleted + 1, lastTrainingDate: today,
          lastQRScanDate: options.source === 'qr' ? today : s.lastQRScanDate,
          trainingHistory: [
            { id: Date.now().toString(), date: today, skillFocus: options.skillToLevel || 'general', xpEarned: options.xpToAdd, source: options.source, qrId: options.qrId },
            ...(s.trainingHistory || [])
          ].slice(0, 15)
        };

        if (options.achievementId && !updatedUser.achievements.includes(options.achievementId)) {
          updatedUser.achievements = [...updatedUser.achievements, options.achievementId];
        }

        const newlyUnlockedIds = getNewUnlockedAchievements(updatedUser, achievementList);
        if (newlyUnlockedIds.length > 0) {
          updatedUser.achievements = [...updatedUser.achievements, ...newlyUnlockedIds];
          if (s.id === user.id) {
            const firstNew = achievementList.find(a => a.id === newlyUnlockedIds[0]);
            if (firstNew) setUnlockedAchievement(firstNew);
          }
        }

        if (s.id === user.id) setUser(updatedUser);
        return updatedUser;
      }
      return s;
    }));
  };

  const handleQRScan = (qrId: string) => {
    const qr = qrCodes.find(q => q.id === qrId);
    if (!qr) return alert("Неверный QR код");
    if (!canScanToday) return alert("Вы уже отметились сегодня!");
    
    updateStudentData(user.id, { 
      xpToAdd: qr.xpAmount, 
      skillToLevel: qr.skillId, 
      source: 'qr', 
      qrId: qr.id, 
      achievementId: qr.achievementId 
    });
    setShowScanner(false);
  };

  const fetchAdvice = useCallback(async () => {
    setLoadingAdvice(true);
    const advice = await getAiCoachAdvice(user.skills, user.level, skillDefinitions);
    setAiAdvice(advice);
    setLoadingAdvice(false);
  }, [user.skills, user.level, skillDefinitions]);

  useEffect(() => {
    if (activeTab === 'skills' && !aiAdvice) fetchAdvice();
  }, [activeTab, aiAdvice, fetchAdvice]);

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
        <button onClick={() => {
          const roles = [UserRole.STUDENT, UserRole.TRAINER, UserRole.ADMIN];
          const next = roles[(roles.indexOf(user.role) + 1) % roles.length];
          setUser({...user, role: next});
          setActiveTab('dashboard');
        }} className="bg-[#007aff] text-white px-3 py-1 rounded-lg font-bold active-scale">Сменить</button>
      </div>

      {viewedStudentId ? (
        <StudentProfile student={students.find(s=>s.id===viewedStudentId)!} masterAchievements={achievementList} onBack={() => setViewedStudentId(null)} skillDefinitions={skillDefinitions} xpConfig={xpSettings} />
      ) : (
        <div className="animate-in fade-in duration-300">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="mx-4 bg-white rounded-3xl p-5 shadow-sm active-scale flex items-center gap-4 border border-[#c6c6c8]/20" onClick={() => setViewedStudentId(user.id)}>
                <img src={user.avatar} className="w-20 h-20 rounded-full object-cover shadow-inner" />
                <div className="flex-1">
                  <h2 className="text-[22px] font-bold tracking-tight">{user.name}</h2>
                  <p className="text-[14px] text-[#8e8e93] font-medium">{user.city} • {user.branch}</p>
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
                    <span className="text-[14px] font-bold">Опыт уровня</span>
                    <span className="text-[13px] text-[#8e8e93] font-bold">{user.xp} / {getXpForNextLevel(user.level, xpSettings)} XP</span>
                  </div>
                  <div className="w-full bg-[#efeff4] h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-[#007aff] h-full transition-all duration-1000 shadow-lg" style={{ width: `${calculateProgress(user.xp, user.level, xpSettings)}%` }} />
                  </div>
                </div>
              </div>

              <div className="ios-section-title">Статистика игрока</div>
              <div className="ios-list-group">
                <div className="ios-list-item"><div className="flex items-center gap-3"><Zap size={18} className="text-[#007aff]"/><span>Всего накоплено XP</span></div><span className="font-bold">{user.totalXp.toLocaleString()}</span></div>
                <div className="ios-list-item"><div className="flex items-center gap-3"><Award size={18} className="text-[#ff9500]"/><span>Тренировок</span></div><span className="font-bold">{user.trainingsCompleted}</span></div>
                {user.streak > 0 && <div className="ios-list-item"><div className="flex items-center gap-3"><Flame size={18} className="text-[#ff3b30]"/><span>Стрик (дней)</span></div><span className="text-[#ff3b30] font-bold">{user.streak}</span></div>}
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6 pb-20">
               <div className="mx-4"><SkillRadar skills={user.skills} definitions={skillDefinitions} /></div>
               <div className="ios-section-title">Советы AI-Тренера</div>
               <div className="mx-4 bg-white p-5 rounded-3xl shadow-sm border border-[#007aff]/10 italic text-[15px] text-slate-700 leading-relaxed">
                 {loadingAdvice ? "Анализирую твою игру..." : aiAdvice}
                 {!loadingAdvice && <button onClick={fetchAdvice} className="mt-4 block text-[#007aff] text-[12px] font-bold uppercase tracking-wider">Обновить советы</button>}
               </div>
               <div className="ios-section-title">Разбивка по навыкам</div>
               <div className="ios-list-group">
                  {skillDefinitions.map(def => (
                    <div key={def.id} className="ios-list-item"><span className="font-medium">{def.label}</span><span className="font-bold text-[#007aff]">{user.skills[def.id] || 0}</span></div>
                  ))}
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
                      <span className={`w-5 text-[14px] font-bold ${idx < 3 ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}>{idx+1}</span>
                      <img src={s.avatar} className="w-10 h-10 rounded-full"/>
                      <div><p className="text-[15px] font-bold leading-tight">{s.name}</p><p className="text-[10px] text-[#8e8e93] font-medium">{s.branch}</p></div>
                    </div>
                    <span className="font-bold text-[#007aff]">{s.totalXp.toLocaleString()}</span>
                  </div>
                ))}
                {leaderboardMode === 'cities' && cityRankings.map(([city, data], idx) => (
                  <div key={city} className="ios-list-item">
                    <span className="w-5 font-bold text-[#8e8e93]">{idx+1}</span>
                    <span className="flex-1 font-bold">{city}</span>
                    <span className="font-bold text-[#5856d6]">{data.xp.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trainer' && (
             <div className="space-y-6">
                <div className="ios-section-title">Начислить опыт (Ручной ввод)</div>
                <div className="ios-list-group">
                   <div className="ios-list-item"><span>Ученик</span><select className="bg-transparent text-[#007aff] font-bold" value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}><option value="">Выбрать...</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                   <div className="ios-list-item"><span>Навык</span><select className="bg-transparent text-[#007aff] font-bold" value={selectedSkill} onChange={e=>setSelectedSkill(e.target.value)}>{skillDefinitions.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                   <div className="ios-list-item"><span>XP</span><input type="number" className="text-right bg-transparent text-[#007aff] font-bold" value={xpToAward} onChange={e=>setXpToAward(Number(e.target.value))}/></div>
                </div>
                <div className="px-4"><button onClick={() => {updateStudentData(selectedStudentId, {xpToAdd:isWeekend?xpToAward*2:xpToAward, skillToLevel:selectedSkill, source:'manual'}); alert("Результаты сохранены!");}} className="w-full bg-[#007aff] text-white py-4 rounded-3xl font-bold shadow-lg">Внести результат</button></div>
             </div>
          )}

          {activeTab === 'admin' && (
            <AdminPanel 
              xpConfig={xpSettings} onUpdateXpConfig={setXpSettings}
              achievements={achievementList} onAddAchievement={a=>setAchievementList([...achievementList, a])}
              onUpdateAchievement={ach => setAchievementList(prev => prev.map(a => a.id === ach.id ? ach : a))}
              onRemoveAchievement={id=>setAchievementList(achievementList.filter(a=>a.id!==id))}
              staff={[]} onAddStaff={()=>{}} cityBranches={cityBranches} 
              onAddCity={c => setCityBranches({...cityBranches, [c]: []})}
              onRemoveCity={c => {const n = {...cityBranches}; delete n[c]; setCityBranches(n);}}
              onAddBranch={(c,b) => setCityBranches({...cityBranches, [c]: [...cityBranches[c], b]})}
              onRemoveBranch={(c,b) => setCityBranches({...cityBranches, [c]: cityBranches[c].filter(x=>x!==b)})}
              students={students} skillDefinitions={skillDefinitions}
              onAddSkillDefinition={label => {
                const newId = `skill_${Date.now()}`;
                setSkillDefinitions([...skillDefinitions, {id:newId, label}]);
                setEnabledSkills([...enabledSkills, newId]);
              }}
              enabledSkills={enabledSkills}
              onToggleSkill={id => setEnabledSkills(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])}
              qrCodes={qrCodes} onAddQR={qr => setQrCodes([...qrCodes, qr])} onRemoveQR={id => setQrCodes(qrCodes.filter(q=>q.id!==id))}
            />
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;
