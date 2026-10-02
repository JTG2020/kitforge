export function isTemporaryGeminiCapacityError(message: string, httpStatus?: number): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    httpStatus === 503 ||
    lowerMessage.includes('currently experiencing high demand') ||
    lowerMessage.includes('temporarily unavailable') ||
    lowerMessage.includes('overloaded')
  );
}

export function formatGeminiModelError(model: string, message: string): string {
  const prefix = `${model}:`;
  return message.startsWith(prefix) ? message : `${prefix} ${message}`;
}