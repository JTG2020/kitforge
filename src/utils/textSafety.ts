export interface TextSubstitution {
  original: string;
  replacedWith: string;
  fieldId?: string;
  fieldLabel?: string;
  pieceName?: string;
  copyIndex?: number;
}

export const CHAR_SUBSTITUTIONS: Array<{ char: string; regex: RegExp; replacement: string; name: string }> = [
  { char: '₹', regex: /₹/g, replacement: 'Rs ', name: 'Rupee sign (₹ → Rs )' },
  { char: '€', regex: /€/g, replacement: 'EUR ', name: 'Euro sign (€ → EUR )' },
  { char: '“', regex: /“/g, replacement: '"', name: 'Left double curly quote (“ → ")' },
  { char: '”', regex: /”/g, replacement: '"', name: 'Right double curly quote (” → ")' },
  { char: '‘', regex: /‘/g, replacement: "'", name: "Left single curly quote (‘ → ')" },
  { char: '’', regex: /’/g, replacement: "'", name: "Right single curly quote (’ → ')" },
  { char: '—', regex: /—/g, replacement: '--', name: 'Em dash (— → --)' },
  { char: '–', regex: /–/g, replacement: '-', name: 'En dash (– → -)' },
  { char: '…', regex: /…/g, replacement: '...', name: 'Ellipsis (… → ...)' },
  { char: '\u00A0', regex: /\u00A0/g, replacement: ' ', name: 'Non-breaking space' },
  { char: '•', regex: /•/g, replacement: '*', name: 'Bullet (• → *)' },
  { char: '™', regex: /™/g, replacement: '(TM)', name: 'Trademark sign (™ → (TM))' },
  { char: '®', regex: /®/g, replacement: '(R)', name: 'Registered sign (® → (R))' },
  { char: '©', regex: /©/g, replacement: '(C)', name: 'Copyright sign (© → (C))' },
];

/**
 * Sanitizes input text for WinAnsi PDF-safe characters and collects detected substitutions.
 */
export function sanitizeWinAnsiText(
  input: string,
  context?: { fieldId?: string; fieldLabel?: string; pieceName?: string; copyIndex?: number }
): { sanitized: string; substitutions: TextSubstitution[] } {
  let text = input;
  const substitutions: TextSubstitution[] = [];

  for (const item of CHAR_SUBSTITUTIONS) {
    if (text.includes(item.char)) {
      substitutions.push({
        original: item.char,
        replacedWith: item.replacement,
        fieldId: context?.fieldId,
        fieldLabel: context?.fieldLabel,
        pieceName: context?.pieceName,
        copyIndex: context?.copyIndex,
      });
      text = text.replace(item.regex, item.replacement);
    }
  }

  return { sanitized: text, substitutions };
}
