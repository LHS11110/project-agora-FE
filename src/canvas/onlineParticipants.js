/** Membership grants access; only live broker peers prove current presence. */
export function onlineCanvasParticipants(user, peers, profiles, connected) {
  if (!connected) return [];
  const profileMap = new Map((profiles || []).map(profile => [`${profile.nickname}#${profile.tag_number}`, profile]));
  const seen = new Set(), result = [];
  for (const person of [user, ...(peers || []).filter(peer => peer.connected === true)]) {
    if (!person?.nickname || !Number.isSafeInteger(Number(person.tag_number)) || Number(person.tag_number) < 0) continue;
    const identity = `${person.nickname}#${Number(person.tag_number)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push({ ...profileMap.get(identity), ...person, isSelf: person.nickname === user?.nickname && Number(person.tag_number) === Number(user?.tag_number) });
  }
  return result;
}
