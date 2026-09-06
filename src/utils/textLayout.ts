export interface LayoutTextOptions {
  text: string;
  boxW: number;
  boxH: number;
  sizePt: number;
  leading: number;
  align?: 'left' | 'center' | 'right';
  measure: (text: string, sizePt: number) => number;
}

export interface LayoutTextResult {
  lines: string[];
  sizePt: number;
  originalSizePt: number;
  leading: number;
  overflow: boolean;
  shrunk: boolean;
  totalHeight: number;
}

/**
 * Breaks a single word/token character-by-character if it is wider than the allowed box width.
 */
function wrapTokenByChar(
  token: string,
  boxW: number,
  sizePt: number,
  measure: (text: string, sizePt: number) => number
): string[] {
  if (!token) return [];
  if (measure(token, sizePt) <= boxW) {
    return [token];
  }

  const result: string[] = [];
  let currentChunk = '';

  for (const char of token) {
    const candidate = currentChunk + char;
    if (measure(candidate, sizePt) <= boxW || currentChunk === '') {
      currentChunk = candidate;
    } else {
      result.push(currentChunk);
      currentChunk = char;
    }
  }

  if (currentChunk) {
    result.push(currentChunk);
  }

  return result;
}

/**
 * Greedily wraps text paragraphs within boxW at a specific sizePt.
 */
function wrapParagraphs(
  text: string,
  boxW: number,
  sizePt: number,
  measure: (text: string, sizePt: number) => number
): string[] {
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === '') {
      allLines.push('');
      continue;
    }

    const words = para.split(/\s+/).filter(Boolean);
    let currentLine = '';

    for (const word of words) {
      // Check if word itself exceeds box width
      if (measure(word, sizePt) > boxW) {
        // If currentLine is not empty, commit it first
        if (currentLine) {
          allLines.push(currentLine);
          currentLine = '';
        }
        // Break word into chunks
        const chunks = wrapTokenByChar(word, boxW, sizePt, measure);
        for (let i = 0; i < chunks.length - 1; i++) {
          allLines.push(chunks[i]);
        }
        currentLine = chunks[chunks.length - 1] || '';
        continue;
      }

      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (measure(candidate, sizePt) <= boxW) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          allLines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      allLines.push(currentLine);
    }
  }

  return allLines.length > 0 ? allLines : [''];
}

/**
 * Core text layout engine shared across HTML5 Canvas preview and PDF export.
 */
export function layoutText(options: LayoutTextOptions): LayoutTextResult {
  const { text, boxW, boxH, sizePt: originalSizePt, measure } = options;
  const originalLeading = options.leading || originalSizePt * 1.2;
  const floorSizePt = originalSizePt * 0.75;
  const step = 0.25;

  let currentSizePt = originalSizePt;
  let currentLeading = originalLeading;
  let lines: string[] = [];

  while (currentSizePt >= floorSizePt) {
    currentLeading = (currentSizePt / originalSizePt) * originalLeading;
    lines = wrapParagraphs(text, boxW, currentSizePt, measure);
    const totalHeight = lines.length * currentLeading;

    if (totalHeight <= boxH) {
      return {
        lines,
        sizePt: currentSizePt,
        originalSizePt,
        leading: currentLeading,
        overflow: false,
        shrunk: currentSizePt < originalSizePt,
        totalHeight,
      };
    }

    // Try reducing size
    currentSizePt = Math.round((currentSizePt - step) * 100) / 100;
  }

  // At the floor size limit
  currentSizePt = floorSizePt;
  currentLeading = (floorSizePt / originalSizePt) * originalLeading;
  lines = wrapParagraphs(text, boxW, floorSizePt, measure);
  const finalHeight = lines.length * currentLeading;
  const overflow = finalHeight > boxH;

  return {
    lines,
    sizePt: floorSizePt,
    originalSizePt,
    leading: currentLeading,
    overflow,
    shrunk: true,
    totalHeight: finalHeight,
  };
}
