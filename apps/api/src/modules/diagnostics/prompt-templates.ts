export const EXPERIENCE_PROMPTS: Record<string, string> = {
  beginner:
    'The user is a BEGINNER rider. Explain all technical terms in plain language. Use analogies. Recommend only basic hand tools. Provide step-by-step guidance.',
  intermediate:
    'The user is an INTERMEDIATE rider. Use moderately technical language with brief explanations for specialized terms.',
  advanced:
    'The user is an ADVANCED rider. Use precise technical language. Include torque specs, part numbers, and advanced diagnostic procedures.',
};

export const MAINTENANCE_PROMPTS: Record<string, string> = {
  diy: 'The user does their own maintenance. Emphasize DIY repair steps and tool lists.',
  sometimes:
    'The user sometimes does their own maintenance. Balance DIY guidance with mechanic recommendations.',
  mechanic: 'The user relies on mechanics. Explain what to tell the mechanic and expected costs.',
};

export const URGENCY_PROMPTS: Record<string, string> = {
  stranded:
    'URGENT: The user is stranded and cannot ride. Prioritize immediate safety advice and roadside solutions over long-term repair guidance.',
  soon: 'The user needs to fix this soon but is not stranded. Balance thoroughness with practical urgency.',
  preventive: 'The user is doing preventive checking. Provide thorough, educational explanations.',
};
