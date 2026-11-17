// All memberships, not just writable roles. Read-only peers in a shared role
// receive the object; disjoint roles do not. The server still checks writing.
export function normalizeObjectGroups(permission) {
  if (typeof permission === 'string') return permission.length ? [permission] : [];
  if (Array.isArray(permission)) {
    return [...new Set(permission.filter(group => typeof group === 'string' && group.length))].sort();
  }
  if (permission && typeof permission === 'object') {
    return [...new Set(
      Object.entries(permission)
        .filter(([group, level]) => typeof group === 'string' && group.length && (level === true || Number(level) > 0))
        .map(([group]) => group),
    )].sort();
  }
  return [];
}

export function deriveUserCapabilitiesFromSettings(settings, user, current = null) {
  if (!settings?.groups || typeof settings.groups !== 'object' || !user?.nickname || user?.tag_number == null) {
    return current;
  }
  const tag = Number(user.tag_number);
  const matchesUser = person => person && person.nickname === user.nickname && Number(person.tag_number) === tag;
  const isOwner = Boolean(settings.owner && matchesUser(settings.owner));
  const inParticipants = Array.isArray(settings.participants) && settings.participants.some(matchesUser);
  const assigned = [];
  for (const [group, members] of Object.entries(settings.groups)) {
    if (Array.isArray(members) && members.some(matchesUser)) assigned.push(group);
  }
  if (isOwner && !assigned.includes('admin-group') && Object.hasOwn(settings.groups, 'admin-group')) {
    assigned.push('admin-group');
  }
  if (!assigned.length && !inParticipants && !isOwner) return current;
  if (!assigned.length && settings.visibility === 'public') {
    const initGroup = settings.initial_group || 'default';
    if (initGroup !== 'admin-group' && Object.hasOwn(settings.groups, initGroup)) {
      assigned.push(initGroup);
    }
  }
  const memberGroups = [...new Set(assigned)].sort();
  const isAdmin = isOwner || memberGroups.includes('admin-group') || settings.can_manage === true || current?.is_admin === true;
  const policies = settings.group_permissions || {};
  const hasCap = (group, cap) => {
    if (group === 'admin-group') return true;
    const policy = policies[group];
    if (!policy || typeof policy !== 'object') return true;
    if (policy.read !== true) return false;
    return cap === 'read' ? true : policy[cap] === true;
  };
  const readGroups = memberGroups.filter(group => hasCap(group, 'read'));
  const writeGroups = memberGroups.filter(group => hasCap(group, 'write'));
  const executeGroups = memberGroups.filter(group => hasCap(group, 'execute'));
  return {
    ...(current || {}),
    group_bits: settings.group_bits || current?.group_bits,
    groups: readGroups,
    member_groups: memberGroups,
    write_groups: writeGroups,
    execute_groups: executeGroups,
    is_admin: isAdmin,
  };
}

export function creationGroupPermission(identity, fallback = [], settings = null, user = null) {
  const effective = settings && user ? deriveUserCapabilitiesFromSettings(settings, user, identity) : identity;
  const groups = effective?.member_groups ?? effective?.groups ?? fallback;
  return [...new Set((Array.isArray(groups) ? groups : []).filter(group => typeof group === 'string' && group.length))].sort();
}
