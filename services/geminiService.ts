
import { GoogleGenAI } from "@google/genai";
import { Skills, SkillDefinition } from "../types";

export const getAiCoachAdvice = async (skills: Skills, level: number, definitions: SkillDefinition[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const skillsText = definitions
    .map(def => `${def.label}: ${skills[def.id] || 0}`)
    .join(", ");

  const prompt = `Ты — профессиональный тренер по волейболу. 
  Ученик ${level} уровня имеет следующие показатели навыков: ${skillsText}.
  Дай 3 коротких, мотивирующих совета на русском языке, как ему улучшить свою игру.
  Будь кратким, используй волейбольный сленг (эйс, блок-аут, пайп). 
  Ответ верни в формате простого текста без Markdown заголовков.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Твоя подача становится стабильнее! Работай над прыжком и точностью доигровки.";
  }
};
