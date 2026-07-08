export interface CharResult {
  char: string;
  expected: string;
  status: 'correct' | 'incorrect' | 'pending' | 'space';
}

export function buildExpectedChars(text: string): string[] {
  return text.split('');
}

export function compareChar(
  typed: string,
  expected: string,
  ignorePunctuation: boolean
): 'correct' | 'incorrect' {
  const normalizedTyped = typed.toLowerCase();
  const normalizedExpected = expected.toLowerCase();

  if (ignorePunctuation && isPunctuation(normalizedExpected)) {
    return 'correct';
  }

  return normalizedTyped === normalizedExpected ? 'correct' : 'incorrect';
}

export function isPunctuation(char: string): boolean {
  return /[^\w\s]/.test(char);
}

export function isSpace(char: string): boolean {
  return char === ' ';
}

export function getTypableIndices(chars: string[]): number[] {
  return chars.reduce<number[]>((acc, char, i) => {
    if (!isSpace(char)) {
      acc.push(i);
    }
    return acc;
  }, []);
}

export function getMediumModeGaps(
  text: string
): { words: string[]; isGap: boolean[] } {
  const words = text.split(/\s+/);
  const isGap = words.map((_, i) => i % 2 === 1);
  return { words, isGap };
}

export function buildMediumExpectedChars(text: string): {
  chars: string[];
  typableIndices: number[];
} {
  const { words, isGap } = getMediumModeGaps(text);
  const chars: string[] = [];
  const typableIndices: number[] = [];

  words.forEach((word, wordIdx) => {
    if (wordIdx > 0) {
      chars.push(' ');
    }
    for (const ch of word) {
      const idx = chars.length;
      chars.push(ch);
      if (isGap[wordIdx]) {
        typableIndices.push(idx);
      }
    }
  });

  return { chars, typableIndices };
}
