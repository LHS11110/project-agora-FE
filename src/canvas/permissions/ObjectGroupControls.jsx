import { useId, useMemo, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { normalizeObjectGroups } from './creationGroups.js';
import './canvas-access-management.css';

export default function ObjectGroupControls({ ids = [], items = {}, settings = null, capabilities = null, disabled = false, onChange }) {
  useUiLocale();
  const fieldId = useId();
  const [query, setQuery] = useState('');

  const selectedItems = useMemo(() => ids.map(id => items[id]).filter(Boolean), [ids, items]);
  const itemGroupsList = useMemo(() => selectedItems.map(item => normalizeObjectGroups(item.permission)), [selectedItems]);
  const assignedGroups = useMemo(() => [...new Set(itemGroupsList.flat())].sort(), [itemGroupsList]);
  const sharedGroups = useMemo(
    () => assignedGroups.filter(group => itemGroupsList.every(list => list.includes(group))),
    [assignedGroups, itemGroupsList],
  );

  const isAdmin = Boolean(capabilities?.is_admin || settings?.can_manage);
  const userWritableGroups = useMemo(
    () => new Set(capabilities?.write_groups || capabilities?.groups || []),
    [capabilities?.write_groups, capabilities?.groups],
  );
  const userMemberGroups = useMemo(
    () => new Set([...(capabilities?.member_groups || []), ...(capabilities?.groups || []), ...userWritableGroups]),
    [capabilities?.member_groups, capabilities?.groups, userWritableGroups],
  );

  const availableGroups = useMemo(() => {
    const base = isAdmin
      ? [
          ...Object.keys(settings?.groups || {}),
          ...Object.keys(settings?.group_permissions || {}),
          ...Object.keys(capabilities?.group_bits || {}),
          ...userMemberGroups,
          ...assignedGroups,
        ]
      : [...userMemberGroups, ...assignedGroups];
    return [...new Set(base.filter(group => typeof group === 'string' && group.length))];
  }, [isAdmin, settings?.groups, settings?.group_permissions, capabilities?.group_bits, userMemberGroups, assignedGroups]);

  if (!selectedItems.length || !onChange) return null;

  const canRemoveGroup = group => {
    return itemGroupsList.every(list => {
      if (!list.includes(group)) return true;
      const remaining = list.filter(entry => entry !== group);
      if (remaining.length < 1) return false;
      if (!isAdmin && userWritableGroups.size > 0 && !remaining.some(entry => userWritableGroups.has(entry))) {
        return false;
      }
      return true;
    });
  };

  const toggleGroup = (group, enabled) => {
    if (disabled) return;
    if (!enabled && !canRemoveGroup(group)) return;
    onChange(ids, currentGroups => {
      const next = new Set(currentGroups);
      if (enabled) next.add(group);
      else next.delete(group);
      return [...next].sort();
    });
  };

  const capabilityLabel = group => {
    if (group === 'admin-group') return ui('관리자');
    const policy = settings?.group_permissions?.[group];
    if (!policy) return settings?.groups && !Object.hasOwn(settings.groups, group) ? ui('미등록 그룹') : '';
    return ['read', 'write', 'execute']
      .filter(cap => policy[cap])
      .map(cap => ui({ read: '읽기', write: '쓰기', execute: '실행' }[cap]))
      .join(' · ') || ui('접근 불가');
  };

  const filteredGroups = availableGroups.filter(group => group.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  return (
    <section className="inspector-section object-group-controls" aria-label={ui('객체 그룹')}>
      <div className="inspector-switch-row">
        <strong className="inspector-label">{ui('객체 그룹')}</strong>
        <span>{assignedGroups.length}{ui('개')}</span>
      </div>
      <small className="inspector-hint">{ui('객체에 할당된 그룹을 관리합니다. 최소 하나 이상의 그룹이 유지되어야 합니다.')}</small>
      <div className="object-group-badges">
        {assignedGroups.map(group => (
          <span className={`canvas-role-badge${group === 'admin-group' ? ' is-admin' : ''}`} key={group}>
            <i aria-hidden="true" />
            {group}
            <button
              type="button"
              disabled={disabled || !canRemoveGroup(group)}
              aria-label={ui('객체에서 {group} 그룹 제거', { group })}
              onClick={() => toggleGroup(group, false)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {availableGroups.length > 6 && (
        <input
          id={`${fieldId}-search`}
          name="object-group-search"
          className="plain-input"
          aria-label={ui('객체 그룹 검색')}
          placeholder={ui('그룹 이름 검색')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      )}
      <div className="object-group-picker">
        {filteredGroups.map(group => {
          const checked = sharedGroups.includes(group);
          const partial = !checked && assignedGroups.includes(group);
          const label = capabilityLabel(group);
          return (
            <label key={group}>
              <input
                id={`${fieldId}-group-${group}`}
                name={`object-group-${group}`}
                type="checkbox"
                checked={checked}
                ref={el => { if (el) el.indeterminate = partial; }}
                disabled={disabled || (checked && !canRemoveGroup(group))}
                aria-label={ui('객체 {group} 그룹 할당', { group })}
                onChange={e => toggleGroup(group, e.target.checked)}
              />
              <span>{group}</span>
              {label && <small>{label}</small>}
            </label>
          );
        })}
      </div>
    </section>
  );
}
