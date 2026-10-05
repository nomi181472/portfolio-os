import type { AgentAnswer } from '@/lib/agent/engine';

interface StreamTurnAnswerOptions {
  id: number;
  answer: AgentAnswer;
  answeringModelName: string;
  setTurns: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: number;
        question: string;
        answer: AgentAnswer | null;
        modelName?: string;
      }>
    >
  >;
}

/**
 * Progressively streams answer text character by character in small chunks (~16ms ticks)
 * to provide a smooth generative typing effect without blocking UI threads.
 */
export async function streamTurnAnswer({
  id,
  answer,
  answeringModelName,
  setTurns,
}: StreamTurnAnswerOptions): Promise<void> {
  const fullText = answer.text;
  const totalChars = fullText.length;

  if (totalChars === 0) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === id
          ? {
              ...turn,
              answer,
              modelName: answeringModelName,
            }
          : turn,
      ),
    );
    return;
  }

  // Stream in small fast chunks (~4-8 characters every 16ms)
  const chunkSize = Math.max(3, Math.ceil(totalChars / 40));
  let currentLen = 0;

  // Set initial partial answer turn
  setTurns((current) =>
    current.map((turn) =>
      turn.id === id
        ? {
            ...turn,
            answer: { ...answer, text: '' },
            modelName: answeringModelName,
          }
        : turn,
    ),
  );

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      currentLen = Math.min(totalChars, currentLen + chunkSize);
      const partialText = fullText.slice(0, currentLen);

      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                answer: { ...answer, text: partialText },
                modelName: answeringModelName,
              }
            : turn,
        ),
      );

      if (currentLen >= totalChars) {
        clearInterval(interval);
        resolve();
      }
    }, 16);
  });
}
