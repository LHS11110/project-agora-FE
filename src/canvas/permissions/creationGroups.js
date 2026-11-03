// All memberships, not just writable roles. Read-only peers in a shared role
// receive the object; disjoint roles do not. The server still checks writing.
export function creationGroupPermission(identity,fallback=[]){
 const groups=identity?.member_groups ?? identity?.groups ?? fallback;
 return [...new Set((Array.isArray(groups)?groups:[]).filter(group=>typeof group==='string'&&group.length))].sort();
}
