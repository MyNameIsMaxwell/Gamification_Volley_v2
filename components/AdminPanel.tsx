
import React, { useState, useMemo } from 'react';
import { User, UserRole, XPConfig, AchievementCriteria, Skills, AchievementConditions, SkillDefinition, QRCodeDefinition } from '../types';
import { 
  Settings, Award, Users, MapPin, Plus, Trash2, Edit2, Check, 
  Image as ImageIcon, Target, Flame, Star, Zap, BarChart3, TrendingUp, PieChart,
  ChevronDown, ChevronRight, Building, ToggleLeft, ToggleRight, Save, X, QrCode, Download, Printer
} from 'lucide-react';

interface AdminPanelProps {
  xpConfig: XPConfig;
  onUpdateXpConfig: (config: XPConfig) => void;
  achievements: AchievementCriteria[];
  onAddAchievement: (ach: AchievementCriteria) => void;
  onUpdateAchievement: (ach: AchievementCriteria) => void;
  onRemoveAchievement: (id: string) => void;
  staff: User[];
  onAddStaff: (user: Partial<User>) => void;
  cityBranches: Record<string, string[]>;
  onAddCity: (city: string) => void;
  onRemoveCity: (city: string) => void;
  onAddBranch: (city: string, branch: string) => void;
  onRemoveBranch: (city: string, branch: string) => void;
  students: User[];
  skillDefinitions: SkillDefinition[];
  onAddSkillDefinition: (label: string) => void;
  enabledSkills: string[];
  onToggleSkill: (skillId: string) => void;
  qrCodes: QRCodeDefinition[];
  onAddQR: (qr: QRCodeDefinition) => void;
  onRemoveQR: (id: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  xpConfig, onUpdateXpConfig,
  achievements, onAddAchievement, onUpdateAchievement, onRemoveAchievement,
  cityBranches, onAddCity, onRemoveCity, onAddBranch, onRemoveBranch,
  students,
  skillDefinitions, onAddSkillDefinition,
  enabledSkills, onToggleSkill,
  qrCodes, onAddQR, onRemoveQR
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'xp' | 'achievements' | 'locations' | 'skills_mgmt' | 'qr'>('stats');
  
  // State for forms
  const [newSkillLabel, setNewSkillLabel] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newBranchNames, setNewBranchNames] = useState<Record<string, string>>({});

  const [qrForm, setQrForm] = useState({
    title: '', city: '', branch: '', xpAmount: 150, skillId: '', achievementId: ''
  });

  const [achForm, setAchForm] = useState({ 
    title: '', description: '', imageUrl: '', minLevel: 0, minTrainings: 0, minStreak: 0, skillLimit: '', skillValue: 0
  });
  const [editingAchId, setEditingAchId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalXp = students.reduce((acc, s) => acc + s.totalXp, 0);
    
    const cityXp: Record<string, number> = {};
    const branchStats: Record<string, { xp: number, count: number, city: string }> = {};

    students.forEach(s => {
      cityXp[s.city] = (cityXp[s.city] || 0) + s.totalXp;
      const key = `${s.city}:${s.branch}`;
      if (!branchStats[key]) branchStats[key] = { xp: 0, count: 0, city: s.city };
      branchStats[key].xp += s.totalXp;
      branchStats[key].count += 1;
    });

    return { totalStudents, totalXp, cityXp, branchStats };
  }, [students]);

  const handleCreateQR = () => {
    if (!qrForm.title || !qrForm.city || !qrForm.branch) return;
    onAddQR({
      id: `qr_${Date.now()}`,
      title: qrForm.title,
      city: qrForm.city,
      branch: qrForm.branch,
      xpAmount: qrForm.xpAmount,
      skillId: qrForm.skillId || undefined,
      achievementId: qrForm.achievementId || undefined,
      createdAt: new Date().toISOString()
    });
    setQrForm({ title: '', city: '', branch: '', xpAmount: 150, skillId: '', achievementId: '' });
  };

  const handleSaveAchievement = () => {
    if (!achForm.title) return;
    const conditions: AchievementConditions = {};
    if (achForm.minLevel > 0) conditions.minLevel = achForm.minLevel;
    if (achForm.minTrainings > 0) conditions.minTrainings = achForm.minTrainings;
    if (achForm.skillLimit && achForm.skillValue > 0) {
      conditions.minSkillValue = { skill: achForm.skillLimit, value: achForm.skillValue };
    }

    const achData: AchievementCriteria = { 
      id: editingAchId || `ach_${Date.now()}`, 
      title: achForm.title, 
      description: achForm.description, 
      imageUrl: achForm.imageUrl, 
      conditions 
    };

    if (editingAchId) onUpdateAchievement(achData);
    else onAddAchievement(achData);
    
    setEditingAchId(null);
    setAchForm({ title: '', description: '', imageUrl: '', minLevel: 0, minTrainings: 0, minStreak: 0, skillLimit: '', skillValue: 0 });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      <div className="mx-4 flex bg-[#f2f2f7] p-1 rounded-xl overflow-x-auto no-scrollbar gap-1">
        {[
          { id: 'stats', label: 'Стат', icon: BarChart3 },
          { id: 'qr', label: 'QR', icon: QrCode },
          { id: 'achievements', label: 'Награды', icon: Award },
          { id: 'locations', label: 'Локации', icon: MapPin },
          { id: 'skills_mgmt', label: 'Навыки', icon: Target },
          { id: 'xp', label: 'XP', icon: Settings },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${activeSubTab === tab.id ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#8e8e93]'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'stats' && (
        <div className="space-y-6 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-[#c6c6c8]/20">
              <p className="text-[10px] font-bold text-[#8e8e93] uppercase mb-1">Всего учеников</p>
              <p className="text-[24px] font-bold">{stats.totalStudents}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-[#c6c6c8]/20">
              <p className="text-[10px] font-bold text-[#8e8e93] uppercase mb-1">Общий XP сети</p>
              <p className="text-[20px] font-bold text-[#007aff] truncate">{stats.totalXp.toLocaleString()}</p>
            </div>
          </div>

          <div className="ios-section-title px-0">Рейтинг филиалов</div>
          <div className="ios-list-group mx-0">
            {Object.entries(stats.branchStats).sort((a,b) => b[1].xp - a[1].xp).map(([key, data]) => (
              <div key={key} className="ios-list-item">
                <div className="flex flex-col">
                  <span className="font-bold text-[15px]">{key.split(':')[1]}</span>
                  <span className="text-[10px] text-[#8e8e93]">{data.city} • {data.count} чел.</span>
                </div>
                <span className="font-bold text-[#007aff]">{data.xp.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'locations' && (
        <div className="space-y-6 px-4">
          <div className="ios-section-title px-0">Новый город</div>
          <div className="flex gap-2">
            <input 
              placeholder="Название города..." 
              className="flex-1 bg-white p-4 rounded-2xl border border-[#c6c6c8]/20 outline-none" 
              value={newCity} 
              onChange={e => setNewCity(e.target.value)}
            />
            <button 
              onClick={() => { if(newCity) { onAddCity(newCity); setNewCity(''); } }}
              className="bg-[#007aff] text-white px-5 rounded-2xl active-scale"
            >
              <Plus />
            </button>
          </div>

          <div className="ios-section-title px-0 mt-6">Города и филиалы</div>
          {Object.entries(cityBranches).map(([city, branches]) => (
            <div key={city} className="bg-white rounded-3xl p-4 shadow-sm border border-[#c6c6c8]/20 space-y-4">
              <div className="flex justify-between items-center border-b border-[#f2f2f7] pb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#007aff]" />
                  <span className="font-bold text-[17px]">{city}</span>
                </div>
                <button onClick={() => onRemoveCity(city)} className="text-[#ff3b30] p-1"><Trash2 size={16}/></button>
              </div>
              
              <div className="space-y-2">
                {branches.map(branch => (
                  <div key={branch} className="flex justify-between items-center bg-[#f2f2f7] p-3 rounded-xl">
                    <span className="text-[14px] font-medium">{branch}</span>
                    <button onClick={() => onRemoveBranch(city, branch)} className="text-[#8e8e93]"><X size={14}/></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <input 
                  placeholder="Добавить филиал..." 
                  className="flex-1 bg-[#f2f2f7] px-3 py-2 rounded-xl text-[13px] outline-none"
                  value={newBranchNames[city] || ''}
                  onChange={e => setNewBranchNames({...newBranchNames, [city]: e.target.value})}
                />
                <button 
                  onClick={() => { 
                    if(newBranchNames[city]) { 
                      onAddBranch(city, newBranchNames[city]); 
                      setNewBranchNames({...newBranchNames, [city]: ''});
                    }
                  }}
                  className="bg-[#007aff] text-white p-2 rounded-xl active-scale"
                >
                  <Plus size={18}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'xp' && (
        <div className="space-y-6 px-4">
          <div className="ios-section-title px-0">Настройка уровней</div>
          <div className="ios-list-group mx-0">
            <div className="ios-list-item">
              <span>Опыт за 1 уровень</span>
              <input 
                type="number" 
                className="text-right w-24 bg-transparent font-bold text-[#007aff] outline-none"
                value={xpConfig.xpPerLevel}
                onChange={e => onUpdateXpConfig({...xpConfig, xpPerLevel: Number(e.target.value)})}
              />
            </div>
            <div className="ios-list-item">
              <span>Множитель сложности</span>
              <input 
                type="number" 
                step="0.1"
                className="text-right w-24 bg-transparent font-bold text-[#007aff] outline-none"
                value={xpConfig.multiplier}
                onChange={e => onUpdateXpConfig({...xpConfig, multiplier: Number(e.target.value)})}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#8e8e93] px-2 italic">
            Изменение этих параметров мгновенно пересчитает прогресс-бары всех учеников.
          </p>
        </div>
      )}

      {/* Existing Tabs: achievements, skills_mgmt, qr */}
      {activeSubTab === 'skills_mgmt' && (
        <div className="space-y-4 px-4">
          <div className="ios-section-title px-0">Добавить навык</div>
          <div className="bg-white rounded-2xl p-3 flex gap-2 border border-[#c6c6c8]/20">
            <input placeholder="Название..." className="flex-1 bg-transparent outline-none p-2" value={newSkillLabel} onChange={e => setNewSkillLabel(e.target.value)}/>
            <button onClick={() => {if(newSkillLabel){onAddSkillDefinition(newSkillLabel);setNewSkillLabel('');}}} className="bg-[#007aff] text-white p-3 rounded-xl"><Plus size={20}/></button>
          </div>
          <div className="ios-list-group mx-0 mt-4">
            {skillDefinitions.map(def => (
              <div key={def.id} className="ios-list-item">
                <span className="font-medium">{def.label}</span>
                <button onClick={() => onToggleSkill(def.id)}>
                   {enabledSkills.includes(def.id) ? <ToggleRight size={36} className="text-[#4cd964]"/> : <ToggleLeft size={36} className="text-[#c6c6c8]"/>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'qr' && (
        <div className="space-y-4 px-4">
          <div className="ios-section-title px-0">Новый QR код</div>
          <div className="ios-list-group mx-0">
             <div className="ios-list-item"><input placeholder="Заголовок" className="w-full outline-none bg-transparent" value={qrForm.title} onChange={e => setQrForm({...qrForm, title: e.target.value})}/></div>
             <div className="ios-list-item">
                <select className="w-full bg-transparent outline-none text-[#007aff]" value={qrForm.city} onChange={e => setQrForm({...qrForm, city: e.target.value, branch: ''})}>
                  <option value="">Город</option>
                  {Object.keys(cityBranches).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
             <div className="ios-list-item">
                <select className="w-full bg-transparent outline-none text-[#007aff]" value={qrForm.branch} onChange={e => setQrForm({...qrForm, branch: e.target.value})} disabled={!qrForm.city}>
                  <option value="">Филиал</option>
                  {qrForm.city && cityBranches[qrForm.city].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
             </div>
             <div className="ios-list-item">
               <span>Опыт (XP)</span>
               <input type="number" className="text-right w-20 outline-none text-[#007aff] font-bold" value={qrForm.xpAmount} onChange={e => setQrForm({...qrForm, xpAmount: Number(e.target.value)})}/>
             </div>
          </div>
          <button onClick={handleCreateQR} className="w-full bg-[#007aff] text-white py-4 rounded-3xl font-bold active-scale shadow-lg">Создать QR</button>

          <div className="ios-section-title px-0 mt-8">Активные QR</div>
          <div className="space-y-3">
            {qrCodes.map(qr => (
              <div key={qr.id} className="bg-white p-4 rounded-3xl border border-[#c6c6c8]/20 shadow-sm flex items-center gap-4">
                <div className="bg-[#f2f2f7] p-2 rounded-xl"><QrCode size={32} className="text-[#007aff]"/></div>
                <div className="flex-1">
                  <h4 className="font-bold text-[15px]">{qr.title}</h4>
                  <p className="text-[11px] text-[#8e8e93]">{qr.city}, {qr.branch}</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => onRemoveQR(qr.id)} className="text-[#ff3b30] p-2 bg-[#ff3b30]/10 rounded-xl"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'achievements' && (
        <div className="space-y-4 px-4 pb-12">
          <div className="ios-section-title px-0">{editingAchId ? 'Редактировать' : 'Новая награда'}</div>
          <div className="ios-list-group mx-0">
            <div className="ios-list-item">
              <input placeholder="Название" className="w-full outline-none bg-transparent font-bold" value={achForm.title} onChange={e => setAchForm({...achForm, title: e.target.value})}/>
            </div>
            <div className="ios-list-item">
              <textarea placeholder="Описание" className="w-full outline-none bg-transparent text-[14px] min-h-[60px]" value={achForm.description} onChange={e => setAchForm({...achForm, description: e.target.value})}/>
            </div>
          </div>
          
          <div className="ios-section-title px-0">Условия</div>
          <div className="ios-list-group mx-0">
             <div className="ios-list-item"><span>Мин. Уровень</span><input type="number" className="text-right w-20 outline-none text-[#007aff] font-bold" value={achForm.minLevel} onChange={e => setAchForm({...achForm, minLevel: Number(e.target.value)})}/></div>
             <div className="ios-list-item"><span>Мин. тренировок</span><input type="number" className="text-right w-20 outline-none text-[#007aff] font-bold" value={achForm.minTrainings} onChange={e => setAchForm({...achForm, minTrainings: Number(e.target.value)})}/></div>
          </div>
          
          <button onClick={handleSaveAchievement} className="w-full bg-[#007aff] text-white py-4 rounded-3xl font-bold active-scale shadow-lg">
            {editingAchId ? 'Сохранить' : 'Создать'}
          </button>

          <div className="ios-section-title px-0 mt-8">Список наград</div>
          <div className="space-y-3">
            {achievements.map(ach => (
              <div key={ach.id} className="bg-white p-3 rounded-2xl flex items-center gap-3 border border-[#c6c6c8]/20 shadow-sm">
                <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
                  {ach.imageUrl ? <img src={ach.imageUrl} className="w-full h-full object-cover" /> : <Award className="text-[#ff9500]"/>}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-[14px]">{ach.title}</h4>
                  <p className="text-[11px] text-[#8e8e93]">{ach.description}</p>
                </div>
                <button onClick={() => onRemoveAchievement(ach.id)} className="text-[#ff3b30] p-2"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
