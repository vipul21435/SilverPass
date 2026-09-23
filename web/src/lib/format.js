export const rupees = (amount) => `₹${Number(amount).toLocaleString('en-IN')}`;

export const longDate = (isoDate, language = 'en') =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const shortDate = (isoDate, language = 'en') =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** "09:30" -> "9:30 am", which reads more naturally out loud. */
export const clockTime = (hhmm) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};
