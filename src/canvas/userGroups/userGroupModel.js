export const MEMBER_COLORS = ['#5d8bba', '#af729d', '#569789', '#be8a43', '#8972b6'];
export const MAX_GROUP_MEMBERS = 50;
export function groupMember(user, index = 0) {
  return { user_id: user.user_id, nickname: user.nickname, tag_number: user.tag_number,
    profile_image: user.profile_image || (user.user_id != null ? `/api/users/profile-images/${user.user_id}` : ''),
    borderColor: MEMBER_COLORS[index % MEMBER_COLORS.length], nameColor: MEMBER_COLORS[index % MEMBER_COLORS.length] };
}
export function membersFromGroup(groupUsers = [], participants = []) {
  if (!Array.isArray(groupUsers)) return [];
  return groupUsers.slice(0, MAX_GROUP_MEMBERS).map((person, idx) => {
    const full = participants.find(p => p.nickname === person.nickname && Number(p.tag_number) === Number(person.tag_number));
    return groupMember(full || person, idx);
  });
}

