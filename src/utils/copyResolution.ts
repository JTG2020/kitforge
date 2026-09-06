import type { TextField } from '../types/product.ts';

/**
 * Resolves the effective string value for a given text field on a specific printed copy index.
 * Falls back to copyPlaceholders[copyIndex] -> placeholder -> "" if untouched.
 */
export function resolveCopyFieldValue(
  field: TextField,
  copyIndex: number,
  copyValues?: Record<string, string>
): string {
  if (copyValues && copyValues[field.id] !== undefined && copyValues[field.id].trim() !== '') {
    return copyValues[field.id];
  }

  if (field.copyPlaceholders && field.copyPlaceholders[copyIndex] !== undefined) {
    return field.copyPlaceholders[copyIndex];
  }

  if (field.placeholder) {
    return field.placeholder;
  }

  return '';
}
