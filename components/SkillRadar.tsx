
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Skills, SkillDefinition } from '../types';

interface SkillRadarProps {
  skills: Skills;
  // Fix: Added definitions prop to support dynamic skills
  definitions: SkillDefinition[];
}

const SkillRadar: React.FC<SkillRadarProps> = ({ skills, definitions }) => {
  // Fix: Map over definitions instead of static SKILL_LABELS
  const data = definitions.map((def) => ({
    subject: def.label,
    A: skills[def.id] || 0,
    fullMark: 20,
  }));

  return (
    <div className="w-full h-64 mt-4 bg-white rounded-2xl shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-600 mb-2">Диаграмма навыков</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
          <Radar
            name="Skills"
            dataKey="A"
            stroke="#2563eb"
            fill="#3b82f6"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SkillRadar;
