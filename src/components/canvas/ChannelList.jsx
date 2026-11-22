import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ui } from '../../i18n/locale.js';
import {
  CHANNEL_NAME_LIMIT,
  canRemoveChannelGroup,
  groupChannelsByCategory,
  normalizeChannelGroupsForSave,
  normalizeChannelName,
  resolveChannelGroupAccess,
} from '../../canvas/channels/channelModel.js';
import { normalizeObjectGroups } from '../../canvas/permissions/creationGroups.js';
import Icon from '../Icon.jsx';

function groupCapabilityLabel(group, settings) {
  if (group === 'admin-group') return ui('관리자');
  const policy = settings?.group_permissions?.[group];
  if (!policy) return settings?.groups && !Object.hasOwn(settings.groups, group) ? ui('미등록 그룹') : '';
  return ['read', 'write', 'execute']
    .filter(cap => policy[cap])
    .map(cap => ui({ read: '읽기', write: '쓰기', execute: '실행' }[cap]))
    .join(' · ') || ui('접근 불가');
}

function ChannelNameForm({
  initial = '',
  label,
  submitLabel,
  allowTypeSelect = false,
  initialType = 'text',
  categories = null,
  initialCategoryId = null,
  groupAccess = null,
  initialGroups = null,
  onSubmit,
  onCancel,
}) {
  const [value, setValue] = useState(initial);
  const [channelType, setChannelType] = useState(initialType);
  const [categoryId, setCategoryId] = useState(initialCategoryId || '');
  const access = useMemo(
    () => (groupAccess ? resolveChannelGroupAccess({ ...groupAccess, existingGroups: initialGroups || [] }) : null),
    [groupAccess, initialGroups],
  );
  const [selectedGroups, setSelectedGroups] = useState(() => (access ? access.initialGroups : []));
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const id = useId();

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const initialAccessKey = access ? access.initialGroups.join('\0') : '';
  useEffect(() => {
    if (selectedGroups.length === 0 && access?.initialGroups.length) {
      setSelectedGroups(access.initialGroups);
    }
  }, [initialAccessKey]);

  const hasGroupConstraint = Boolean(access && access.selectable.length > 0);
  const groupsForSave = useMemo(
    () => (access ? normalizeChannelGroupsForSave(selectedGroups, access) : null),
    [access, selectedGroups],
  );

  const toggleGroup = (group, enabled) => {
    if (!access) return;
    setSelectedGroups(current => {
      if (enabled) {
        if (!access.selectable.includes(group)) return current;
        return normalizeObjectGroups([...current, group]);
      }
      if (!canRemoveChannelGroup(current, group, access)) return current;
      return current.filter(entry => entry !== group);
    });
  };

  const submit = async event => {
    event.preventDefault();
    const name = normalizeChannelName(value);
    if (!name || busy) return;
    if (hasGroupConstraint && (!groupsForSave || !groupsForSave.length)) return;
    setBusy(true);
    try {
      const ok = await onSubmit({
        name,
        type: channelType,
        categoryId: categoryId || null,
        groups: groupsForSave,
      });
      if (ok !== false) onCancel();
    } finally {
      setBusy(false);
    }
  };

  const canSelectAll = Boolean(access && access.selectable.length > 1 && selectedGroups.length < access.selectable.length);

  return (
    <form
      className="channel-name-form"
      onSubmit={submit}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') onCancel();
      }}
    >
      {allowTypeSelect && (
        <div className="channel-type-toggle" role="radiogroup" aria-label={ui('채널 유형')}>
          <button
            type="button"
            role="radio"
            aria-checked={channelType === 'text'}
            className={channelType === 'text' ? 'is-selected' : ''}
            onClick={() => setChannelType('text')}
            disabled={busy}
          >
            <Icon name="hash" size={12} />
            <span>{ui('채팅 채널')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={channelType === 'voice'}
            className={channelType === 'voice' ? 'is-selected' : ''}
            onClick={() => setChannelType('voice')}
            disabled={busy}
          >
            <Icon name="volume" size={12} />
            <span>{ui('음성 채널')}</span>
          </button>
        </div>
      )}
      <div className="channel-name-form-main">
        <label className="sr-only" htmlFor={id}>{label}</label>
        <input
          id={id}
          ref={input}
          name="channel-name"
          value={value}
          maxLength={CHANNEL_NAME_LIMIT}
          placeholder={label}
          onChange={event => setValue(event.target.value)}
          disabled={busy}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy || !normalizeChannelName(value) || (hasGroupConstraint && (!groupsForSave || !groupsForSave.length))}
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} aria-label={ui('취소')}><Icon name="close" size={12} /></button>
      </div>
      {Array.isArray(categories) && categories.length > 0 && (
        <label className="channel-category-picker">
          <span>{ui('카테고리')}</span>
          <select
            id={`${id}-category`}
            name="channel-category"
            aria-label={ui('카테고리 선택')}
            value={categoryId}
            onChange={event => setCategoryId(event.target.value)}
            disabled={busy}
          >
            <option value="">{ui('미분류')}</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      )}
      {access && access.available.length > 0 && (
        <div className="channel-group-section">
          <div className="channel-group-header">
            <span>{ui('접속 허용 그룹')} ({selectedGroups.length}/{access.available.length})</span>
            {canSelectAll && (
              <button
                type="button"
                className="channel-group-select-all"
                onClick={() => setSelectedGroups(access.selectable)}
                disabled={busy}
              >
                {ui('전체 선택')}
              </button>
            )}
          </div>
          <div className="channel-group-picker" role="group" aria-label={ui('접속 허용 그룹')}>
            {access.available.map((group, index) => {
              const checked = selectedGroups.includes(group);
              const canUncheck = canRemoveChannelGroup(selectedGroups, group, access);
              const canCheck = access.selectable.includes(group);
              const capLabel = groupCapabilityLabel(group, groupAccess?.settings);
              return (
                <label
                  key={group}
                  title={checked && !canUncheck ? ui('최소 하나 이상의 쓰기 가능 그룹이 필요합니다.') : undefined}
                >
                  <input
                    id={`${id}-group-${index}`}
                    name={`channel-group-${index}`}
                    type="checkbox"
                    checked={checked}
                    disabled={busy || (checked ? !canUncheck : !canCheck)}
                    onChange={event => toggleGroup(group, event.target.checked)}
                  />
                  <span className="channel-group-name">{group}</span>
                  {capLabel && <small>{capLabel}</small>}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * Discord/Slack-style channel list for chat (kind="text") or calls (kind="voice")
 * with collapsible categories, drag-and-drop organization, unread counts, and live call rosters.
 */
export default function ChannelList({
  kind,
  channels,
  categories = [],
  activeId,
  unread = {},
  members = {},
  joinedId = null,
  canManage = false,
  groupAccess = null,
  onSelect,
  onCreate,
  onRename,
  onUpdateGroups,
  onDelete,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onMoveChannel,
  onReorderCategory,
}) {
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const icon = kind === 'voice' ? 'volume' : 'hash';
  const label = kind === 'voice' ? ui('통화 채널') : ui('채팅 채널');
  const grouped = useMemo(() => groupChannelsByCategory(channels, categories), [channels, categories]);
  const allAvailableGroups = useMemo(
    () => (groupAccess ? resolveChannelGroupAccess(groupAccess).available : []),
    [groupAccess],
  );

  const toggleCategory = categoryId => {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const expandCategory = categoryId => {
    if (!categoryId) return;
    setCollapsed(current => {
      if (!current.has(categoryId)) return current;
      const next = new Set(current);
      next.delete(categoryId);
      return next;
    });
  };

  const clearDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  const renderChannelRow = channel => {
    const active = channel.id === activeId;
    const count = unread[channel.id] || 0;
    const inCall = members[channel.id] || [];
    const isEditing = editing?.type === 'edit-channel' && editing.id === channel.id;
    const isDropHere = dropTarget?.type === 'channel' && dropTarget.id === channel.id;

    if (isEditing) {
      return (
        <li key={channel.id}>
          <ChannelNameForm
            key={`edit-channel:${channel.id}`}
            initial={channel.name}
            label={ui('채널 이름')}
            submitLabel={ui('저장')}
            categories={onMoveChannel ? categories : null}
            initialCategoryId={channel.categoryId}
            groupAccess={onUpdateGroups ? groupAccess : null}
            initialGroups={normalizeObjectGroups(channel.item?.permission)}
            onSubmit={async ({ name, categoryId: nextCategoryId, groups: nextGroups }) => {
              const renamed = name === channel.name ? true : await onRename(channel.id, name);
              if (renamed === false) return false;
              if (onMoveChannel && (nextCategoryId || null) !== (channel.categoryId || null)) {
                const moved = await onMoveChannel(channel.id, nextCategoryId || null, null);
                if (moved === false) return false;
                if (nextCategoryId) expandCategory(nextCategoryId);
              }
              if (onUpdateGroups && Array.isArray(nextGroups) && nextGroups.length > 0) {
                const prevGroups = normalizeObjectGroups(channel.item?.permission);
                const changed = nextGroups.length !== prevGroups.length || nextGroups.some((group, index) => group !== prevGroups[index]);
                if (changed) {
                  const updated = await onUpdateGroups(channel.id, nextGroups);
                  if (updated === false) return false;
                }
              }
              return true;
            }}
            onCancel={() => setEditing(null)}
          />
        </li>
      );
    }

    const canDrag = Boolean(canManage && !channel.builtIn && onMoveChannel);
    const channelGroups = !channel.builtIn ? normalizeObjectGroups(channel.item?.permission) : [];
    const restrictedGroups = allAvailableGroups.length > 1
      && channelGroups.length > 0
      && channelGroups.length < allAvailableGroups.length;

    return (
      <li
        key={channel.id}
        className={`channel-row${active ? ' is-active' : ''}${joinedId === channel.id ? ' is-joined' : ''}${isDropHere ? ' is-drop-target' : ''}`}
        draggable={canDrag}
        onDragStart={canDrag ? event => {
          event.stopPropagation();
          setDragging({ type: 'channel', id: channel.id });
          event.dataTransfer.effectAllowed = 'move';
          try { event.dataTransfer.setData('text/plain', channel.id); } catch { /* ignore */ }
        } : undefined}
        onDragEnd={canDrag ? clearDrag : undefined}
        onDragOver={canManage && onMoveChannel && dragging?.type === 'channel' && dragging.id !== channel.id ? event => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTarget({ type: 'channel', id: channel.id });
        } : undefined}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget) && isDropHere) setDropTarget(null);
        }}
        onDrop={canManage && onMoveChannel && dragging?.type === 'channel' && dragging.id !== channel.id ? event => {
          event.preventDefault();
          event.stopPropagation();
          onMoveChannel(dragging.id, channel.categoryId ?? null, channel.builtIn ? null : channel.id);
          if (channel.categoryId) expandCategory(channel.categoryId);
          clearDrag();
        } : undefined}
      >
        <button
          type="button"
          className="channel-select"
          aria-current={active ? 'true' : undefined}
          onClick={() => onSelect(channel.id)}
        >
          <Icon name={icon} size={13} />
          <span className="channel-name">{channel.name}</span>
          {restrictedGroups && (
            <span
              className="channel-lock-icon"
              title={`${ui('접속 허용 그룹')}: ${channelGroups.join(', ')}`}
              aria-label={`${ui('제한된 그룹 채널')}: ${channelGroups.join(', ')}`}
            >
              <Icon name="lock" size={11} />
            </span>
          )}
          {count > 0 && !active && (
            <span className="channel-unread" aria-label={`${ui('읽지 않은 메시지')} ${count}`}>
              {count > 99 ? '99+' : count}
            </span>
          )}
          {kind === 'voice' && inCall.length > 0 && (
            <span className="channel-member-count" aria-label={`${ui('통화 참여자')} ${inCall.length}`}>
              {inCall.length}
            </span>
          )}
        </button>
        {canManage && !channel.builtIn && (
          <span className="channel-actions">
            <button
              type="button"
              onClick={() => setEditing({ type: 'edit-channel', id: channel.id })}
              aria-label={`${ui('이름 변경')}: ${channel.name}`}
              title={ui('채널 편집')}
            >
              <Icon name="pen" size={12} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(channel.id)}
              aria-label={`${ui('채널 삭제')}: ${channel.name}`}
              title={ui('채널 삭제')}
            >
              <Icon name="trash" size={12} />
            </button>
          </span>
        )}
        {kind === 'voice' && inCall.length > 0 && (
          <ul className="channel-members">
            {inCall.map(member => (
              <li key={member.peer_id}>
                {member.self ? ui('나') : `${member.nickname ?? '?'}#${member.tag_number ?? '?'}`}
                {member.muted && <Icon name="volumeOff" size={10} />}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const visibleSections = grouped.sections.filter(section => canManage || section.channels.length > 0);

  return (
    <nav className={`channel-list channel-list-${kind}${editing ? ' is-editing' : ''}`} aria-label={label}>
      <div
        className={`channel-list-heading${dropTarget?.type === 'uncategorized' ? ' is-drop-target' : ''}`}
        onDragOver={canManage && onMoveChannel && dragging?.type === 'channel' ? event => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTarget({ type: 'uncategorized' });
        } : undefined}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget) && dropTarget?.type === 'uncategorized') {
            setDropTarget(null);
          }
        }}
        onDrop={canManage && onMoveChannel && dragging?.type === 'channel' ? event => {
          event.preventDefault();
          event.stopPropagation();
          onMoveChannel(dragging.id, null, null);
          clearDrag();
        } : undefined}
      >
        <span>{label}</span>
        {canManage && (
          <span className="channel-heading-actions">
            {onCreateCategory && editing?.type !== 'new-category' && (
              <button
                type="button"
                className="channel-add"
                onClick={() => setEditing({ type: 'new-category' })}
                aria-label={ui('카테고리 추가')}
                title={ui('카테고리 추가')}
              >
                <Icon name="folder" size={13} />
              </button>
            )}
            {!(editing?.type === 'new-channel' && !editing.categoryId) && (
              <button
                type="button"
                className="channel-add"
                onClick={() => setEditing({ type: 'new-channel', categoryId: null })}
                aria-label={ui('채널 추가')}
                title={ui('채널 추가')}
              >
                <Icon name="plus" size={13} />
              </button>
            )}
          </span>
        )}
      </div>

      <ul className="channel-group-list">
        {grouped.uncategorized.map(renderChannelRow)}
        {editing?.type === 'new-channel' && !editing.categoryId && (
          <li>
            <ChannelNameForm
              key="new-channel:uncategorized"
              label={ui('새 채널 이름')}
              submitLabel={ui('추가')}
              allowTypeSelect
              initialType={kind}
              categories={categories}
              initialCategoryId={null}
              groupAccess={groupAccess}
              onSubmit={({ name, type, categoryId, groups }) => {
                const ok = onCreate(type, name, categoryId, groups);
                if (ok !== false && categoryId) expandCategory(categoryId);
                return ok;
              }}
              onCancel={() => setEditing(null)}
            />
          </li>
        )}
      </ul>

      {visibleSections.map(({ category, channels: categoryChannels }) => {
        const isCollapsed = collapsed.has(category.id);
        const isEditingCat = editing?.type === 'edit-category' && editing.id === category.id;
        const isCreatingInCat = editing?.type === 'new-channel' && editing.categoryId === category.id;
        const isDropHere = dropTarget?.type === 'category' && dropTarget.id === category.id;
        const collapsedUnread = kind === 'text'
          ? categoryChannels.reduce((sum, channel) => sum + (channel.id !== activeId ? (unread[channel.id] || 0) : 0), 0)
          : 0;
        const collapsedVoiceMembers = kind === 'voice'
          ? categoryChannels.reduce((sum, channel) => sum + (members[channel.id]?.length || 0), 0)
          : 0;
        const hasJoined = kind === 'voice' && categoryChannels.some(channel => channel.id === joinedId);
        const visibleChannels = isCollapsed
          ? categoryChannels.filter(channel => channel.id === activeId || channel.id === joinedId)
          : categoryChannels;
        const canDragCategory = Boolean(canManage && onReorderCategory);

        return (
          <div
            key={category.id}
            className={`channel-category${isCollapsed ? ' is-collapsed' : ''}${isDropHere ? ' is-drop-target' : ''}`}
            data-category-id={category.id}
          >
            {isEditingCat ? (
              <ChannelNameForm
                key={`edit-category:${category.id}`}
                initial={category.name}
                label={ui('카테고리 이름')}
                submitLabel={ui('저장')}
                onSubmit={({ name }) => onRenameCategory(category.id, name)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div
                className="channel-category-header"
                draggable={canDragCategory}
                onDragStart={canDragCategory ? event => {
                  event.stopPropagation();
                  setDragging({ type: 'category', id: category.id });
                  event.dataTransfer.effectAllowed = 'move';
                  try { event.dataTransfer.setData('text/plain', category.id); } catch { /* ignore */ }
                } : undefined}
                onDragEnd={canDragCategory ? clearDrag : undefined}
                onDragOver={canManage && dragging && ((dragging.type === 'channel' && onMoveChannel) || (dragging.type === 'category' && dragging.id !== category.id && onReorderCategory)) ? event => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTarget({ type: 'category', id: category.id });
                } : undefined}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget) && isDropHere) setDropTarget(null);
                }}
                onDrop={canManage && dragging ? event => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (dragging.type === 'channel' && onMoveChannel) {
                    onMoveChannel(dragging.id, category.id, null);
                    expandCategory(category.id);
                  } else if (dragging.type === 'category' && dragging.id !== category.id && onReorderCategory) {
                    onReorderCategory(dragging.id, category.id);
                  }
                  clearDrag();
                } : undefined}
              >
                <button
                  type="button"
                  className="channel-category-toggle"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleCategory(category.id)}
                >
                  <Icon name="chevron" size={11} className="channel-category-chevron" />
                  <span className="channel-category-name">{category.name}</span>
                  {isCollapsed && collapsedUnread > 0 && (
                    <span className="channel-unread" aria-label={`${ui('읽지 않은 메시지')} ${collapsedUnread}`}>
                      {collapsedUnread > 99 ? '99+' : collapsedUnread}
                    </span>
                  )}
                  {isCollapsed && collapsedVoiceMembers > 0 && (
                    <span className="channel-member-count" aria-label={`${ui('통화 참여자')} ${collapsedVoiceMembers}`}>
                      {collapsedVoiceMembers}
                    </span>
                  )}
                  {isCollapsed && hasJoined && <i className="channel-category-live-dot" aria-hidden="true" />}
                </button>
                {canManage && (
                  <span className="channel-actions">
                    <button
                      type="button"
                      onClick={() => {
                        expandCategory(category.id);
                        setEditing({ type: 'new-channel', categoryId: category.id });
                      }}
                      aria-label={`${category.name} ${ui('채널 추가')}`}
                      title={ui('이 카테고리에 채널 추가')}
                    >
                      <Icon name="plus" size={12} />
                    </button>
                    {onRenameCategory && (
                      <button
                        type="button"
                        onClick={() => setEditing({ type: 'edit-category', id: category.id })}
                        aria-label={`${ui('카테고리 이름 변경')}: ${category.name}`}
                        title={ui('카테고리 이름 변경')}
                      >
                        <Icon name="pen" size={12} />
                      </button>
                    )}
                    {onDeleteCategory && (
                      <button
                        type="button"
                        onClick={() => onDeleteCategory(category.id)}
                        aria-label={`${ui('카테고리 삭제')}: ${category.name}`}
                        title={ui('카테고리 삭제')}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            )}

            {(visibleChannels.length > 0 || isCreatingInCat || (!isCollapsed && canManage && categoryChannels.length === 0)) && (
              <ul className="channel-category-items">
                {visibleChannels.map(renderChannelRow)}
                {isCreatingInCat && (
                  <li>
                    <ChannelNameForm
                      key={`new-channel:${category.id}`}
                      label={ui('새 채널 이름')}
                      submitLabel={ui('추가')}
                      allowTypeSelect
                      initialType={kind}
                      categories={categories}
                      initialCategoryId={category.id}
                      groupAccess={groupAccess}
                      onSubmit={({ name, type, categoryId, groups }) => {
                        const ok = onCreate(type, name, categoryId, groups);
                        if (ok !== false && categoryId) expandCategory(categoryId);
                        return ok;
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                )}
                {!isCollapsed && !isCreatingInCat && canManage && categoryChannels.length === 0 && (
                  <li className="channel-category-empty">{ui('채널 없음')}</li>
                )}
              </ul>
            )}
          </div>
        );
      })}

      {editing?.type === 'new-category' && onCreateCategory && (
        <div className="channel-category-new">
          <ChannelNameForm
            key="new-category"
            label={ui('새 카테고리 이름')}
            submitLabel={ui('추가')}
            onSubmit={({ name }) => onCreateCategory(name)}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
    </nav>
  );
}
