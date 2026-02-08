
import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Skills, SkillDefinition } from '../types';
import { getSkillLevelInfo } from '../utils/levelLogic';

interface SkillRadarProps {
  skills: Skills;
  definitions: SkillDefinition[];
  showLevels?: boolean; // true = show levels (1-10), false = show XP
}

const SkillRadar: React.FC<SkillRadarProps> = ({ skills, definitions, showLevels = true }) => {
  const MAX_SKILL_LEVEL = 10;

  const data = useMemo(() => {
    return definitions.map((def) => {
      const xp = skills[def.id] || 0;
      const levelInfo = getSkillLevelInfo(xp);
      
      return {
        subject: def.label,
        level: levelInfo.level,
        xp: xp,
        A: showLevels ? levelInfo.level : xp,
        fullMark: showLevels ? MAX_SKILL_LEVEL : Math.max(...definitions.map(d => skills[d.id] || 0), 100),
        rankTitle: levelInfo.rankTitle,
      };
    });
  }, [skills, definitions, showLevels]);

  // Custom tick for showing level numbers
  const renderPolarAngleAxis = (props: any) => {
    const { payload, x, y, cx, cy, ...rest } = props;
    const item = data.find(d => d.subject === payload.value);
    
    return (
      <g>
        <text
          {...rest}
          x={x}
          y={y}
          textAnchor={x > cx ? 'start' : x < cx ? 'end' : 'middle'}
          dominantBaseline="central"
        >
          <tspan fill="#374151" fontSize="11" fontWeight="600">{payload.value}</tspan>
          {item && showLevels && (
            <tspan fill="#6b7280" fontSize="9" dx="4">Ур.{item.level}</tspan>
          )}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full h-72 mt-4 bg-white rounded-2xl shadow-sm p-4">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-700">Диаграмма навыков</h3>
        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
          {showLevels ? 'Уровни 1-10' : 'XP'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={renderPolarAngleAxis}
          />
          {showLevels && (
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, MAX_SKILL_LEVEL]} 
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              tickCount={6}
              axisLine={false}
            />
          )}
          <Radar
            name="Skills"
            dataKey="A"
            stroke="#3b82f6"
            fill="url(#skillGradient)"
            fillOpacity={0.6}
            strokeWidth={2}
          />
          <defs>
            <linearGradient id="skillGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4}/>
            </linearGradient>
          </defs>
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadar;
