import { useLayoutEffect, useRef, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import { mentionSuggestions, mentionToken } from './mentions.js';

export default function MentionComposer({ value, onChange, onSubmit, participants, disabled, placeholder, label }) {
  const input = useRef(null);
  const pendingPosition = useRef(null);
  const [cursor, setCursor] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(0);
  const suggestions = !dismissed && mentionSuggestions(value, cursor, participants);
  useLayoutEffect(() => {
    if (pendingPosition.current == null) return;
    const position = pendingPosition.current;
    pendingPosition.current = null;
    input.current?.focus();
    input.current?.setSelectionRange(position, position);
  }, [value]);
  const choose = person => {
    const next = value.slice(0, suggestions.start) + mentionToken(person) + ' ' + value.slice(suggestions.end);
    const position = suggestions.start + mentionToken(person).length + 1;
    pendingPosition.current = position;
    onChange(next); setCursor(position); setDismissed(true); setSelected(0);
  };
  return <form className="mention-composer" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    <div className="mention-input-wrap"><textarea ref={input} rows="2" aria-label={ui(label)} placeholder={ui(placeholder)} value={value} disabled={disabled}
      onChange={event => { onChange(event.target.value); setCursor(event.target.selectionStart); setDismissed(false); setSelected(0); }}
      onSelect={event => setCursor(event.target.selectionStart)}
      onKeyDown={event => {
        if (suggestions && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissed(true); }
        else if (suggestions && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setSelected(current => (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.matches.length) % suggestions.matches.length); }
        else if (suggestions && (event.key === 'Enter' || event.key === 'Tab')) { event.preventDefault(); choose(suggestions.matches[selected % suggestions.matches.length]); }
        else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); }
      }} />
      {suggestions && <div className="mention-suggestions" role="listbox" aria-label={ui('멘션할 사용자')}>
        {suggestions.matches.map((person, index) => <button type="button" role="option" aria-selected={index === selected} key={mentionToken(person)} onMouseDown={event => event.preventDefault()} onClick={() => choose(person)}>{mentionToken(person)}</button>)}
      </div>}
    </div><div className="mention-compose-actions"><span>{ui('@로 멘션 · Enter 전송 · Shift + Enter 줄바꿈')}</span><button type="submit" disabled={disabled || !value.trim()}>{ui('전송')}</button></div>
  </form>;
}
