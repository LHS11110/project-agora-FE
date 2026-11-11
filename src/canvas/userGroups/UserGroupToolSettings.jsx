import { useMemo, useState, useEffect } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import UserAvatar from '../../components/account/UserAvatar.jsx';
import { groupMember, membersFromGroup } from './userGroupModel.js';
import './user-group.css';

export default function UserGroupToolSettings({ settings, canvasParticipants = [], user, token, onInsert, onTemplateChange }) {
  useUiLocale();
  const groups = settings?.groups || {};
  const groupNames = Object.keys(groups);
  const [selectedGroup, setSelectedGroup] = useState(() => groupNames[0] || '');
  const [selectedUsers, setSelectedUsers] = useState(() => []);

  // Update selected group if groups change and current selection is missing
  useEffect(() => {
    if (groupNames.length && !groupNames.includes(selectedGroup)) {
      setSelectedGroup(groupNames[0]);
    }
  }, [groupNames, selectedGroup]);

  // Current members of the selected canvas group
  const groupMembers = useMemo(() => {
    if (!selectedGroup || !groups[selectedGroup]) return [];
    return membersFromGroup(groups[selectedGroup], canvasParticipants);
  }, [selectedGroup, groups, canvasParticipants]);

  // Keep stage template synchronized so clicking the canvas uses current selection
  useEffect(() => {
    if (!onTemplateChange) return;
    if (selectedUsers.length > 0) {
      const chosen = canvasParticipants.filter(p => selectedUsers.includes(`${p.nickname}#${p.tag_number}`));
      onTemplateChange({
        groupTitle: chosen.length === 1 ? ui('{v0} 프로필', { v0: chosen[0].nickname }) : ui('사용자 그룹'),
        members: chosen.map((p, idx) => groupMember(p, idx)),
        shadowEnabled: false,
      });
    } else if (selectedGroup && groupMembers.length > 0) {
      onTemplateChange({
        groupTitle: selectedGroup,
        members: groupMembers,
        shadowEnabled: false,
      });
    } else if (user?.user_id != null) {
      onTemplateChange({
        groupTitle: ui('사용자 그룹'),
        members: [groupMember(user)],
        shadowEnabled: false,
      });
    }
  }, [selectedUsers, selectedGroup, groupMembers, canvasParticipants, user, onTemplateChange]);

  const handleInsertGroup = () => {
    if (!onInsert) return;
    onInsert({
      groupTitle: selectedGroup || ui('사용자 그룹'),
      members: groupMembers.length ? groupMembers : (user?.user_id != null ? [groupMember(user)] : []),
      shadowEnabled: false,
    });
  };

  const handleInsertSingleUser = (person) => {
    if (!onInsert) return;
    onInsert({
      groupTitle: ui('{v0} 프로필', { v0: person.nickname }),
      members: [groupMember(person)],
      shadowEnabled: false,
    });
  };

  const handleInsertSelectedUsers = () => {
    if (!onInsert || !selectedUsers.length) return;
    const chosen = canvasParticipants.filter(p => selectedUsers.includes(`${p.nickname}#${p.tag_number}`));
    onInsert({
      groupTitle: chosen.length === 1 ? ui('{v0} 프로필', { v0: chosen[0].nickname }) : ui('사용자 그룹'),
      members: chosen.map((p, idx) => groupMember(p, idx)),
      shadowEnabled: false,
    });
    setSelectedUsers([]);
  };

  const toggleUserSelection = (key) => {
    setSelectedUsers(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  };

  return <section className="inspector-section user-group-settings user-group-tool-panel">
    <strong className="inspector-label">{ui("사용자 그룹")}</strong>
    <small className="inspector-hint">{ui("설정 패널에서 그룹을 지정하거나 캔버스에 있는 사용자 프로필을 직접 삽입하세요.")}</small>

    {groupNames.length > 0 && <div className="user-group-picker-block">
      <label className="form-field">
        <span>{ui("캔버스 그룹 지정")}</span>
        <select className="plain-input" value={selectedGroup} onChange={e => { setSelectedGroup(e.target.value); setSelectedUsers([]); }}>
          {groupNames.map(name => <option key={name} value={name}>{name} ({groups[name]?.length || 0}{ui("명")})</option>)}
        </select>
      </label>
      <button type="button" className="button button-outline user-group-insert-btn" onClick={handleInsertGroup}>
        {ui("선택한 그룹 캔버스에 삽입")} ({groupMembers.length})
      </button>
    </div>}

    <div className="user-group-picker-block">
      <strong className="user-group-subheading">{ui("캔버스 사용자 프로필 직접 삽입")}</strong>
      <small className="inspector-hint">{ui("원하는 프로필을 바로 삽입하거나 여러 명을 선택해 그룹으로 삽입하세요.")}</small>

      {selectedUsers.length > 0 && <button type="button" className="button button-outline user-group-insert-btn" onClick={handleInsertSelectedUsers}>
        {ui("선택한 프로필 {v0}명 삽입", { v0: selectedUsers.length })}
      </button>}

      <div className="user-group-participant-list">
        {canvasParticipants.map(person => {
          const key = `${person.nickname}#${person.tag_number}`;
          const isSelected = selectedUsers.includes(key);
          return <div className={`user-group-participant-row${isSelected ? ' is-selected' : ''}`} key={key}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleUserSelection(key)} aria-label={key} />
            <UserAvatar user={person} token={token} />
            <div className="user-group-participant-info">
              <strong>{person.nickname}</strong>
              <small>#{person.tag_number}</small>
            </div>
            <button type="button" className="button button-outline user-group-quick-insert-btn" onClick={() => handleInsertSingleUser(person)}>
              {ui("삽입")}
            </button>
          </div>;
        })}
        {!canvasParticipants.length && user && <div className="user-group-participant-row" key="current-user">
          <UserAvatar user={user} token={token} />
          <div className="user-group-participant-info">
            <strong>{user.nickname}</strong>
            <small>#{user.tag_number}</small>
          </div>
          <button type="button" className="button button-outline user-group-quick-insert-btn" onClick={() => handleInsertSingleUser(user)}>
            {ui("내 프로필 삽입")}
          </button>
        </div>}
      </div>
    </div>
  </section>;
}
