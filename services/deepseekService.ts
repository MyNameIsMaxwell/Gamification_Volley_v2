import { Skills, SkillDefinition } from "../types";

export const getAiCoachAdvice = async (skills: Skills, level: number, definitions: SkillDefinition[]): Promise<string> => {
  const apiKey = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY;
  
  if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
    return "Твоя подача становится стабильнее! Работай над прыжком и точностью доигровки. Не забывай про физическую подготовку!";
  }

  const skillsText = definitions
    .map(def => `${def.label}: ${skills[def.id] || 0}`)
    .join(", ");

  const prompt = `Ты — профессиональный тренер по волейболу. 
  Ученик ${level} уровня имеет следующие показатели навыков: ${skillsText}.
  Дай 3 коротких, мотивирующих совета на русском языке, как ему улучшить свою игру.
  Будь кратким, используй волейбольный сленг (эйс, блок-аут, пайп). 
  Ответ верни в формате простого текста без Markdown заголовков.`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Ты профессиональный тренер по волейболу. Отвечай кратко и мотивирующе.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Продолжай тренироваться! Каждая тренировка приближает тебя к цели.";
  } catch (error) {
    console.error("DeepSeek API Error:", error);
    return "Твоя подача становится стабильнее! Работай над прыжком и точностью доигровки.";
  }
};
