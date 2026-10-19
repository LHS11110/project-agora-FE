import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import UserAvatar from '../../components/account/UserAvatar.jsx';
import './user-group.css';
export default function UserGroupContent({ item, token }) {
  useUiLocale();
  return <div className="user-group-content"><h3>{item.groupTitle || ui("사용자 그룹")}</h3><div className="user-group-members">
    {(item.members || []).map(member => <div className="user-group-member" key={member.user_id ?? `${member.nickname}#${member.tag_number}`}><UserAvatar user={member} token={token} color={member.borderColor} /><strong style={{ color: member.nameColor }}>{member.nickname}</strong><small>#{member.tag_number}</small></div>)}
    {!item.members?.length && <p className="user-group-empty">{ui("그룹을 선택하고 오른쪽 패널에서 사용자를 추가하세요.")}</p>}
  </div></div>;
}
