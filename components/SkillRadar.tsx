
import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Skills, SkillDefinition } from '../types';
import { getSkillLevelInfo } from '../utils/levelLogic';

interface SkillRadarProps {
  skills: Skills;
  definitions: SkillDefinition[];
  showLevels?: boolean; // true = show levels (1-10), false = show XP
}

// Break long text into lines of maxChars
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine && (currentLine + ' ' + word).length > maxChars) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  // If still a single long word, split it
  if (lines.length === 1 && lines[0].length > maxChars) {
    const word = lines[0];
    const mid = Math.ceil(word.length / 2);
    // Try to find a good break point
    let breakIdx = mid;
    for (let i = mid - 2; i <= mid + 2 && i < word.length; i++) {
      if (i > 2 && 'аеёиоуыэюяАЕЁИОУЫЭЮЯaeiouyAEIOUY'.includes(word[i])) {
        breakIdx = i;
        break;
      }
    }
    return [word.slice(0, breakIdx) + '-', word.slice(breakIdx)];
  }
  
  return lines;
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

  // Custom tick for showing level numbers with word wrapping
  const renderPolarAngleAxis = (props: any) => {
    const { payload, x, y, cx, cy, ...rest } = props;
    const item = data.find(d => d.subject === payload.value);
    const anchor = x > cx + 5 ? 'start' : x < cx - 5 ? 'end' : 'middle';
    
    const labelText = payload.value as string;
    const levelSuffix = item && showLevels ? ` Ур.${item.level}` : '';
    const maxChars = 9;
    const lines = wrapText(labelText, maxChars);
    
    const lineHeight = 13;
    const totalHeight = lines.length * lineHeight;
    const startY = y - totalHeight / 2 + lineHeight / 2;
    
    return (
      <g>
        {lines.map((line, i) => (
          <text
            key={i}
            x={x}
            y={startY + i * lineHeight}
            textAnchor={anchor}
            dominantBaseline="central"
            fill="#374151"
            fontSize="10"
            fontWeight="600"
          >
            {line}
          </text>
        ))}
        {levelSuffix && (
          <text
            x={x}
            y={startY + lines.length * lineHeight}
            textAnchor={anchor}
            dominantBaseline="central"
            fill="#6b7280"
            fontSize="9"
          >
            {levelSuffix.trim()}
          </text>
        )}
      </g>
    );
  };

  // Adjust outerRadius based on number of skills and label lengths
  const outerRadius = useMemo(() => {
    const maxLabelLen = Math.max(...definitions.map(d => d.label.length), 0);
    if (maxLabelLen > 12) return '55%';
    if (maxLabelLen > 9) return '60%';
    if (definitions.length > 8) return '60%';
    return '68%';
  }, [definitions]);

  return (
    <div className="w-full h-80 mt-4 bg-white rounded-2xl shadow-sm p-4">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-slate-700">Диаграмма навыков</h3>
        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
          {showLevels ? 'Уровни 1-10' : 'XP'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius={outerRadius} data={data}>
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
