import {ui} from '../../i18n/locale.js';
const messages={
 GROUP_NAME_INVALID:'그룹 이름은 마침표·제어 문자 없이 UTF-8 80바이트 이하여야 합니다.',
 GROUP_ALREADY_EXISTS:'같은 이름의 그룹이 이미 있습니다.',
 GROUP_NOT_FOUND:'그룹이 없어졌습니다. 최신 목록을 확인하세요.',
 GROUP_LIMIT:'그룹은 최대 128개까지 생성할 수 있습니다.',
 GROUP_IN_USE:'객체가 사용 중인 그룹입니다. 객체의 권한 그룹을 먼저 변경하세요.',
 GROUP_IS_INITIAL:'초기 참여 그룹을 먼저 다른 그룹으로 변경하세요.',
 GROUP_READ_REQUIRED:'읽기 권한이 있는 일반 그룹을 선택하세요.',
 SETTINGS_OWNER_REQUIRED:'소유자와 관리자 그룹의 기본 권한은 제거할 수 없습니다.',
 SETTINGS_ACCESS_DENIED:'캔버스 관리자만 이 작업을 수행할 수 있습니다.',
 AUTH_006:'캔버스 관리자만 이 작업을 수행할 수 있습니다.',
 SETTINGS_USER_NOT_FOUND:'캔버스에 등록된 참여자만 그룹에 추가할 수 있습니다.',
 SETTINGS_CONFLICT:'다른 변경이 먼저 저장되었습니다. 최신 설정을 확인한 뒤 다시 시도하세요.',
 SETTINGS_INVALID_INPUT:'설정값을 확인하세요.',
 SETTINGS_STORAGE_ERROR:'설정을 저장하지 못했습니다. 연결과 저장소 상태를 확인하세요.',
};
export function managementError(error){const code=typeof error==='string'?error:error?.code;return ui(messages[code]||(typeof error==='string'?error:error?.message)||'봇 작업을 완료하지 못했습니다.');}
