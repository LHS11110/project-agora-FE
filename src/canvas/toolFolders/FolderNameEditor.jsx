import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { useState } from 'react';
export default function FolderNameEditor({ name = '', onSubmit, onCancel, label = '폴더 이름' }) {
  useUiLocale();
  const [value, setValue] = useState(name);
  return <form className="tool-folder-name-form" onSubmit={event => { event.preventDefault(); if (value.trim()) onSubmit(value); }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onCancel(); }}>
    <input autoFocus aria-label={ui(label)} placeholder={ui("폴더 이름")} value={value} maxLength={40} onChange={event => setValue(event.target.value)} />
    <div><button type="submit" disabled={!value.trim()}>{ui("저장")}</button><button type="button" onClick={onCancel}>{ui("취소")}</button></div>
  </form>;
}
