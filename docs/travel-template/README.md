# 서울숲에서 한강까지, 우리끼리 하루

[편집 가능한 여행 캔버스 #2076](https://118.34.144.201/canvases/2076)

서울숲역에서 만나 서울숲·성수·뚝섬한강공원으로 이어지는 국내 하루 여행 공유 템플릿입니다.
공개 캔버스로 만들었으며 로그인한 사용자가 검색하고 접속할 수 있습니다.
날짜·참가자·약속 시간·예산은 예시입니다. 실제 예약이나 참가자에게 보내는 알림은 만들지 않았습니다.

- OpenStreetMap의 실제 도로·공원·수변 데이터를 직접 렌더링한 지도 배경.
- 움직일 수 있는 약속 장소·방문지 핀, 손그림 이동선과 해·하트 낙서.
- 원본 출처가 확인된 사진 3장과 사진 메모.
- 편집 가능한 일정표, 준비물 포스트잇, 예산·우천 대안 포스트잇.
- 약속 장소를 지도 앱에서 여는 링크와 아래쪽 사용 가이드.

지도 위 이동선은 **방문 순서**를 나타냅니다. 도보·대중교통 길찾기 경로나 소요시간을 계산한 결과가 아닙니다.
핀 좌표는 장소의 근사 위치이며 실제 만날 지점은 지도 앱에서 확인하고 협의하세요.
사진은 여행 분위기를 공유하기 위한 참고 사진이며 현재 현장이나 당일 날씨를 나타내지 않습니다.

[미리보기](preview.png) · [캔버스 전체 화면](canvas-screenshot.png) · [편집 가능한 객체 원본](seoul-day-trip.canvas.json) · [저장·재접속 검증](validation.json)

객체 원본에는 지도와 사진을 데이터 URL로 포함해 외부 이미지 호스팅에 의존하지 않습니다.
네이티브 텍스트·도형·손그림·포스트잇은 각각 편집할 수 있습니다. 지도 바탕은 이미지이며 대화형 지도 위젯은 아닙니다.
새 여행을 만들 때 핀, 메모, 시간, 참가자를 수정하고 객체 댓글·멘션으로 의견을 모을 수 있습니다.

## 출처

- 지도 데이터: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0. `assets/seoul-map.svg`는 해당 데이터를 새 스타일로 렌더링한 벡터 원본입니다. `map-metadata.json`에 범위를 기록했습니다.
- 서울숲 장소 안내: [서울 공식 관광정보](https://korean.visitseoul.net/etc-area/%EC%84%9C%EC%9A%B8%EC%88%B2/KOP001838).
- 한강 장소 안내: [서울시 뚝섬한강공원 소개](https://english.seoul.go.kr/ttukseom-hangang-park-j-bug/).
- 서울숲 데크 사진: [CartoonChess / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Seoul_Forest_boardwalk_with_tables.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- 서울숲 산책로 사진: [Striker9498 / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:20250513_%EC%84%9C%EC%9A%B8%EC%88%B2_%EC%82%B0%EC%B1%85%EB%A1%9C_1.jpg), CC0.
- 뚝섬한강공원 사진: [Wikihyo / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:20260416_%EB%9A%9D%EC%84%AC_%ED%95%9C%EA%B0%95_%EA%B3%B5%EC%9B%90_%ED%92%8D%EA%B2%BD_03.jpg), CC0.

사진 파일별 원본 URL과 라이선스는 [sources.json](sources.json)에 있습니다. 내려받은 썸네일을 그대로 배치했습니다.

## 재생성

```sh
node scripts/generate-travel-template.mjs
TRAVEL_SESSION_FILE=/path/to/private-session.json \
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs \
node scripts/create-travel-template-browser.mjs
```

새로 만든 전용 캔버스의 세션 파일에는 `token`, `user`, `canvas_id`가 필요합니다. 인증 정보는 저장소에 넣지 않습니다.
브라우저 적용 스크립트는 일반 편집과 같은 브로커 저장 경로를 사용하고 Redis 저장과 새로고침 후 객체·사진·본문을 비교합니다.
기존 캔버스에 다른 객체가 있으면 적용을 중단합니다.
