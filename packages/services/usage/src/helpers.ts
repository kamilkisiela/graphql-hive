export function maskToken(token: string) {
  return token.substring(0, 3) + '•'.repeat(token.length - 6) + token.substring(token.length - 3);
}
