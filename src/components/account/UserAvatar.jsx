import { useAuth } from '../../state/AuthContext.jsx';
import AuthenticatedImage from '../AuthenticatedImage.jsx';
import './user-avatar.css';
export function profileImageUrl(user) {
  return user?.profile_image || (user?.user_id != null ? `/api/users/profile-images/${user.user_id}` : '');
}
export default function UserAvatar({ user, token, className = '', color, revision = '' }) {
  const { user: currentUser } = useAuth();
  const ownProfile = user?.user_id != null && currentUser?.user_id != null && String(user.user_id) === String(currentUser.user_id);
  const source = profileImageUrl(ownProfile ? currentUser : user);
  const imageRevision = revision || (ownProfile ? currentUser.avatar_revision : user?.avatar_revision) || 0;
  return <span title={`${user?.nickname || '사용자'}${user?.tag_number != null ? `#${user.tag_number}` : ''}`} className={`user-avatar ${className}`} style={color ? { borderColor: color, color } : undefined}>
    <AuthenticatedImage src={source ? `${source}${source.includes('?') ? '&' : '?'}v=${imageRevision}` : ''} token={token} alt={`${user?.nickname || '사용자'} 프로필`} fallback={<span>{(user?.nickname || '?').slice(0, 1)}</span>} />
  </span>;
}
