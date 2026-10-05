export const SUGGESTIONS = [
  'Do you have experience with Kubernetes?',
  'Are you open to work?',
  'What did you build at Ktrade?',
] as const;

export function getGreetingMessage(role?: string): string {
  const defaultVariations = [
    'What do you want to know about me? Give me your JDK, and I will give you an honest answer as far as possible.',
    'What would you like to explore about Noman? Share your requirements or tech stack, and I will provide precise insights.',
    'Curious about Noman’s experience? Ask me anything about architectures, distributed systems, or skills, and I will answer truthfully.',
    'What do you want to analyze today? Paste a job description or query, and I will evaluate Noman’s exact fit.',
    'Ready to assist! Ask me about Noman’s past engineering achievements, codebases, or system design decisions.',
  ];

  const qwen05Variations = [
    'Qwen 0.5B Instruct model is ready! Ask me anything about Noman’s backend architecture, Kubernetes experience, or project history.',
    'Loaded Qwen 0.5B! Give me your job description or tech stack (e.g. JDK/Node/Go), and I will evaluate Noman’s direct fit.',
    'Qwen 0.5B is active locally! What would you like to know about Noman’s experience at Ktrade or Verseye?',
  ];

  const qwen15Variations = [
    'Qwen 1.5B High-Quality LLM is active! Ask me deep questions about system design, microservices, or team leadership.',
    'Loaded Qwen 1.5B Instruct! Paste your role requirements or engineering challenges, and let us discuss Noman’s qualifications in detail.',
    'Qwen 1.5B neural engine ready! What technical achievements or architecture patterns would you like to explore?',
  ];

  const e5Variations = [
    'Qwen3 Embedding (0.6B INT8) is online! Searching 1024-dimensional vector space for semantic concept matches across portfolio passages.',
    'Qwen3 Vector Search ready! Ask any conceptual question to search Noman’s portfolio by semantic meaning.',
  ];

  let pool = defaultVariations;
  if (role === 'conversation') pool = qwen05Variations;
  else if (role === 'fluent') pool = qwen15Variations;
  else if (role === 'embedding') pool = e5Variations;

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];
  return selected ?? 'What do you want to know about me? Give me your JDK, and I will give you an honest answer as far as possible.';
}
