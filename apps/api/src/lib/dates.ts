/** 'YYYY-MM-DD' -> Date at UTC midnight (matches Postgres DATE columns). */
export function toDbDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date from a DATE column -> 'YYYY-MM-DD'. */
export function fromDbDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
