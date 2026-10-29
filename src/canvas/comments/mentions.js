export function mentionToken(person) {
  return `@${person.nickname}#${Number(person.tag_number)}`;
}

export function mentionsUser(text, user) {
  if (!user?.nickname || !Number.isInteger(Number(user.tag_number))) return false;
  const needle = mentionToken(user);
  const source = String(text || '');
  for (let index = source.indexOf(needle); index >= 0; index = source.indexOf(needle, index + 1)) {
    const before = source[index - 1], after = source[index + needle.length];
    if ((!before || /[\s([{]/u.test(before)) && (!after || /[\s.,!?;:)}\]]/u.test(after))) return true;
  }
  return false;
}

export function mentionSuggestions(text, cursor, participants) {
  const before = text.slice(0, cursor);
  const start = before.lastIndexOf('@');
  if (start < 0 || (start > 0 && !/[\s([{]/u.test(before[start - 1]))) return null;
  const query = before.slice(start + 1).toLocaleLowerCase();
  if (query.includes('\n') || query.length > 105) return null;
  const matches = (participants || []).filter(person => person?.nickname && Number.isInteger(Number(person.tag_number))
    && `${person.nickname}#${Number(person.tag_number)}`.toLocaleLowerCase().startsWith(query)).slice(0, 8);
  return matches.length ? { start, end: cursor, matches } : null;
}
