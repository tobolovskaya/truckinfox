export function isEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export function isNonEmpty(value: string) {
  return value.trim().length > 0;
}
