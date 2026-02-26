
import React, { useState, useMemo } from 'react';
import { User, UserRole, XPConfig, AchievementCriteria, Skills, AchievementConditions, SkillDefinition, QRCodeDefinition, XpHistoryEntry } from '../types';
import { 
  Settings, Award, Users, MapPin, Plus, Trash2, Edit2, Check, 
  Image as ImageIcon, Target, Flame, Star, Zap, BarChart3, TrendingUp, PieChart,
  ChevronDown, ChevronRight, Building, ToggleLeft, ToggleRight, Save, X, QrCode, Download, Printer,
  Shield, Clock, History, Minus
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
  enabledSkillDefinitions: SkillDefinition[];
  onAddSkillDefinition: (label: string) => void;
  enabledSkills: string[];
  onToggleSkill: (skillId: string) => void;
  qrCodes: QRCodeDefinition[];
  onAddQR: (qr: QRCodeDefinition) => void;
  onRemoveQR: (id: string) => void;
  // New props for student management
  onUpdateStudentProfile?: (userId: string, profile: { name?: string; avatar?: string; city?: string; branch?: string }) => Promise<void>;
  onUpdateStudentStats?: (userId: string, stats: { xp?: number; totalXp?: number; level?: number; trainingsCompleted?: number; streak?: number }) => Promise<void>;
  onGrantAchievement?: (userId: string, achievementId: string) => Promise<void>;
  onRevokeAchievement?: (userId: string, achievementId: string) => Promise<void>;
  onUpdateStudentRole?: (userId: string, role: string) => Promise<void>;
  onAwardXp?: (userId: string, xpAmount: number, skillId?: string, reason?: string) => Promise<void>;
  onDeductXp?: (userId: string, xpAmount: number, skillId?: string, reason?: string) => Promise<void>;
  onGetXpHistory?: (userId: string) => Promise<XpHistoryEntry[]>;
  onUpdateTrainerAssignment?: (userId: string, assignedCity: string | null, assignedBranch: string | null) => Promise<void>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  xpConfig, onUpdateXpConfig,
  achievements, onAddAchievement, onUpdateAchievement, onRemoveAchievement,
  cityBranches, onAddCity, onRemoveCity, onAddBranch, onRemoveBranch,
  students,
  skillDefinitions, enabledSkillDefinitions, onAddSkillDefinition,
  enabledSkills, onToggleSkill,
  qrCodes, onAddQR, onRemoveQR,
  onUpdateStudentProfile, onUpdateStudentStats, onGrantAchievement, onRevokeAchievement,
  onUpdateStudentRole, onAwardXp, onDeductXp, onGetXpHistory, onUpdateTrainerAssignment
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'xp' | 'achievements' | 'locations' | 'skills_mgmt' | 'qr' | 'students'>('stats');
  
  // State for forms
  const [newSkillLabel, setNewSkillLabel] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newBranchNames, setNewBranchNames] = useState<Record<string, string>>({});

  const [qrForm, setQrForm] = useState({
    title: '', city: '', branch: '', xpAmount: 150, skillId: '', achievementId: '',
    isTrainingPreset: true, maxUses: '', expiresIn: ''
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState<string | null>(null);

  // Dynamic training presets - stored in localStorage
  type TrainingPreset = { name: string; skills: { skillId: string; xpAmount: number }[] };
  const PRESETS_KEY = 'volleylevel_training_presets';
  
  const defaultPresets: TrainingPreset[] = [
    { name: 'Атака + Блок', skills: [{skillId: 'attack', xpAmount: 15}, {skillId: 'block', xpAmount: 15}] },
    { name: 'Прием + Пас', skills: [{skillId: 'receive', xpAmount: 15}, {skillId: 'set', xpAmount: 15}] },
    { name: 'Подача', skills: [{skillId: 'serve', xpAmount: 25}] },
    { name: 'Физподготовка', skills: [{skillId: 'stamina', xpAmount: 30}] },
    { name: 'Комплексная', skills: [{skillId: 'attack', xpAmount: 10}, {skillId: 'receive', xpAmount: 10}, {skillId: 'serve', xpAmount: 10}] },
  ];
  
  const [customPresets, setCustomPresets] = useState<TrainingPreset[]>(() => {
    try {
      const saved = localStorage.getItem(PRESETS_KEY);
      return saved ? JSON.parse(saved) : defaultPresets;
    } catch { return defaultPresets; }
  });
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editingPresetIdx, setEditingPresetIdx] = useState<number | null>(null);
  const [presetForm, setPresetForm] = useState<TrainingPreset>({ name: '', skills: [{ skillId: '', xpAmount: 10 }] });

  const savePresets = (presets: TrainingPreset[]) => {
    setCustomPresets(presets);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  };

  const trainingPresets = useMemo(() => {
    return customPresets.filter(p => p.skills.every(s => enabledSkills.includes(s.skillId)));
  }, [customPresets, enabledSkills]);

  const [achForm, setAchForm] = useState({ 
    title: '', description: '', imageUrl: '', minLevel: 0, minTrainings: 0, minStreak: 0, minTotalXp: 0, skillLimit: '', skillValue: 0
  });
  const [editingAchId, setEditingAchId] = useState<string | null>(null);

  // Helper to load achievement into form for editing
  const startEditAchievement = (ach: AchievementCriteria) => {
    setEditingAchId(ach.id);
    setAchForm({
      title: ach.title,
      description: ach.description || '',
      imageUrl: ach.imageUrl || '',
      minLevel: ach.conditions.minLevel || 0,
      minTrainings: ach.conditions.minTrainings || 0,
      minStreak: ach.conditions.minStreak || 0,
      minTotalXp: ach.conditions.minTotalXp || 0,
      skillLimit: ach.conditions.minSkillValue?.skill || '',
      skillValue: ach.conditions.minSkillValue?.value || 0
    });
    // Scroll to top of form
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const cancelEditAchievement = () => {
    setEditingAchId(null);
    setAchForm({ title: '', description: '', imageUrl: '', minLevel: 0, minTrainings: 0, minStreak: 0, minTotalXp: 0, skillLimit: '', skillValue: 0 });
  };

  // Student management state
  const [studentFilter, setStudentFilter] = useState({ 
    city: '', branch: '', search: '', 
    minLevel: '', maxLevel: '', 
    minTrainings: '', maxTrainings: '',
    minStreak: '', maxStreak: '',
    minXp: '', maxXp: '',
    role: ''
  });
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentEditMode, setStudentEditMode] = useState<'profile' | 'stats' | 'achievements' | 'role' | 'xp' | 'history' | 'assignment' | null>(null);
  const [studentStatsForm, setStudentStatsForm] = useState({ xp: 0, totalXp: 0, level: 1, trainingsCompleted: 0, streak: 0 });
  const [studentProfileForm, setStudentProfileForm] = useState({ name: '', avatar: '', city: '', branch: '' });
  const [xpOperationForm, setXpOperationForm] = useState({ amount: 100, skillId: '', operation: 'add' as 'add' | 'deduct', reason: '' });
  const [savingStudent, setSavingStudent] = useState(false);
  const [xpHistory, setXpHistory] = useState<XpHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [trainerAssignForm, setTrainerAssignForm] = useState({ city: '', branch: '' });

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (studentFilter.city && s.city !== studentFilter.city) return false;
      if (studentFilter.branch && s.branch !== studentFilter.branch) return false;
      if (studentFilter.search && !s.name.toLowerCase().includes(studentFilter.search.toLowerCase())) return false;
      if (studentFilter.minLevel && s.level < Number(studentFilter.minLevel)) return false;
      if (studentFilter.maxLevel && s.level > Number(studentFilter.maxLevel)) return false;
      if (studentFilter.minTrainings && s.trainingsCompleted < Number(studentFilter.minTrainings)) return false;
      if (studentFilter.maxTrainings && s.trainingsCompleted > Number(studentFilter.maxTrainings)) return false;
      if (studentFilter.minStreak && s.streak < Number(studentFilter.minStreak)) return false;
      if (studentFilter.maxStreak && s.streak > Number(studentFilter.maxStreak)) return false;
      if (studentFilter.minXp && s.totalXp < Number(studentFilter.minXp)) return false;
      if (studentFilter.maxXp && s.totalXp > Number(studentFilter.maxXp)) return false;
      if (studentFilter.role && s.role !== studentFilter.role) return false;
      return true;
    }).sort((a, b) => b.totalXp - a.totalXp);
  }, [students, studentFilter]);

  const openStudentEdit = (student: User, mode: 'profile' | 'stats' | 'achievements' | 'role' | 'xp' | 'history' | 'assignment') => {
    setSelectedStudent(student);
    setStudentEditMode(mode);
    if (mode === 'stats') {
      setStudentStatsForm({
        xp: student.xp,
        totalXp: student.totalXp,
        level: student.level,
        trainingsCompleted: student.trainingsCompleted,
        streak: student.streak
      });
    }
    if (mode === 'profile') {
      setStudentProfileForm({
        name: student.name,
        avatar: student.avatar || '',
        city: student.city,
        branch: student.branch
      });
    }
    if (mode === 'xp') {
      setXpOperationForm({ amount: 100, skillId: '', operation: 'add', reason: '' });
    }
    if (mode === 'history' && onGetXpHistory) {
      setLoadingHistory(true);
      onGetXpHistory(student.id).then(h => {
        setXpHistory(h);
        setLoadingHistory(false);
      }).catch(() => setLoadingHistory(false));
    }
    if (mode === 'assignment') {
      setTrainerAssignForm({
        city: student.assignedCity || student.city || '',
        branch: student.assignedBranch || ''
      });
    }
  };

  const closeStudentEdit = () => {
    setSelectedStudent(null);
    setStudentEditMode(null);
  };

  const handleSaveStudentStats = async () => {
    if (!selectedStudent || !onUpdateStudentStats) return;
    setSavingStudent(true);
    try {
      await onUpdateStudentStats(selectedStudent.id, studentStatsForm);
      closeStudentEdit();
    } catch (err) {
      console.error('Save student stats error:', err);
      alert('Ошибка сохранения');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleToggleStudentAchievement = async (achievementId: string) => {
    if (!selectedStudent || !onGrantAchievement || !onRevokeAchievement) return;
    setSavingStudent(true);
    try {
      const hasAchievement = selectedStudent.achievements.includes(achievementId);
      if (hasAchievement) {
        await onRevokeAchievement(selectedStudent.id, achievementId);
      } else {
        await onGrantAchievement(selectedStudent.id, achievementId);
      }
      // Update local state
      setSelectedStudent(prev => prev ? {
        ...prev,
        achievements: hasAchievement 
          ? prev.achievements.filter(a => a !== achievementId)
          : [...prev.achievements, achievementId]
      } : null);
    } catch (err) {
      console.error('Toggle achievement error:', err);
      alert('Ошибка');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleSaveStudentProfile = async () => {
    if (!selectedStudent || !onUpdateStudentProfile) return;
    setSavingStudent(true);
    try {
      await onUpdateStudentProfile(selectedStudent.id, studentProfileForm);
      closeStudentEdit();
    } catch (err) {
      console.error('Save profile error:', err);
      alert('Ошибка сохранения');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleXpOperation = async () => {
    if (!selectedStudent || !onAwardXp || !onDeductXp) return;
    if (!xpOperationForm.amount || xpOperationForm.amount <= 0) {
      alert('Укажите количество XP');
      return;
    }
    setSavingStudent(true);
    try {
      if (xpOperationForm.operation === 'add') {
        await onAwardXp(selectedStudent.id, xpOperationForm.amount, xpOperationForm.skillId || undefined, xpOperationForm.reason || undefined);
        alert(`Начислено ${xpOperationForm.amount} XP`);
      } else {
        await onDeductXp(selectedStudent.id, xpOperationForm.amount, xpOperationForm.skillId || undefined, xpOperationForm.reason || undefined);
        alert(`Списано ${xpOperationForm.amount} XP`);
      }
      closeStudentEdit();
    } catch (err: any) {
      console.error('XP operation error:', err);
      alert(err.message || 'Ошибка операции');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleSaveTrainerAssignment = async () => {
    if (!selectedStudent || !onUpdateTrainerAssignment) return;
    setSavingStudent(true);
    try {
      await onUpdateTrainerAssignment(
        selectedStudent.id, 
        trainerAssignForm.city || null, 
        trainerAssignForm.branch || null
      );
      alert('Назначение сохранено');
      closeStudentEdit();
    } catch (err: any) {
      console.error('Save assignment error:', err);
      alert(err.message || 'Ошибка сохранения');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleUpdateRole = async (role: string) => {
    if (!selectedStudent || !onUpdateStudentRole) return;
    setSavingStudent(true);
    try {
      await onUpdateStudentRole(selectedStudent.id, role);
      setSelectedStudent(prev => prev ? { ...prev, role: role as any } : null);
      closeStudentEdit();
    } catch (err: any) {
      console.error('Update role error:', err);
      alert(err.message || 'Ошибка изменения роли');
    } finally {
      setSavingStudent(false);
    }
  };

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
    if (!qrForm.city || !qrForm.branch) return;

    // If using a preset
    const preset = selectedPreset ? trainingPresets.find(p => p.name === selectedPreset) : null;
    const title = qrForm.title || (preset ? preset.name : '');

    if (!title) return;

    // Calculate expiry date if set
    let expiresAt: string | undefined;
    if (qrForm.expiresIn) {
      const hours = parseInt(qrForm.expiresIn);
      if (hours > 0) {
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }
    }

    const qrData: any = {
      id: `qr_${Date.now()}`,
      title,
      city: qrForm.city,
      branch: qrForm.branch,
      createdAt: new Date().toISOString(),
      isTrainingPreset: qrForm.isTrainingPreset,
    };

    if (preset) {
      // Training preset with multiple skills
      qrData.skills = preset.skills;
      qrData.xpAmount = preset.skills.reduce((sum: number, s: any) => sum + s.xpAmount, 0);
    } else {
      // Custom QR
      qrData.xpAmount = qrForm.xpAmount;
      qrData.skillId = qrForm.skillId || undefined;
    }

    if (qrForm.achievementId) qrData.achievementId = qrForm.achievementId;
    if (qrForm.maxUses) qrData.maxUses = parseInt(qrForm.maxUses);
    if (expiresAt) qrData.expiresAt = expiresAt;

    onAddQR(qrData);
    setQrForm({ title: '', city: '', branch: '', xpAmount: 150, skillId: '', achievementId: '', isTrainingPreset: true, maxUses: '', expiresIn: '' });
    setSelectedPreset(null);
  };

  // Generate QR code URL
  const getQRCodeUrl = (qrId: string) => {
    // This URL would be used for scanning - in a real app, it might be a deep link
    const baseUrl = window.location.origin;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${baseUrl}/scan/${qrId}`)}`;
  };

  const handleSaveAchievement = () => {
    if (!achForm.title) return;
    const conditions: AchievementConditions = {};
    if (achForm.minLevel > 0) conditions.minLevel = achForm.minLevel;
    if (achForm.minTrainings > 0) conditions.minTrainings = achForm.minTrainings;
    if (achForm.minStreak > 0) conditions.minStreak = achForm.minStreak;
    if (achForm.minTotalXp > 0) conditions.minTotalXp = achForm.minTotalXp;
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
    
    cancelEditAchievement();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      <div className="mx-4 flex bg-[#f2f2f7] p-1 rounded-xl overflow-x-auto no-scrollbar gap-1">
        {[
          { id: 'stats', label: 'Стат', icon: BarChart3 },
          { id: 'students', label: 'Ученики', icon: Users },
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
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-[#e5e5e5]">
              <p className="text-[10px] font-bold text-[#6b7280] uppercase mb-1">Всего учеников</p>
              <p className="text-[24px] font-bold text-[#1a1a1a]">{stats.totalStudents}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-[#e5e5e5]">
              <p className="text-[10px] font-bold text-[#6b7280] uppercase mb-1">Общий XP сети</p>
              <p className="text-[20px] font-bold text-[#007aff] truncate">{stats.totalXp.toLocaleString()}</p>
            </div>
          </div>

          <div className="ios-section-title px-0">Рейтинг филиалов</div>
          <div className="ios-list-group mx-0">
            {(Object.entries(stats.branchStats) as [string, { xp: number; count: number; city: string }][]).sort((a,b) => b[1].xp - a[1].xp).map(([key, data]) => (
              <div key={key} className="ios-list-item">
                <div className="flex flex-col">
                  <span className="font-bold text-[15px] text-[#1a1a1a]">{key.split(':')[1]}</span>
                  <span className="text-[10px] text-[#6b7280]">{data.city} • {data.count} чел.</span>
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
              className="flex-1 bg-white p-4 rounded-2xl border border-[#e5e5e5] outline-none text-[#1a1a1a]" 
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
          {(Object.entries(cityBranches) as [string, string[]][]).map(([city, branches]) => (
            <div key={city} className="bg-white rounded-3xl p-4 shadow-sm border border-[#e5e5e5] space-y-4">
              <div className="flex justify-between items-center border-b border-[#f2f2f7] pb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#007aff]" />
                  <span className="font-bold text-[17px] text-[#1a1a1a]">{city}</span>
                </div>
                <button onClick={() => onRemoveCity(city)} className="text-[#ff3b30] p-1"><Trash2 size={16}/></button>
              </div>
              
              <div className="space-y-2">
                {branches.map(branch => (
                  <div key={branch} className="flex justify-between items-center bg-[#f2f2f7] p-3 rounded-xl">
                    <span className="text-[14px] font-medium text-[#1a1a1a]">{branch}</span>
                    <button onClick={() => onRemoveBranch(city, branch)} className="text-[#6b7280]"><X size={14}/></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <input 
                  placeholder="Добавить филиал..." 
                  className="flex-1 bg-[#f2f2f7] px-3 py-2 rounded-xl text-[13px] outline-none text-[#1a1a1a]"
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
              <span className="text-[#1a1a1a]">Опыт за 1 уровень</span>
              <input 
                type="number" 
                className="text-right w-24 bg-transparent font-bold text-[#007aff] outline-none"
                value={xpConfig.xpPerLevel}
                onChange={e => onUpdateXpConfig({...xpConfig, xpPerLevel: Number(e.target.value)})}
              />
            </div>
            <div className="ios-list-item">
              <span className="text-[#1a1a1a]">Множитель сложности</span>
              <input 
                type="number" 
                step="0.1"
                className="text-right w-24 bg-transparent font-bold text-[#007aff] outline-none"
                value={xpConfig.multiplier}
                onChange={e => onUpdateXpConfig({...xpConfig, multiplier: Number(e.target.value)})}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#6b7280] px-2 italic">
            Изменение этих параметров мгновенно пересчитает прогресс-бары всех учеников.
          </p>
        </div>
      )}

      {/* Existing Tabs: achievements, skills_mgmt, qr */}
      {activeSubTab === 'skills_mgmt' && (
        <div className="space-y-4 px-4">
          <div className="ios-section-title px-0">Добавить навык</div>
          <div className="bg-white rounded-2xl p-3 flex gap-2 border border-[#e5e5e5]">
            <input placeholder="Название..." className="flex-1 bg-transparent outline-none p-2 text-[#1a1a1a]" value={newSkillLabel} onChange={e => setNewSkillLabel(e.target.value)}/>
            <button onClick={() => {if(newSkillLabel){onAddSkillDefinition(newSkillLabel);setNewSkillLabel('');}}} className="bg-[#007aff] text-white p-3 rounded-xl"><Plus size={20}/></button>
          </div>
          <div className="ios-list-group mx-0 mt-4">
            {skillDefinitions.map(def => (
              <div key={def.id} className="ios-list-item">
                <span className="font-medium text-[#1a1a1a]">{def.label}</span>
                <button onClick={() => onToggleSkill(def.id)}>
                   {enabledSkills.includes(def.id) ? <ToggleRight size={36} className="text-[#4cd964]"/> : <ToggleLeft size={36} className="text-[#c6c6c8]"/>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'qr' && (
        <div className="space-y-4 px-4 pb-12">
          <div className="ios-section-title px-0">🎯 QR для тренировки</div>
          
          {/* Training preset selection */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[12px] text-blue-700 font-medium">
                Выберите тип тренировки:
              </p>
              <button
                onClick={() => { setShowPresetEditor(!showPresetEditor); setEditingPresetIdx(null); setPresetForm({ name: '', skills: [{ skillId: enabledSkillDefinitions[0]?.id || '', xpAmount: 10 }] }); }}
                className="text-[11px] text-blue-600 font-bold bg-white/80 px-2 py-1 rounded-lg border border-blue-200"
              >
                {showPresetEditor ? '✕ Закрыть' : '⚙ Настроить типы'}
              </button>
            </div>

            {/* Preset editor */}
            {showPresetEditor && (
              <div className="mb-4 space-y-3 bg-white/70 p-3 rounded-xl border border-blue-200">
                <div className="text-[12px] font-bold text-blue-800">
                  {editingPresetIdx !== null ? 'Редактировать тип' : 'Новый тип тренировки'}
                </div>
                <input
                  placeholder="Название (например, Атака + Блок)"
                  className="w-full bg-white p-2.5 rounded-lg border border-[#e5e5e5] outline-none text-[13px]"
                  value={presetForm.name}
                  onChange={e => setPresetForm({ ...presetForm, name: e.target.value })}
                />
                <div className="text-[11px] text-[#6b7280] font-medium">Навыки и XP:</div>
                {presetForm.skills.map((skill, si) => (
                  <div key={si} className="flex gap-2 items-center">
                    <select
                      className="flex-1 bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none text-[12px]"
                      value={skill.skillId}
                      onChange={e => {
                        const updated = [...presetForm.skills];
                        updated[si] = { ...updated[si], skillId: e.target.value };
                        setPresetForm({ ...presetForm, skills: updated });
                      }}
                    >
                      <option value="">Выберите навык</option>
                      {enabledSkillDefinitions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="XP"
                      className="w-16 bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none text-[12px] text-center"
                      value={skill.xpAmount}
                      onChange={e => {
                        const updated = [...presetForm.skills];
                        updated[si] = { ...updated[si], xpAmount: Number(e.target.value) || 0 };
                        setPresetForm({ ...presetForm, skills: updated });
                      }}
                    />
                    {presetForm.skills.length > 1 && (
                      <button
                        onClick={() => setPresetForm({ ...presetForm, skills: presetForm.skills.filter((_, i) => i !== si) })}
                        className="text-[#ff3b30] p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setPresetForm({ ...presetForm, skills: [...presetForm.skills, { skillId: enabledSkillDefinitions[0]?.id || '', xpAmount: 10 }] })}
                  className="text-[11px] text-[#007aff] font-bold flex items-center gap-1"
                >
                  <Plus size={12} /> Добавить навык
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!presetForm.name || presetForm.skills.some(s => !s.skillId || s.xpAmount <= 0)) {
                        alert('Заполните название и все навыки');
                        return;
                      }
                      const updated = [...customPresets];
                      if (editingPresetIdx !== null) {
                        updated[editingPresetIdx] = presetForm;
                      } else {
                        updated.push(presetForm);
                      }
                      savePresets(updated);
                      setPresetForm({ name: '', skills: [{ skillId: enabledSkillDefinitions[0]?.id || '', xpAmount: 10 }] });
                      setEditingPresetIdx(null);
                    }}
                    className="flex-1 bg-[#007aff] text-white py-2 rounded-xl text-[12px] font-bold"
                  >
                    {editingPresetIdx !== null ? 'Сохранить' : 'Добавить тип'}
                  </button>
                  {editingPresetIdx !== null && (
                    <button
                      onClick={() => { setEditingPresetIdx(null); setPresetForm({ name: '', skills: [{ skillId: enabledSkillDefinitions[0]?.id || '', xpAmount: 10 }] }); }}
                      className="bg-[#f2f2f7] text-[#6b7280] py-2 px-4 rounded-xl text-[12px] font-bold"
                    >
                      Отмена
                    </button>
                  )}
                </div>

                {/* Existing presets list */}
                <div className="border-t border-blue-200 pt-3 mt-2 space-y-2">
                  <div className="text-[11px] font-bold text-blue-800">Текущие типы тренировок:</div>
                  {customPresets.map((p, idx) => {
                    const allEnabled = p.skills.every(s => enabledSkills.includes(s.skillId));
                    return (
                      <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${allEnabled ? 'bg-white' : 'bg-gray-100 opacity-60'}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-bold text-[#1a1a1a] truncate block">{p.name}</span>
                          <span className="text-[10px] text-[#6b7280]">
                            {p.skills.map(s => `${skillDefinitions.find(d => d.id === s.skillId)?.label || s.skillId}: +${s.xpAmount}`).join(' • ')}
                            {!allEnabled && ' (навыки выключены)'}
                          </span>
                        </div>
                        <button
                          onClick={() => { setEditingPresetIdx(idx); setPresetForm({ ...p }); }}
                          className="text-[#007aff] p-1"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить "${p.name}"?`)) {
                              const updated = customPresets.filter((_, i) => i !== idx);
                              savePresets(updated);
                              if (selectedPreset === p.name) setSelectedPreset(null);
                            }
                          }}
                          className="text-[#ff3b30] p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {customPresets.length === 0 && (
                    <p className="text-[11px] text-[#8e8e93] text-center py-2">Нет настроенных типов</p>
                  )}
                </div>
              </div>
            )}

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2">
              {trainingPresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setSelectedPreset(selectedPreset === preset.name ? null : preset.name)}
                  className={`px-3 py-2 rounded-xl text-[13px] font-bold transition-all ${
                    selectedPreset === preset.name 
                      ? 'bg-[#007aff] text-white shadow-lg' 
                      : 'bg-white text-[#007aff] border border-[#007aff]/30'
                  }`}
                >
                  {preset.name}
                  <span className="ml-1 text-[10px] opacity-75">
                    +{preset.skills.reduce((s, sk) => s + sk.xpAmount, 0)} XP
                  </span>
                </button>
              ))}
              {trainingPresets.length === 0 && (
                <p className="text-[11px] text-[#8e8e93]">Нет доступных типов. Нажмите "Настроить типы" чтобы добавить.</p>
              )}
            </div>
            {selectedPreset && (
              <div className="mt-3 p-2 bg-white/60 rounded-xl">
                <p className="text-[11px] text-blue-600">
                  <strong>{selectedPreset}:</strong>{' '}
                  {trainingPresets.find(p => p.name === selectedPreset)?.skills.map(s => {
                    const skill = skillDefinitions.find(d => d.id === s.skillId);
                    return `${skill?.label || s.skillId}: +${s.xpAmount} XP`;
                  }).join(' • ')}
                </p>
              </div>
            )}
          </div>

          {/* Location and settings */}
          <div className="ios-list-group mx-0">
            <div className="ios-list-item">
              <span className="text-[#6b7280]">Город</span>
              <select className="bg-transparent outline-none text-[#007aff] font-bold" value={qrForm.city} onChange={e => setQrForm({...qrForm, city: e.target.value, branch: ''})}>
                <option value="">Выберите</option>
                {Object.keys(cityBranches).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="ios-list-item">
              <span className="text-[#6b7280]">Филиал</span>
              <select className="bg-transparent outline-none text-[#007aff] font-bold" value={qrForm.branch} onChange={e => setQrForm({...qrForm, branch: e.target.value})} disabled={!qrForm.city}>
                <option value="">Выберите</option>
                {qrForm.city && cityBranches[qrForm.city].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Optional settings */}
          <div className="ios-section-title px-0">Настройки (опционально)</div>
          <div className="ios-list-group mx-0">
            <div className="ios-list-item">
              <span className="text-[#1a1a1a]">Заголовок</span>
              <input 
                placeholder={selectedPreset || "Введите заголовок"}
                className="text-right flex-1 outline-none text-[#007aff] font-bold" 
                value={qrForm.title} 
                onChange={e => setQrForm({...qrForm, title: e.target.value})}
              />
            </div>
            <div className="ios-list-item">
              <span className="text-[#1a1a1a]">Макс. сканирований</span>
              <input 
                type="number" 
                placeholder="∞"
                className="text-right w-20 outline-none text-[#007aff] font-bold" 
                value={qrForm.maxUses} 
                onChange={e => setQrForm({...qrForm, maxUses: e.target.value})}
              />
            </div>
            <div className="ios-list-item">
              <span className="text-[#1a1a1a]">Действует (часов)</span>
              <input 
                type="number" 
                placeholder="∞"
                className="text-right w-20 outline-none text-[#007aff] font-bold" 
                value={qrForm.expiresIn} 
                onChange={e => setQrForm({...qrForm, expiresIn: e.target.value})}
              />
            </div>
          </div>

          <button 
            onClick={handleCreateQR} 
            disabled={!qrForm.city || !qrForm.branch || (!selectedPreset && !qrForm.title)}
            className="w-full bg-[#007aff] text-white py-4 rounded-3xl font-bold active-scale shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <QrCode size={20} />
            Создать QR для тренировки
          </button>

          {/* Active QR Codes */}
          <div className="ios-section-title px-0 mt-8">📱 Активные QR коды</div>
          {qrCodes.length === 0 ? (
            <div className="text-center py-8 text-[#8e8e93]">
              <QrCode size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">Нет активных QR-кодов</p>
            </div>
          ) : (
            <div className="space-y-3">
              {qrCodes.map(qr => (
                <div key={qr.id} className="bg-white p-4 rounded-3xl border border-[#e5e5e5] shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-sm">
                      <QrCode size={28} className="text-white"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[15px] text-[#1a1a1a] truncate">{qr.title}</h4>
                      <p className="text-[11px] text-[#6b7280]">{qr.city}, {qr.branch}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="bg-[#34c759]/10 text-[#34c759] px-2 py-0.5 rounded-full text-[10px] font-bold">
                          +{qr.xpAmount} XP
                        </span>
                        {qr.skills && qr.skills.map((s, si) => {
                          const skill = skillDefinitions.find(d => d.id === s.skillId);
                          return (
                            <span key={si} className="bg-[#007aff]/10 text-[#007aff] px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {skill?.label || s.skillId}: +{s.xpAmount}
                            </span>
                          );
                        })}
                        {!qr.skills && qr.skillId && (
                          <span className="bg-[#007aff]/10 text-[#007aff] px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {skillDefinitions.find(d => d.id === qr.skillId)?.label || qr.skillId}
                          </span>
                        )}
                        {qr.maxUses && (
                          <span className="bg-[#ff9500]/10 text-[#ff9500] px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {qr.usesCount || 0}/{qr.maxUses}
                          </span>
                        )}
                        {qr.expiresAt && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            new Date(qr.expiresAt) < new Date() 
                              ? 'bg-[#ff3b30]/10 text-[#ff3b30]' 
                              : 'bg-[#8e8e93]/10 text-[#8e8e93]'
                          }`}>
                            {new Date(qr.expiresAt) < new Date() ? 'Истёк' : 'До ' + new Date(qr.expiresAt).toLocaleTimeString('ru', {hour: '2-digit', minute: '2-digit'})}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#f2f2f7]">
                    <button 
                      onClick={() => setShowQRModal(qr.id)} 
                      className="flex-1 bg-[#007aff]/10 text-[#007aff] py-2 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1"
                    >
                      <QrCode size={16} /> Показать QR
                    </button>
                    <button 
                      onClick={() => onRemoveQR(qr.id)} 
                      className="bg-[#ff3b30]/10 text-[#ff3b30] p-2 rounded-xl"
                    >
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* QR Modal */}
          {showQRModal && (
            <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowQRModal(null)}>
              <div className="bg-white w-full max-w-sm rounded-3xl p-6 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                {(() => {
                  const qr = qrCodes.find(q => q.id === showQRModal);
                  if (!qr) return null;
                  return (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-[18px] font-bold text-[#1a1a1a]">{qr.title}</h3>
                          <p className="text-[13px] text-[#6b7280]">{qr.city}, {qr.branch}</p>
                        </div>
                        <button onClick={() => setShowQRModal(null)} className="p-2 text-[#6b7280]">
                          <X size={20} />
                        </button>
                      </div>
                      
                      {/* QR Code Image */}
                      <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-[#e5e5e5] flex items-center justify-center mb-4">
                        <img 
                          src={getQRCodeUrl(qr.id)} 
                          alt="QR Code" 
                          className="w-48 h-48"
                        />
                      </div>

                      <div className="bg-[#f2f2f7] p-3 rounded-xl mb-4">
                        <p className="text-[11px] text-[#6b7280] text-center">
                          Покажите этот QR-код ученикам для сканирования
                        </p>
                        <p className="text-[12px] text-[#34c759] text-center font-bold mt-1">
                          +{qr.xpAmount} XP за сканирование
                        </p>
                        {qr.skills && (
                          <p className="text-[10px] text-[#8e8e93] text-center mt-1">
                            {qr.skills.map(s => {
                              const skill = skillDefinitions.find(d => d.id === s.skillId);
                              return `${skill?.label || s.skillId}: +${s.xpAmount}`;
                            }).join(' • ')}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = getQRCodeUrl(qr.id);
                            link.download = `qr-${qr.title}.png`;
                            link.click();
                          }}
                          className="flex-1 bg-[#007aff] text-white py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2"
                        >
                          <Download size={18} /> Скачать
                        </button>
                        <button 
                          onClick={() => window.print()}
                          className="bg-[#f2f2f7] text-[#1a1a1a] p-3 rounded-xl"
                        >
                          <Printer size={18} />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'achievements' && (
        <div className="space-y-4 px-4 pb-12">
          <div className="ios-section-title px-0 flex justify-between items-center">
            <span>{editingAchId ? 'Редактировать награду' : 'Новая награда'}</span>
            {editingAchId && (
              <button onClick={cancelEditAchievement} className="text-[#ff3b30] text-[12px] font-bold">Отмена</button>
            )}
          </div>
          <div className="ios-list-group mx-0">
            <div className="ios-list-item">
              <input placeholder="Название" className="w-full outline-none bg-transparent font-bold text-[#1a1a1a]" value={achForm.title} onChange={e => setAchForm({...achForm, title: e.target.value})}/>
            </div>
            <div className="ios-list-item">
              <textarea placeholder="Описание" className="w-full outline-none bg-transparent text-[14px] min-h-[60px] text-[#1a1a1a]" value={achForm.description} onChange={e => setAchForm({...achForm, description: e.target.value})}/>
            </div>
            <div className="ios-list-item">
              <input placeholder="URL иконки (опционально)" className="w-full outline-none bg-transparent text-[13px] text-[#6b7280]" value={achForm.imageUrl} onChange={e => setAchForm({...achForm, imageUrl: e.target.value})}/>
            </div>
          </div>
          
          <div className="ios-section-title px-0">Условия получения</div>
          <div className="ios-list-group mx-0">
             <div className="ios-list-item">
               <span className="text-[#1a1a1a]">Мин. Уровень</span>
               <input type="number" min="0" className="text-right w-20 outline-none text-[#007aff] font-bold" value={achForm.minLevel} onChange={e => setAchForm({...achForm, minLevel: Number(e.target.value)})}/>
             </div>
             <div className="ios-list-item">
               <span className="text-[#1a1a1a]">Мин. тренировок</span>
               <input type="number" min="0" className="text-right w-20 outline-none text-[#007aff] font-bold" value={achForm.minTrainings} onChange={e => setAchForm({...achForm, minTrainings: Number(e.target.value)})}/>
             </div>
             <div className="ios-list-item">
               <div className="flex items-center gap-1">
                 <Flame size={14} className="text-[#ff3b30]"/>
                 <span className="text-[#1a1a1a]">Мин. стрик (дней)</span>
               </div>
               <input type="number" min="0" className="text-right w-20 outline-none text-[#007aff] font-bold" value={achForm.minStreak} onChange={e => setAchForm({...achForm, minStreak: Number(e.target.value)})}/>
             </div>
             <div className="ios-list-item">
               <div className="flex items-center gap-1">
                 <Zap size={14} className="text-[#ff9500]"/>
                 <span className="text-[#1a1a1a]">Мин. общий XP</span>
               </div>
               <input type="number" min="0" className="text-right w-24 outline-none text-[#007aff] font-bold" value={achForm.minTotalXp} onChange={e => setAchForm({...achForm, minTotalXp: Number(e.target.value)})}/>
             </div>
          </div>

          <div className="ios-section-title px-0">Условие по навыку</div>
          <div className="ios-list-group mx-0">
             <div className="ios-list-item">
               <span className="text-[#1a1a1a]">Навык</span>
               <select className="bg-transparent outline-none text-[#007aff] font-bold" value={achForm.skillLimit} onChange={e => setAchForm({...achForm, skillLimit: e.target.value})}>
                 <option value="">Не выбран</option>
                 {skillDefinitions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
               </select>
             </div>
             <div className="ios-list-item">
               <span className="text-[#1a1a1a]">Мин. значение навыка</span>
               <input type="number" min="0" className="text-right w-20 outline-none text-[#007aff] font-bold" value={achForm.skillValue} onChange={e => setAchForm({...achForm, skillValue: Number(e.target.value)})} disabled={!achForm.skillLimit}/>
             </div>
          </div>
          
          <button onClick={handleSaveAchievement} className="w-full bg-[#007aff] text-white py-4 rounded-3xl font-bold active-scale shadow-lg">
            {editingAchId ? 'Сохранить изменения' : 'Создать награду'}
          </button>

          <div className="ios-section-title px-0 mt-8">Список наград ({achievements.length})</div>
          <div className="space-y-3">
            {achievements.map(ach => (
              <div key={ach.id} className={`bg-white p-3 rounded-2xl border shadow-sm ${editingAchId === ach.id ? 'border-[#007aff] ring-2 ring-[#007aff]/20' : 'border-[#e5e5e5]'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                    {ach.imageUrl ? <img src={ach.imageUrl} className="w-full h-full object-cover" alt="" /> : <Award className="text-[#ff9500]"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[14px] text-[#1a1a1a] truncate">{ach.title}</h4>
                    <p className="text-[11px] text-[#6b7280] truncate">{ach.description}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {editingAchId === ach.id ? (
                      <span className="text-[10px] text-[#007aff] font-bold px-2 py-1 bg-[#007aff]/10 rounded-lg">Редактируется</span>
                    ) : (
                      <>
                        <button onClick={() => startEditAchievement(ach)} className="text-[#007aff] p-2 bg-[#007aff]/10 rounded-xl"><Edit2 size={16}/></button>
                        <button onClick={() => onRemoveAchievement(ach.id)} className="text-[#ff3b30] p-2 bg-[#ff3b30]/10 rounded-xl"><Trash2 size={16}/></button>
                      </>
                    )}
                  </div>
                </div>
                {/* Show conditions summary */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {ach.conditions.minLevel && <span className="text-[9px] bg-[#007aff]/10 text-[#007aff] px-2 py-0.5 rounded-full">Ур. {ach.conditions.minLevel}+</span>}
                  {ach.conditions.minTrainings && <span className="text-[9px] bg-[#ff9500]/10 text-[#ff9500] px-2 py-0.5 rounded-full">{ach.conditions.minTrainings} трен.</span>}
                  {ach.conditions.minStreak && <span className="text-[9px] bg-[#ff3b30]/10 text-[#ff3b30] px-2 py-0.5 rounded-full">{ach.conditions.minStreak} дн. стрик</span>}
                  {ach.conditions.minTotalXp && <span className="text-[9px] bg-[#5856d6]/10 text-[#5856d6] px-2 py-0.5 rounded-full">{ach.conditions.minTotalXp.toLocaleString()} XP</span>}
                  {ach.conditions.minSkillValue && <span className="text-[9px] bg-[#4cd964]/10 text-[#4cd964] px-2 py-0.5 rounded-full">{skillDefinitions.find(s=>s.id===ach.conditions.minSkillValue?.skill)?.label || ach.conditions.minSkillValue.skill} {ach.conditions.minSkillValue.value}+</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'students' && (
        <div className="space-y-4 px-4 pb-12">
          {/* Student Edit Modal */}
          {selectedStudent && studentEditMode && (
            <div className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center">
              <div className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <img src={selectedStudent.avatar} className="w-10 h-10 rounded-full bg-gray-100" />
                    <div>
                      <h3 className="text-[16px] font-bold text-[#1a1a1a]">{selectedStudent.name}</h3>
                      <p className="text-[11px] text-[#6b7280]">{selectedStudent.city} • {selectedStudent.branch}</p>
                    </div>
                  </div>
                  <button onClick={closeStudentEdit} className="p-2 text-[#6b7280]"><X size={24} /></button>
                </div>

                {/* Stats Edit Mode */}
                {studentEditMode === 'stats' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">Редактировать статистику</div>
                    <div className="ios-list-group mx-0">
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Уровень</span>
                        <input type="number" min="1" className="text-right w-20 outline-none text-[#007aff] font-bold" value={studentStatsForm.level} onChange={e => setStudentStatsForm({...studentStatsForm, level: Number(e.target.value)})}/>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Текущий XP</span>
                        <input type="number" min="0" className="text-right w-24 outline-none text-[#007aff] font-bold" value={studentStatsForm.xp} onChange={e => setStudentStatsForm({...studentStatsForm, xp: Number(e.target.value)})}/>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Общий XP</span>
                        <input type="number" min="0" className="text-right w-24 outline-none text-[#007aff] font-bold" value={studentStatsForm.totalXp} onChange={e => setStudentStatsForm({...studentStatsForm, totalXp: Number(e.target.value)})}/>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Тренировок</span>
                        <input type="number" min="0" className="text-right w-20 outline-none text-[#007aff] font-bold" value={studentStatsForm.trainingsCompleted} onChange={e => setStudentStatsForm({...studentStatsForm, trainingsCompleted: Number(e.target.value)})}/>
                      </div>
                      <div className="ios-list-item">
                        <div className="flex items-center gap-1">
                          <Flame size={14} className="text-[#ff3b30]"/>
                          <span className="text-[#1a1a1a]">Стрик (дней)</span>
                        </div>
                        <input type="number" min="0" className="text-right w-20 outline-none text-[#007aff] font-bold" value={studentStatsForm.streak} onChange={e => setStudentStatsForm({...studentStatsForm, streak: Number(e.target.value)})}/>
                      </div>
                    </div>
                    <button onClick={handleSaveStudentStats} disabled={savingStudent} className="w-full bg-[#007aff] text-white py-4 rounded-2xl font-bold active-scale disabled:opacity-50">
                      {savingStudent ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                )}

                {/* Profile Edit Mode */}
                {studentEditMode === 'profile' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">Редактировать профиль</div>
                    <div className="ios-list-group mx-0">
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Имя</span>
                        <input 
                          type="text" 
                          className="text-right w-40 outline-none text-[#007aff] font-bold" 
                          value={studentProfileForm.name} 
                          onChange={e => setStudentProfileForm({...studentProfileForm, name: e.target.value})}
                        />
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">URL фото</span>
                        <input 
                          type="text" 
                          className="text-right w-48 outline-none text-[#007aff] font-bold text-[12px]" 
                          value={studentProfileForm.avatar} 
                          onChange={e => setStudentProfileForm({...studentProfileForm, avatar: e.target.value})}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Город</span>
                        <select 
                          className="bg-transparent outline-none text-[#007aff] font-bold" 
                          value={studentProfileForm.city} 
                          onChange={e => setStudentProfileForm({...studentProfileForm, city: e.target.value, branch: ''})}
                        >
                          {Object.keys(cityBranches).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Филиал</span>
                        <select 
                          className="bg-transparent outline-none text-[#007aff] font-bold" 
                          value={studentProfileForm.branch} 
                          onChange={e => setStudentProfileForm({...studentProfileForm, branch: e.target.value})}
                          disabled={!studentProfileForm.city}
                        >
                          <option value="">Выберите</option>
                          {studentProfileForm.city && cityBranches[studentProfileForm.city]?.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                    {studentProfileForm.avatar && (
                      <div className="flex justify-center">
                        <img src={studentProfileForm.avatar} className="w-20 h-20 rounded-full bg-gray-100" alt="Preview" />
                      </div>
                    )}
                    <button onClick={handleSaveStudentProfile} disabled={savingStudent} className="w-full bg-[#007aff] text-white py-4 rounded-2xl font-bold active-scale disabled:opacity-50">
                      {savingStudent ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                )}

                {/* Role Edit Mode */}
                {studentEditMode === 'role' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">Изменить роль</div>
                    <div className="space-y-2">
                      {['STUDENT', 'TRAINER', 'ADMIN'].map(role => (
                        <button
                          key={role}
                          onClick={() => handleUpdateRole(role)}
                          disabled={savingStudent || selectedStudent.role === role}
                          className={`w-full p-4 rounded-2xl border-2 font-bold text-[14px] transition-all ${
                            selectedStudent.role === role
                              ? 'bg-[#007aff] text-white border-[#007aff]'
                              : 'bg-white text-[#1a1a1a] border-[#e5e5e5] active-scale'
                          } disabled:opacity-50`}
                        >
                          {role === 'STUDENT' ? 'Ученик' : role === 'TRAINER' ? 'Тренер' : 'Администратор'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* XP Operation Mode */}
                {studentEditMode === 'xp' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">Операция с XP</div>
                    <div className="ios-list-group mx-0">
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Операция</span>
                        <select 
                          className="bg-transparent outline-none text-[#007aff] font-bold" 
                          value={xpOperationForm.operation} 
                          onChange={e => setXpOperationForm({...xpOperationForm, operation: e.target.value as 'add' | 'deduct'})}
                        >
                          <option value="add">Начислить</option>
                          <option value="deduct">Списать</option>
                        </select>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Количество XP</span>
                        <input 
                          type="number" 
                          min="1" 
                          className="text-right w-24 outline-none text-[#007aff] font-bold" 
                          value={xpOperationForm.amount} 
                          onChange={e => setXpOperationForm({...xpOperationForm, amount: Number(e.target.value)})}
                        />
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Навык (опционально)</span>
                        <select 
                          className="bg-transparent outline-none text-[#007aff] font-bold" 
                          value={xpOperationForm.skillId} 
                          onChange={e => setXpOperationForm({...xpOperationForm, skillId: e.target.value})}
                        >
                          <option value="">Общий XP</option>
                          {enabledSkillDefinitions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div className="ios-list-item">
                        <input 
                          type="text"
                          placeholder="Причина (опционально)"
                          className="w-full outline-none bg-transparent text-[#1a1a1a] text-[14px]" 
                          value={xpOperationForm.reason} 
                          onChange={e => setXpOperationForm({...xpOperationForm, reason: e.target.value})}
                        />
                      </div>
                    </div>
                    {xpOperationForm.operation === 'deduct' && (
                      <p className="text-[11px] text-[#ff3b30] bg-[#ff3b30]/10 p-3 rounded-xl">
                        ⚠️ Вычитание XP уменьшит общий опыт ученика. Операция будет записана в историю.
                      </p>
                    )}
                    <button 
                      onClick={handleXpOperation} 
                      disabled={savingStudent} 
                      className={`w-full py-4 rounded-2xl font-bold active-scale disabled:opacity-50 ${
                        xpOperationForm.operation === 'deduct' 
                          ? 'bg-[#ff3b30] text-white' 
                          : 'bg-[#007aff] text-white'
                      }`}
                    >
                      {savingStudent ? 'Обработка...' : (xpOperationForm.operation === 'add' ? `Начислить ${xpOperationForm.amount} XP` : `Списать ${xpOperationForm.amount} XP`)}
                    </button>
                  </div>
                )}

                {/* XP History Mode */}
                {studentEditMode === 'history' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">История XP операций</div>
                    {loadingHistory ? (
                      <div className="text-center py-8 text-[#8e8e93]">Загрузка...</div>
                    ) : xpHistory.length === 0 ? (
                      <div className="text-center py-8 text-[#8e8e93]">
                        <History size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[14px]">Нет записей</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {xpHistory.map(h => (
                          <div key={h.id} className={`p-3 rounded-xl border ${
                            h.xpEarned < 0 ? 'bg-[#ff3b30]/5 border-[#ff3b30]/20' : 'bg-[#34c759]/5 border-[#34c759]/20'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-[14px] ${h.xpEarned < 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
                                    {h.xpEarned > 0 ? '+' : ''}{h.xpEarned} XP
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f2f2f7] text-[#6b7280] font-bold">
                                    {h.source === 'xp_bonus' ? 'Начисление' : 
                                     h.source === 'xp_deduction' ? 'Списание' :
                                     h.source === 'training' ? 'Тренировка' :
                                     h.source === 'preset' ? 'Пресет' :
                                     h.source === 'qr' ? 'QR' : h.source}
                                  </span>
                                </div>
                                {h.skillFocus && h.skillFocus !== 'general' && (
                                  <p className="text-[11px] text-[#6b7280] mt-1">
                                    Навык: {skillDefinitions.find(s => s.id === h.skillFocus)?.label || h.skillFocus}
                                  </p>
                                )}
                                {h.reason && (
                                  <p className="text-[11px] text-[#374151] mt-1 italic">
                                    Причина: {h.reason}
                                  </p>
                                )}
                                {h.operatorName && (
                                  <p className="text-[10px] text-[#8e8e93] mt-1">
                                    Выполнил: {h.operatorName}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] text-[#8e8e93] whitespace-nowrap ml-2">
                                {new Date(h.createdAt).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Trainer Assignment Mode */}
                {studentEditMode === 'assignment' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">Зона ответственности тренера</div>
                    <p className="text-[11px] text-[#6b7280] bg-[#f2f2f7] p-3 rounded-xl">
                      Укажите город и филиал, за который отвечает тренер. Тренер сможет начислять и списывать XP только ученикам в своей зоне.
                    </p>
                    <div className="ios-list-group mx-0">
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Город</span>
                        <select 
                          className="bg-transparent outline-none text-[#007aff] font-bold" 
                          value={trainerAssignForm.city} 
                          onChange={e => setTrainerAssignForm({...trainerAssignForm, city: e.target.value, branch: ''})}
                        >
                          <option value="">Не назначен</option>
                          {Object.keys(cityBranches).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="ios-list-item">
                        <span className="text-[#1a1a1a]">Филиал</span>
                        <select 
                          className="bg-transparent outline-none text-[#007aff] font-bold" 
                          value={trainerAssignForm.branch} 
                          onChange={e => setTrainerAssignForm({...trainerAssignForm, branch: e.target.value})}
                          disabled={!trainerAssignForm.city}
                        >
                          <option value="">Все филиалы в городе</option>
                          {trainerAssignForm.city && cityBranches[trainerAssignForm.city]?.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={handleSaveTrainerAssignment} disabled={savingStudent} className="w-full bg-[#007aff] text-white py-4 rounded-2xl font-bold active-scale disabled:opacity-50">
                      {savingStudent ? 'Сохранение...' : 'Сохранить назначение'}
                    </button>
                  </div>
                )}

                {/* Achievements Edit Mode */}
                {studentEditMode === 'achievements' && (
                  <div className="space-y-4">
                    <div className="ios-section-title px-0">Управление наградами</div>
                    <div className="space-y-2">
                      {achievements.map(ach => {
                        const hasAchievement = selectedStudent.achievements.includes(ach.id);
                        return (
                          <div key={ach.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${hasAchievement ? 'bg-[#4cd964]/10 border-[#4cd964]' : 'bg-white border-[#e5e5e5]'}`}>
                            <div className="w-10 h-10 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                              {ach.imageUrl ? <img src={ach.imageUrl} className="w-full h-full object-cover" alt="" /> : <Award className="text-[#ff9500]" size={20}/>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[13px] text-[#1a1a1a] truncate">{ach.title}</p>
                              <p className="text-[10px] text-[#6b7280] truncate">{ach.description}</p>
                            </div>
                            <button 
                              onClick={() => handleToggleStudentAchievement(ach.id)}
                              disabled={savingStudent}
                              className={`p-2 rounded-xl ${hasAchievement ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#4cd964]/10 text-[#4cd964]'}`}
                            >
                              {hasAchievement ? <X size={18}/> : <Check size={18}/>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="ios-section-title px-0">Фильтры</div>
          <div className="space-y-2">
            {/* Search */}
            <input 
              placeholder="🔍 Поиск по имени..." 
              className="w-full bg-white p-3 rounded-xl border border-[#e5e5e5] outline-none text-[13px] text-[#1a1a1a]"
              value={studentFilter.search}
              onChange={e => setStudentFilter({...studentFilter, search: e.target.value})}
            />
            {/* Selects row */}
            <div className="grid grid-cols-2 gap-2">
              <select 
                className="w-full bg-white p-2.5 rounded-xl border border-[#e5e5e5] outline-none text-[12px] text-[#007aff]"
                value={studentFilter.city}
                onChange={e => setStudentFilter({...studentFilter, city: e.target.value, branch: ''})}
              >
                <option value="">Все города</option>
                {Object.keys(cityBranches).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                className="w-full bg-white p-2.5 rounded-xl border border-[#e5e5e5] outline-none text-[12px] text-[#007aff]"
                value={studentFilter.branch}
                onChange={e => setStudentFilter({...studentFilter, branch: e.target.value})}
                disabled={!studentFilter.city}
              >
                <option value="">Все филиалы</option>
                {studentFilter.city && cityBranches[studentFilter.city]?.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <select 
              className="w-full bg-white p-2.5 rounded-xl border border-[#e5e5e5] outline-none text-[12px] text-[#007aff]"
              value={studentFilter.role}
              onChange={e => setStudentFilter({...studentFilter, role: e.target.value})}
            >
              <option value="">Все роли</option>
              <option value="STUDENT">Ученик</option>
              <option value="TRAINER">Тренер</option>
              <option value="ADMIN">Админ</option>
            </select>
            {/* Numeric filters */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <input type="number" placeholder="Мин. ур." className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.minLevel} onChange={e => setStudentFilter({...studentFilter, minLevel: e.target.value})} />
              <input type="number" placeholder="Макс. ур." className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.maxLevel} onChange={e => setStudentFilter({...studentFilter, maxLevel: e.target.value})} />
              <input type="number" placeholder="Мин. трен." className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.minTrainings} onChange={e => setStudentFilter({...studentFilter, minTrainings: e.target.value})} />
              <input type="number" placeholder="Макс. трен." className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.maxTrainings} onChange={e => setStudentFilter({...studentFilter, maxTrainings: e.target.value})} />
              <input type="number" placeholder="Мин. стрик" className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.minStreak} onChange={e => setStudentFilter({...studentFilter, minStreak: e.target.value})} />
              <input type="number" placeholder="Макс. стрик" className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.maxStreak} onChange={e => setStudentFilter({...studentFilter, maxStreak: e.target.value})} />
              <input type="number" placeholder="Мин. XP" className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.minXp} onChange={e => setStudentFilter({...studentFilter, minXp: e.target.value})} />
              <input type="number" placeholder="Макс. XP" className="w-full bg-white p-2 rounded-lg border border-[#e5e5e5] outline-none" value={studentFilter.maxXp} onChange={e => setStudentFilter({...studentFilter, maxXp: e.target.value})} />
            </div>
            <button 
              onClick={() => setStudentFilter({ city: '', branch: '', search: '', minLevel: '', maxLevel: '', minTrainings: '', maxTrainings: '', minStreak: '', maxStreak: '', minXp: '', maxXp: '', role: '' })}
              className="w-full bg-[#f2f2f7] text-[#6b7280] py-2 rounded-xl text-[12px] font-bold"
            >
              Сбросить фильтры
            </button>
          </div>

          {/* Student List */}
          <div className="ios-section-title px-0">Ученики ({filteredStudents.length})</div>
          <div className="space-y-2">
            {filteredStudents.map((student, idx) => (
              <div key={student.id} className="bg-white p-3 rounded-2xl border border-[#e5e5e5] shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[12px] font-bold text-[#6b7280]">{idx + 1}</span>
                  <img src={student.avatar} className="w-10 h-10 rounded-full bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-[#1a1a1a] truncate">{student.name}</p>
                    <p className="text-[10px] text-[#6b7280]">
                      Ур. {student.level} • {student.totalXp.toLocaleString()} XP • {student.trainingsCompleted} трен.
                      {student.streak > 0 && <span className="text-[#ff3b30]"> • {student.streak}🔥</span>}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#f2f2f7]">
                  <button 
                    onClick={() => openStudentEdit(student, 'profile')}
                    className="bg-[#34c759]/10 text-[#34c759] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <ImageIcon size={12}/> Профиль
                  </button>
                  <button 
                    onClick={() => openStudentEdit(student, 'stats')}
                    className="bg-[#007aff]/10 text-[#007aff] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <BarChart3 size={12}/> Статы
                  </button>
                  <button 
                    onClick={() => openStudentEdit(student, 'xp')}
                    className="bg-[#ff9500]/10 text-[#ff9500] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Zap size={12}/> XP
                  </button>
                  <button 
                    onClick={() => openStudentEdit(student, 'role')}
                    className="bg-[#5856d6]/10 text-[#5856d6] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Shield size={12}/> Роль
                  </button>
                  <button 
                    onClick={() => openStudentEdit(student, 'history')}
                    className="bg-[#8e8e93]/10 text-[#8e8e93] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Clock size={12}/> История
                  </button>
                  <button 
                    onClick={() => openStudentEdit(student, 'achievements')}
                    className="bg-[#ff3b30]/10 text-[#ff3b30] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Award size={12}/> Награды
                  </button>
                  {student.role === 'TRAINER' && (
                    <button 
                      onClick={() => openStudentEdit(student, 'assignment')}
                      className="col-span-3 bg-[#5856d6]/10 text-[#5856d6] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1"
                    >
                      <MapPin size={12}/> Зона: {student.assignedCity || student.city || 'Не назначена'}
                      {student.assignedBranch && ` / ${student.assignedBranch}`}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <div className="text-center py-8 text-[#6b7280] text-[14px]">
                Ученики не найдены
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
