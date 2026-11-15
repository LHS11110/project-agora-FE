export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function calendarDays(year, now = new Date()) {
  const days = [];
  for (const date = new Date(year, 0, 1, 12); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
    days.push({ date: dayKey(date), weekday: date.getDay(), future: dayKey(date) > dayKey(now), month: date.getMonth() });
  }
  return days;
}
export function activityStats(days, now = new Date()) {
  const keys = Object.keys(days).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= dayKey(now) && Number(days[key]?.count)>0).sort();
  const canvasDays = keys.filter(key => days[key]?.canvases?.length > 0).length;
  let bestStreak = 0, run = 0, previous = '';
  for (const key of keys) {
    const prior = new Date(`${key}T12:00:00`); prior.setDate(prior.getDate() - 1);
    run = dayKey(prior) === previous ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run); previous = key;
  }
  let streak = 0;
  const date = new Date(now);
  if (!keys.includes(dayKey(date))) date.setDate(date.getDate() - 1);
  while (keys.includes(dayKey(date))) { streak++; date.setDate(date.getDate() - 1); }
  return { activeDays: keys.length, canvasDays, streak, bestStreak };
}
