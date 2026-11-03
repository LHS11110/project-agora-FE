# 하단 도구 단축키

선택 도구부터 화면 순서와 동일하게 배정합니다. 실행 취소는 기존 Ctrl/⌘+Z를 유지합니다.

| 키 | 도구 |
| --- | --- |
| Ctrl+1 | 선택 |
| Ctrl+2 | 손 |
| Ctrl+3 | 펜 |
| Ctrl+4 | 지우개 |
| Ctrl+5 | 레이저 포인터 |
| Ctrl+6 | 포스트잇 |
| Ctrl+7 | 도형 |
| Ctrl+8 | 연결 |
| Ctrl+9 | 텍스트 |
| Ctrl+0 | 테이블 |
| Ctrl+Shift+1 | 그래프 |
| Ctrl+Shift+2 | 사진 업로드 |

Meta(⌘) 조합과 숫자 키패드도 지원합니다. 버튼 툴팁과 aria-keyshortcuts에 표시하며, 화면 순서와 키 매핑은 `quickDockShortcuts.js`를 공유합니다. 입력창·Monaco·메뉴·모달·IME 조합 중에는 도구를 바꾸지 않습니다. 연결 준비 전, 객체 편집·드래그·드로잉·화면 이동·다중 선택 진행 중에도 제외합니다. 읽기 전용 참여자는 선택·손·레이저만 사용할 수 있습니다. 반복 키 입력은 중복 실행하지 않습니다.

검증: `tests/quickDockShortcuts.test.js`, `tests/integration/quick-dock-shortcuts.mjs`, 실제 CanvasPage를 사용하는 `tests/integration/canvas-undo-page.mjs`의 도구 선택 및 기존 실행 취소 회귀 검사.
