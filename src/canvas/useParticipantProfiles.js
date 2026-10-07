import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { uniqueCanvasParticipants } from './canvasParticipants.js';

export function useParticipantProfiles(participants, token, currentUser) {
  const [profiles, setProfiles] = useState({});
  const identities = JSON.stringify(uniqueCanvasParticipants(participants).map(person => [person.nickname, person.tag_number]));
  useEffect(() => {
    let active = true;
    setProfiles({});
    if (!token) return undefined;
    for (const [nickname, tag] of JSON.parse(identities)) {
      api(`/api/users/profiles/${encodeURIComponent(nickname)}/${encodeURIComponent(tag)}`, { token })
        .then(profile => { if (active) setProfiles(previous => ({ ...previous, [`${nickname}#${tag}`]: profile })); })
        .catch(() => { /* Initials remain available when a profile cannot be loaded. */ });
    }
    return () => { active = false; };
  }, [identities, token]);
  return useMemo(() => uniqueCanvasParticipants(participants).map(person => {
    if (person.nickname === currentUser?.nickname && Number(person.tag_number) === Number(currentUser?.tag_number)) return { ...person, ...currentUser };
    return { ...person, ...profiles[`${person.nickname}#${person.tag_number}`] };
  }), [participants, profiles, currentUser]);
}
