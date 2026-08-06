/** Quizlet import: paste-based parser for Quizlet's own export format —
 *  `term<TAB>definition` lines (comma fallback) (docs/04 §1). Isomorphic (unit-tested). */

export interface QuizletCard {
  front: string;
  back: string;
}

export function parseQuizlet(text: string): QuizletCard[] {
  const cards: QuizletCard[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let front: string | undefined;
    let back: string | undefined;
    if (line.includes("\t")) {
      const idx = line.indexOf("\t");
      front = line.slice(0, idx).trim();
      back = line.slice(idx + 1).trim();
    } else if (line.includes(",")) {
      const idx = line.indexOf(",");
      front = line.slice(0, idx).trim();
      back = line.slice(idx + 1).trim();
    }
    if (front && back) cards.push({ front, back });
  }
  return cards;
}
