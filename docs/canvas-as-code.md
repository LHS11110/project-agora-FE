# FreLog Canvas as Code

캔버스 상단 **캔버스 코드**에서 선언형 JSON을 작성하고 **변경 검토 → 검토한 변경 적용**으로 반영합니다. Monaco JSON 에디터, 예제, 파일 가져오기/다운로드를 제공합니다. 내려받은 JSON을 Git 등으로 버전 관리할 수 있습니다.

```json
{
  "version": 1,
  "mode": "merge",
  "canvas": { "width": 1600, "height": 1000 },
  "items": {
    "heading": {
      "kind": "text", "x": 160, "y": 100, "width": 360,
      "fontSize": 24, "format": "markdown", "text": "# FreLog\n$E=mc^2$"
    },
    "service": {
      "kind": "shape", "shapeType": "rectangle",
      "x": 760, "y": 180, "width": 260, "height": 160, "color": "#617d68"
    },
    "dependency": {
      "kind": "connector", "from": "heading", "to": "service",
      "strokeWidth": 2, "endHead": "triangle"
    }
  },
  "remove": []
}
```

## 선언 규칙

- `items`의 키가 영구 객체 ID입니다. 같은 ID는 수정, 새 ID는 생성합니다. 기존 객체의 kind 변경은 새 ID를 사용합니다.
- 기본 `merge`는 생략한 객체 및 기존 객체에서 생략한 필드를 유지합니다. 예: `{"kind":"text","x":300}`으로 기존 텍스트 위치만 바꿀 수 있습니다.
- `remove`에 삭제할 ID를 넣습니다. 연결된 객체 삭제 시 해당 connector도 삭제해야 합니다.
- `replace`는 items에 없는 객체를 삭제합니다. 기존 ID에서 생략한 필드는 유지합니다. 검토 목록에서 삭제 항목을 확인하세요.
- 공간은 브라우저 크기와 무관한 1600×1000입니다. x/y/width/height 및 stroke.points의 x/y는 이 공간의 픽셀 단위입니다. 범위 밖 좌표도 사용할 수 있습니다.
- rotation은 도, fontSize/strokeWidth는 픽셀, opacity는 0~1입니다. 커넥터 bend와 contentScale은 기존 캔버스의 값입니다.
- text/note는 text, code는 code/filename/language, math는 formula, shape는 shapeType을 사용합니다.
- table은 문자열 배열 columns와 같은 열 수를 가진 문자열 2차원 배열 rows를 사용합니다(최대 100행, 30열).
- image는 src/filename, link는 url/mediaType/title 등을 사용합니다. 이미지 업로드는 기존 이미지 도구를 사용하고 JSON에는 해당 src를 지정합니다.
- stroke는 points 및 brush(`pen`, `ink`, `highlighter`, `spray`), opacity, simulatePressure, complete를 사용합니다.
- groupId가 같은 객체는 함께 이동·회전합니다.
- permission을 생략한 새 객체는 현재 사용자의 기본 권한 그룹을 사용합니다. 기존 서버 권한 검사가 적용됩니다.
- Automerge 내부 데이터는 내보내지 않습니다. 내용 수정은 기존 CRDT 이력을 보존합니다.

## JavaScript 접근

해당 캔버스가 열린 브라우저 콘솔 또는 같은 페이지의 스크립트에서 사용할 수 있습니다. 페이지를 떠나면 API가 제거됩니다. 외부 HTTP API/CLI는 포함하지 않습니다.

```js
const api = window.frelogCanvas;
const document = api.read(); // 독립적인 JSON 객체
const plan = api.plan({
  version: 1,
  mode: 'merge',
  items: { title: { kind: 'text', x: 100, y: 100, text: 'Hello from code' } }
});
console.log(plan.creates, plan.updates, plan.deletes);
api.apply(plan); // 검토한 계획을 적용, 저장 요청 대기열 등록
```

검토 이후 다른 사용자나 마우스 편집으로 캔버스가 변경되면 적용을 중단합니다. 다시 plan을 만들거나 UI에서 변경 검토를 실행하세요. 단순 서버 저장 확인으로 내부 CRDT 정보만 바뀐 경우는 검토를 무효화하지 않습니다.

변경은 기존 P2P 및 서버 저장 대기열로 전달됩니다. `apply`의 `status: 'queued'`는 서버 저장 완료를 의미하지 않습니다. 재접속 시 대기 중인 저장 요청을 처리합니다. 여러 객체 변경은 서버가 객체별로 처리하므로 원자적인 트랜잭션이나 자동 롤백은 제공하지 않습니다. 권한 오류 등의 경우 일부 변경만 저장될 수 있으며 기존 캔버스 오류 알림으로 확인합니다.

## 내용 렌더링과 연결 이름

새 내용 객체는 `kind: "text"`와 `text` 원문을 사용합니다. `renderMode`는 `plain`, `markdown`, `latex`, `code` 중 선택합니다. 코드 모드는 `language`와 `filename`도 설정할 수 있습니다. 기존 `kind: "code"`, `kind: "math"` 객체도 계속 지원하며 렌더링 방식을 변경할 수 있습니다.

연결 객체에는 `label`로 이름을 지정하고 `labelMode`를 `plain`, `markdown`, `latex` 중 선택합니다. Markdown 이름에서 `$...$`로 수식을 함께 사용할 수 있습니다.

연결의 `bendPointCount`는 곡률 조절점 개수입니다(기본 1개, 최대 32개). `bendPoints`는 같은 길이의 `{ x, y }` 배열로, 각 점의 균등 기준 위치에 대한 이동량을 연결 길이로 나눈 값입니다. x는 연결 진행 방향, y는 수직 방향이며 `rotation`에 따라 함께 회전합니다. 배열을 생략하면 기존 `bend` 곡선을 바탕으로 점을 배치합니다.

화살표 머리는 `startHead`, `endHead`로 설정합니다: `none`, `triangle`, `triangle-outline`, `open`, `double`, `half`, `diamond`, `diamond-outline`, `circle`, `circle-outline`, `square`, `square-outline`, `bar`, `double-bar`, `crowfoot`.

- 도형 내부 색상은 `fill: "#RRGGBB"`로 지정합니다. `fill: ""` 또는 생략하면 내부는 투명합니다. 테두리는 `color`로 별도 지정하며 선 형태의 화살표에는 내부 채우기를 적용하지 않습니다.

- `kind: "user-group"`은 사용자 프로필 묶음입니다. `groupTitle`과 `members` 배열을 저장합니다. 각 멤버는 `user_id`, `nickname`, `tag_number`, `profile_image`(서버 이미지 URL), `borderColor`, `nameColor`를 사용하며 최대 50명입니다. 접속 권한 설정과는 별개입니다.
