
import React from 'react';
import { LayoutGrid, BarChart2, Trophy, User, ArrowLeft, Settings, Shield } from 'lucide-react';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: UserRole;
  title?: string;
  onBack?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, userRole, title, onBack }) => {
  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f5] relative text-[#1a1a1a]">
      <header className="ios-header">
        <div className="h-11 flex items-center justify-between px-4">
          <div className="w-20">
            {onBack && (
              <button onClick={onBack} className="flex items-center text-[#007aff] text-[17px]">
                <ArrowLeft size={20} className="mr-1" />
                <span>Назад</span>
              </button>
            )}
          </div>
          <div className="flex-1 text-center truncate">
            <h1 className="font-semibold text-[17px] text-[#1a1a1a]">
              {title || (activeTab === 'dashboard' ? 'VolleyLevel' : 
                         activeTab === 'skills' ? 'Навыки' : 
                         activeTab === 'leaderboard' ? 'Рейтинг' : 
                         activeTab === 'admin' ? 'Админ' : 'Тренер')}
            </h1>
          </div>
          <div className="w-20 text-right">
             <span className="text-[10px] font-bold text-[#6b7280] uppercase">
               {userRole === UserRole.TRAINER ? 'Coach' : userRole === UserRole.ADMIN ? 'Admin' : 'Player'}
             </span>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 pt-4">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#f7f7f7]/80 backdrop-blur-xl border-t border-[#c6c6c8] safe-area-bottom z-50">
        <div className="flex justify-around items-center h-12">
          <button 
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center flex-1 ${activeTab === 'dashboard' ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}
          >
            <LayoutGrid size={24} />
            <span className="text-[10px] mt-0.5">Главная</span>
          </button>
          
          {userRole === UserRole.STUDENT && (
            <button 
              onClick={() => onTabChange('skills')}
              className={`flex flex-col items-center flex-1 ${activeTab === 'skills' ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}
            >
              <BarChart2 size={24} />
              <span className="text-[10px] mt-0.5">Навыки</span>
            </button>
          )}

          {(userRole === UserRole.TRAINER || userRole === UserRole.ADMIN) && (
            <button 
              onClick={() => onTabChange('trainer')}
              className={`flex flex-col items-center flex-1 ${activeTab === 'trainer' ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}
            >
              <User size={24} />
              <span className="text-[10px] mt-0.5">Ученики</span>
            </button>
          )}

          {userRole === UserRole.ADMIN && (
            <button 
              onClick={() => onTabChange('admin')}
              className={`flex flex-col items-center flex-1 ${activeTab === 'admin' ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}
            >
              <Shield size={24} />
              <span className="text-[10px] mt-0.5">Управление</span>
            </button>
          )}

          <button 
            onClick={() => onTabChange('leaderboard')}
            className={`flex flex-col items-center flex-1 ${activeTab === 'leaderboard' ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}
          >
            <Trophy size={24} />
            <span className="text-[10px] mt-0.5">Рейтинг</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
