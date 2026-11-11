import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import UserAvatar from '../../components/account/UserAvatar.jsx';
import './user-group.css';
export default function UserGroupContent({ item, token }) {
  useUiLocale();
  const title = item.groupTitle?.trim();
  return <div className="user-group-content">
    {title ? <h3>{title}</h3> : null}
    <div className="user-group-members">
      {(item.members || []).map(member => <div className="user-group-member" key={member.user_id ?? `${member.nickname}#${member.tag_number}`}><UserAvatar user={member} token={token} color={member.borderColor} /><strong style={{ color: member.nameColor }}>{member.nickname}</strong><small>#{member.tag_number}</small></div>)}
    </div>
  </div>;
}
