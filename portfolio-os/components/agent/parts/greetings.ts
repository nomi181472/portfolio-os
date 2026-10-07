export const SUGGESTIONS = [
  'Do you have experience with Kubernetes?',
  'Are you open to work?',
  'What did you build at Ktrade?',
] as const;

export function getGreetingMessage(role?: string, candidateName?: string): string {
  const name = candidateName?.trim() || 'me';
  const defaultVariations = [
    `What do you want to know about ${name}? Share a job description or question, and I will give you a grounded, honest answer.`,
    `What would you like to explore about ${name}? Share your requirements or tech stack, and I will provide precise insights.`,
    `Curious about ${name}’s experience? Ask me anything about architectures, distributed systems, or skills, and I will answer truthfully.`,
    `What do you want to analyze today? Paste a job description or query, and I will evaluate ${name}’s exact fit.`,
    `Ready to assist! Ask me about ${name}’s past engineering achievements, codebases, or system design decisions.`,
  ];

  const qwen05Variations = [
    `Qwen2.5 0.5B Instruct model is ready! Ask me anything about ${name}’s backend architecture, Kubernetes experience, or project history.`,
    `Loaded Qwen2.5 0.5B! Give me your job description or tech stack (e.g. Go/C#/Python), and I will evaluate ${name}’s direct fit.`,
    `Qwen2.5 0.5B is active locally! What would you like to know about ${name}’s experience or projects?`,
  ];

  const embeddingVariations = [
    'All-MiniLM-L6-v2 (~23 MB) is online! Searching 384-dimensional vector space for semantic concept matches across portfolio passages.',
    `Local Semantic Search ready! Powered by all-MiniLM-L6-v2 to search ${name}’s portfolio by semantic meaning.`,
  ];

  let pool = defaultVariations;
  if (role === 'conversation') pool = qwen05Variations;
  else if (role === 'embedding') pool = embeddingVariations;

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];
  return selected ?? `What do you want to know about ${name}? Share a job description or question, and I will give you a grounded, honest answer.`;
}
