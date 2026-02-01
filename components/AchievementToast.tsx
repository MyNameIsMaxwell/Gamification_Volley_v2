
import React, { useEffect, useState } from 'react';
import { AchievementCriteria } from '../types';
import { Award, X } from 'lucide-react';

interface AchievementToastProps {
  achievement: AchievementCriteria;
  onClose: () => void;
}

const AchievementToast: React.FC<AchievementToastProps> = ({ achievement, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setVisible(true), 100);
    
    // Auto close after 5 seconds
    const autoClose = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500); // Wait for fade out
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoClose);
    };
  }, [onClose]);

  const handleManualClose = () => {
    setVisible(false);
    setTimeout(onClose, 500);
  };

  return (
    <div 
      className={`fixed top-14 left-4 right-4 z-[100] transition-all duration-500 transform ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'
      }`}
    >
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#007aff]/30 overflow-hidden flex flex-col p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-[#007aff] p-1 rounded-full text-white">
              <Award size={16} />
            </div>
            <span className="text-[12px] font-bold text-[#007aff] uppercase tracking-wider">Достижение разблокировано!</span>
          </div>
          <button onClick={handleManualClose} className="text-[#8e8e93] active:opacity-50">
            <X size={18} />
          </button>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-[#c6c6c8]/20 shadow-sm">
            {achievement.imageUrl ? (
              <img src={achievement.imageUrl} alt={achievement.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#ff9500]">
                <Award size={40} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="text-[17px] font-bold text-black leading-tight">{achievement.title}</h4>
            <p className="text-[13px] text-[#3a3a3c] mt-1">{achievement.description}</p>
          </div>
        </div>
        
        {/* Progress bar timer */}
        <div className="absolute bottom-0 left-0 h-1 bg-[#007aff]/20 w-full">
           <div 
             className="h-full bg-[#007aff] transition-all duration-[5000ms] ease-linear"
             style={{ width: visible ? '0%' : '100%' }}
           />
        </div>
      </div>
    </div>
  );
};

export default AchievementToast;
