import { ui } from '../../i18n/locale.js';
import './comments.css';

export default function MentionNotifications({ notifications, onJump, onDismiss }) {
  if (!notifications.length) return null;
  return <aside className="mention-notifications" aria-label={ui('멘션 알림')} aria-live="polite">
    {notifications.map(note => <div className="mention-notification" key={note.key}>
      <button className="mention-notification-link" onClick={() => onJump(note)}><strong>{ui('나를 멘션했습니다')} · {note.sender}</strong><span>{note.objectId ? ui('객체 댓글') : ui('캔버스 채팅')}</span><small>{note.text}</small></button>
      <button className="mention-notification-close" aria-label={ui('멘션 알림 닫기')} onClick={() => onDismiss(note)}>×</button>
    </div>)}
  </aside>;
}
