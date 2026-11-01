import {ui} from '../../i18n/locale.js';
import Icon from '../../components/Icon.jsx';
import {isObjectLocked} from './objectLock.js';
import './object-lock.css';
export default function ObjectLockControls({ids,items,onChange,disabled=false}) {
 const count=ids.filter(id=>isObjectLocked(items[id])).length,all=count===ids.length;
 return <section className="inspector-section object-lock-controls" aria-label={ui('객체 잠금')}>
  <div className="object-lock-heading"><strong><Icon name="lock" size={14}/>{ui('객체 잠금')}</strong><small>{count} / {ids.length}</small></div>
  <div className="object-lock-actions"><button type="button" disabled={disabled} className="inspector-secondary-action" onClick={()=>onChange(ids,!all)} aria-pressed={all}><Icon name={all?'unlock':'lock'} size={14}/>{ui(all?'잠금 해제':'객체 잠금')}</button>{count>0&&!all&&<button type="button" disabled={disabled} className="inspector-secondary-action" onClick={()=>onChange(ids,false)}>{ui('잠금 해제')}</button>}</div>
  {count>0&&<p className="inspector-hint">{ui('잠긴 객체는 이동·편집·삭제할 수 없습니다. 복사와 댓글은 사용할 수 있습니다.')}</p>}
 </section>;
}
