export function uniqueCanvasParticipants(participants, excludedUser) {
  const seen = new Set();
  return (Array.isArray(participants) ? participants : []).filter((person) => {
    const nickname = String(person?.nickname || '');
    const tagNumber = Number(person?.tag_number);
    if (!nickname || (excludedUser && nickname === excludedUser.nickname && tagNumber === Number(excludedUser.tag_number))) return false;
    const identity = `${nickname}#${tagNumber}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

