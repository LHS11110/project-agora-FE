import { useEffect, useRef } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import MarkdownText from '../../components/MarkdownText.jsx';
import MentionComposer from './MentionComposer.jsx';
import './comments.css';

export default function ObjectCommentsPanel({ comments, participants, connection }) {
  const locale = useUiLocale(), panel = useRef(null);
  const thread = comments.threads[comments.activeId] || {};
  useEffect(() => {
    if (!comments.highlight) return;
    const target = [...(panel.current?.querySelectorAll('[data-message-id]') || [])].find(node => node.dataset.messageId === comments.highlight);
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (target) comments.markVisible();
  }, [comments.highlight, thread.entries, comments.markVisible]);
  return <aside ref={panel} className="object-comments-panel" aria-label={ui('객체 댓글')}>
    <header><div><strong>{ui('객체 댓글')}</strong><small title={comments.activeId}>{comments.activeId}</small></div><button type="button" aria-label={ui('댓글 닫기')} onClick={() => comments.setActiveId(null)}>×</button></header>
    {thread.hasMore && <button className="comments-older" disabled={thread.loading} onClick={() => comments.requestHistory(comments.activeId, thread.nextToSequence)}>{ui('이전 댓글')}</button>}
    <div className="object-comments-list">{thread.loading && !thread.entries?.length ? <p>{ui('불러오는 중')}</p> : thread.entries?.length ? thread.entries.map(entry => <article key={entry.id} data-message-id={entry.id} className={`object-comment${comments.highlight === entry.id ? ' mention-target' : ''}`}><div><strong>{entry.sender}</strong><time>{entry.time.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div><MarkdownText source={entry.text} /></article>) : <p>{ui('아직 댓글이 없습니다.')}</p>}</div>
    {comments.error && <p className="comments-error" role="alert">{ui(comments.error)}</p>}
    <MentionComposer label={ui("객체 댓글 입력")} placeholder={ui("댓글을 남겨보세요...")} value={comments.draft} onChange={comments.setDraft} onSubmit={comments.sendComment} participants={participants} disabled={connection !== 'connected'} />
  </aside>;
}
