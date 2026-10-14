# NORTHSTAR Product Studio

Figma 작업 파일을 참고한 1,500개 객체의 편집 가능한 예시입니다. 안내 보드 60개와 작업 영역 16개 × 90개로 구성하며, 웹 대시보드·모바일 화면·디자인 시스템·컴포넌트·온보딩·마케팅·사용자 흐름·리서치·릴리스·디자인 리뷰를 넓은 공간에 배치합니다.

- [객체 데이터](northstar-product-studio-1500.json)
- [영역별 위치와 객체 수](northstar-product-studio-1500-layout.json)
- [배포된 예시 캔버스](https://112.168.71.147/canvases/2021)

저장소 루트에서 다음 명령으로 데이터를 다시 생성하고 객체 수와 manifest 유효성을 확인합니다.

```bash
node scripts/generate-studio-template.mjs
```

각 요소는 개별 객체로 편집할 수 있습니다. Space + 드래그로 이동하고 Ctrl + 휠로 확대·축소하며, 전체 객체 목록에서 원하는 객체로 이동할 수 있습니다.
