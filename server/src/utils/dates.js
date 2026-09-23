/** Today in YYYY-MM-DD, in UTC. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

export const addDays = (isoDateString, days) => {
  const date = new Date(`${isoDateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Whole years between a date of birth and a reference date. */
export function ageInYears(dateOfBirth, on = todayIso()) {
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  const ref = new Date(`${on}T00:00:00Z`);
  let age = ref.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = ref.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && ref.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** 0 = Sunday ... 6 = Saturday. */
export const dayOfWeek = (isoDateString) => new Date(`${isoDateString}T00:00:00Z`).getUTCDay();

export const daysBetween = (fromIso, toIso) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
