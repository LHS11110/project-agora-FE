# AI 제공 서비스 약관 검토와 대응 — 2026-11-23

캔버스 AI 에이전트가 외부 AI 제공 서비스의 API를 호출하는 방식이 각 서비스의 약관에 맞는지 검토하고, 맞지 않는 부분을 코드·화면·이용약관으로 어떻게 고쳤는지 기록한다. 법률 자문이 아니며, 최종 약관 문구는 법률 검토를 권한다.

## 결론

| 제공 서비스 | 판단 | 조치 |
| --- | --- | --- |
| EXAONE (LG AI연구원) | **사용 불가** | 제공 서비스 목록에서 제거 |
| OpenAI | 사용 가능 | 연령·약관 확인, 국외 전송 동의 |
| Anthropic Claude | 사용 가능 | 위와 같음, AI 고지와 사실 확인 안내 추가 |
| Google Gemini | 조건부 사용 가능 | 위와 같음, 업무 목적·EEA 유료 키 확인 추가 |
| OpenRouter | 사용 가능 | 위와 같음, 모델 제공사의 학습 가능성 안내 |

개인 구독 로그인(OAuth)을 대신 쓰던 VM CLI 에이전트는 이전 작업에서 제거했다([canvas-frames-2026-11-22-after.md](benchmarks/canvas-frames-2026-11-22-after.md)). 아래는 API 키 방식에 대한 검토다.

## 약관에서 확인한 내용

모두 2026-11-23에 원문을 읽었다.

### EXAONE API 이용약관 (2026-11-09)
출처: <https://docs.exaone.ai/en/terms/terms-of-service>, <https://docs.exaone.ai/en/terms/privacy-policy>

- **2.1조:** 비상업 목적만 허용한다. "API를 귀하의 제품이나 서비스에 통합하는 방식을 포함해, 제3자가 AI 모델을 호출하거나 입력을 보내게 해서는 안 된다."
- **2.5조:** 재판매, 서브라이선스, 제3자 제공을 금지한다.
- **3.3조:** API 키의 공유·양도·대여를 금지한다. 키는 발급 후 30일이 지나면 만료된다.
- **8.1조:** 19세 이상만 쓸 수 있다.
- **2.3조와 개인정보처리방침:** 입력과 출력을 학습에 쓸 권리가 있다. 개인정보처리방침상 학습은 동의한 경우에만 하며, 동의는 철회할 수 있다.
- **확인하지 못한 문서:** 이 약관이 참조하는 Showroom 이용약관, 그리고 우선 적용되는 한국어판.

### OpenAI Services Agreement (2026-01-01 시행), Usage Policies (2026-11-20 시행)
출처: <https://openai.com/policies/services-agreement/>, <https://openai.com/policies/usage-policies/>

- **2.2조:** 고객 앱에 통합해 최종 사용자에게 제공하는 것을 허용한다.
- **3.1, 3.3(g)조:** 자격 증명을 여러 사람이 공유하는 것을 금지한다. API 키를 사고팔거나 양도하는 것도 금지한다.
- **3.3(c)조:** 미성년자가 쓰려면 보호자 동의가 필요하다.
- **4.2조:** 고객이 동의하지 않으면 입력과 출력을 학습에 쓰지 않는다.
- **16.12조:** 지원 국가 밖에서는 쓸 수 없다.

### Anthropic Commercial Terms (2025-06-17), Usage Policy (2026-11-12)
출처: <https://www.anthropic.com/legal/commercial-terms>, <https://www.anthropic.com/legal/aup>

- **A.1조:** 고객의 제품으로 최종 사용자에게 제공하는 것을 허용한다.
- **D.4조:** 재판매를 금지한다.
- **D.3조:** 출력의 사실 주장은 확인 없이 신뢰하면 안 된다는 점을 사용자에게 알려야 한다.
- **B조:** 입력과 출력으로 모델을 학습하지 않는다.
- **이용 정책:**
  - 사용자와 직접 대화하는 AI 에이전트는 상대가 AI라는 사실을 채팅 시작 시점이나 제품 화면에서 알려야 한다.
  - 개인 구독 등 승인되지 않은 경로로 접근하게 하는 것을 금지한다.

### Gemini API Additional Terms (2026-03-23)
출처: <https://ai.google.dev/gemini-api/terms> (이동 후 <https://aistudio.google.com/docs/terms>)

- **연령:** 18세 이상만 쓸 수 있다. 18세 미만이 접근할 가능성이 있는 앱에서는 쓸 수 없다.
- **용도:** 개발자가 업무 목적으로 쓰는 서비스이며, 소비자용이 아니다.
- **지역:** EEA·스위스·영국 사용자에게는 유료 서비스로만 제공할 수 있다.
- **데이터 사용:** 무료 사용분의 입력과 출력은 제품 개선에 쓰이고 사람이 검토할 수 있다. 유료 사용분은 개선에 쓰지 않는다.
- **키 공유:** 별도 조항이 없다.

### OpenRouter Terms / Privacy (2026-08-31)
출처: <https://openrouter.ai/terms>, <https://openrouter.ai/privacy>

- **연령:** 18세 이상만 쓸 수 있다.
- **키 관리:** 키 관리 책임은 사용자에게 있다.
- **5.1조:** 자기 제품에 통합해 고객에게 제공하는 것을 전제한다. 사용자는 각 모델의 약관을 지켜야 한다.
- **7.4, 7.14조:** 모델 접근권을 재판매하는 것을 금지한다.
- **데이터 사용:** OpenRouter 자체는 학습에 쓰지 않는다. 실제 모델 제공사는 학습에 쓸 수 있다.

### 한국 AI 기본법
- **확인한 것:** 「인공지능 발전과 신뢰 기반 조성 등에 관한 기본법」 현행 시행일 2026-07-21(법률 제21311호)과, 시행령(대통령령 제36580호, 2026-08-20 시행)이 있다는 사실.
- **확인하지 못한 것:** 법제처 사이트가 본문을 스크립트로 불러와서 다음 조문을 읽지 못했다. 법률 검토가 필요하다.
  - 사업자 정의
  - 생성형 AI 사전 고지·결과물 표시 의무
  - 과태료 조항

## 발견한 문제와 대응

| 문제 | 근거 | 대응 | 위치 |
| --- | --- | --- | --- |
| EXAONE을 서비스에 통합해 제공 (서버 키·개인 키 모두) | EXAONE 2.1·2.5·3.3조 | 목록에서 제거. C++·Python이 `provider: "exaone"`을 거부하고, 서버의 `AGENT_API_KEY`는 더 읽지 않는다. 브라우저에 남은 EXAONE 키는 지운다. | BE `agent/agora_agent/providers.py`, `cpp/include/service/CanvasAgentTools.hpp`; FE `src/components/agentPreferences.js`, `agentCredentials.js` |
| 연령 제한 (Gemini·OpenRouter 18세, OpenAI는 미성년자 보호자 동의) | 각 약관 | 제공 서비스별 첫 사용 시 "만 18세 이상, 약관·이용 정책 준수, 개인 키 소유자 책임"을 확인받는다. 확인 전에는 패널과 멀티 에이전트 실행 모두 막는다. | FE `src/components/agentConsent.js`, `CanvasAgentPanel.jsx`, `CanvasPage.jsx` |
| 다른 참가자의 캔버스 내용이 해외 AI 제공 서비스로 전송됨 | 개인정보 국외 이전 고지·동의 | 제공 서비스별 국외 전송 동의 체크(별도 항목). 개인정보처리방침 제5조에 이전받는 자·국가·시기·방법·목적·보유 기간·거부 방법을 적는다. 에이전트는 요청자가 읽을 수 있는 객체만 읽는다. | FE `agentConsent.js`, `src/legal/legalContent.js` |
| AI 고지, 사실 확인 안내 | Anthropic 이용 정책, D.3조 | 에이전트 입력창 위에 "AI가 생성한 응답입니다. 사실 관계는 직접 확인한 뒤 사용하세요." 표시. 이용약관 제6조에도 명시. | FE `CanvasAgentPanel.jsx`, `legalContent.js` |
| 무료 키 데이터의 학습·사람 검토 | Gemini 무료 사용분, OpenRouter 모델 제공사 | 동의 화면에 제공 서비스별 데이터 사용 요약과 약관·정책 원문 링크 | FE `agentPreferences.js`(`dataNotice`) |
| Gemini의 업무 목적·EEA 유료 키 조건 | Gemini Additional Terms | Gemini에만 추가 확인 항목. 이용약관 제6조에 명시. | FE `agentPreferences.js`(`extraConsent`), `legalContent.js` |
| 키 공유·양도 | OpenAI 3.1·3.3(g)조, EXAONE 3.3조 | 이용약관 제2·6조. 키는 제공 서비스별로 현재 탭에만 보관하고, 요청한 사용자 본인의 요청에만 쓴다. | FE `agentCredentials.js`, `legalContent.js` |
| 재판매 금지 | Anthropic D.4조, OpenRouter 7.4조 | 해당 없음. 모델 접근권을 따로 판매하지 않는다. | — |

## 이용약관으로 해결되지 않는 부분
- **EXAONE:** LG가 키 소유자에게 거는 제한이라 우리 약관으로 바꿀 수 없다. 그래서 기능에서 제거했다.
- **연령과 국외 전송:** 약관 문구만으로는 부족하다. 실제 확인 단계(동의 화면)를 두었다.
- **AI 고지:** Anthropic 이용 정책은 채팅 시작 시점이나 제품 화면에서 알리도록 정한다. 그래서 화면에 고정 문구를 두었다.

## 남은 일
- **캔버스 관리자 설정:** 허용할 제공 서비스를 고르는 설정은 넣지 않았다. 어느 약관도 요구하지 않는 개인정보 강화 조치이고, Spring 문서 모델·ES 매핑·DB 저장소까지 바꿔야 한다.
- **법률 검토 필요:**
  - 한국 AI 기본법의 고지·표시 의무
  - 개인정보 국외 이전 동의 방식의 적정성
  - EXAONE 한국어 약관과 Showroom 약관
- **동의 기록의 저장 위치:** 동의 여부는 이용자 브라우저에만 저장한다. 서버에 동의 기록을 남겨야 하는지도 법률 검토 대상이다.

# 프로젝트 전체 라이선스·약관 점검 — 2026-11-23

대상은 FE, BE, hypervisor-for-agora, project-agora-DB, project-agora-Wall 다섯 저장소다. 확인한 항목은 다음과 같다.
- 의존성 라이선스
- 저장소 자체 라이선스와 고지 파일
- 컨테이너 이미지
- 외부 서비스 약관(로그인·폰트·메일·동영상)

## 의존성 라이선스

| 대상 | 방법 | 결과 |
| --- | --- | --- |
| FE npm 운영 의존성 85개 | `package-lock.json` 운영 항목의 license 필드 | MIT 67, ISC 10, Apache-2.0 3, BSD-3-Clause 1, MPL-2.0 OR Apache-2.0 1 등. GPL·AGPL·비상업 라이선스 없음 |
| FE Rust(WASM) 크레이트 116개 | `cargo metadata` | MIT/Apache-2.0/Zlib/ISC/CC0/Unicode-3.0 계열. copyleft 없음. 고지는 `public/licenses/rust/`에 생성됨 |
| BE Python(agent, search) | requirements 고정 버전 | openai Apache-2.0, anthropic MIT, mcp MIT, python-dotenv BSD-3, numpy BSD-3, onnxruntime MIT, tokenizers Apache-2.0, requests Apache-2.0 |
| BE C++ | CMake 링크 대상 | uWebSockets·uSockets Apache-2.0, nlohmann/cpp-httplib MIT, OpenSSL 3 Apache-2.0, zlib, FreeTDS LGPL(동적 링크, 고지 기존 기재) |
| BE Spring | `spring/gradle.lockfile` | Apache-2.0 중심, MSSQL JDBC MIT, H2 EPL/MPL, Yubico WebAuthn BSD. 고지 기존 기재 |
| 검색 임베딩 모델 | `search/download_model.py` | intfloat/multilingual-e5-small, MIT, 리비전 고정, 모델 카드 보존 |
| Wall Elixir 16개 | `mix.lock` | Phoenix·Plug·Bandit 등 MIT/Apache-2.0. 빌드 시 `package_notices.exs`가 각 LICENSE를 이미지에 복사하고, 없으면 빌드 실패 |
| hypervisor 작업공간 런타임 | `package.json` | Automerge MIT(번들 머리말에 전문 포함) |
| Python SDK 배포 파일(FE `public/downloads`) | wheel 내용 | MIT, `LICENSE` 포함 |

## 컨테이너 이미지와 서버 소프트웨어

| 구성 요소 | 판단 |
| --- | --- |
| SQL Server 2022 | 운영 기본값과 실제 배포가 Express(무료 운영 허용). AG 템플릿의 Standard는 별도 구매가 필요하며 DB 고지에 기재됨 |
| Redis 8.6.7 / Redis Insight | RSALv2·SSPLv1·AGPLv3 중 선택. 내부 캐시로만 쓰고 데이터베이스 서비스로 제공하지 않으므로 문제없음 |
| Elasticsearch 8.19.22 + nori | 공식 배포 약관(ELv2 등). 관리형 Elasticsearch로 제공하지 않으므로 문제없음 |
| nginx, coturn, HAProxy, Alpine, Ubuntu, Temurin, Python, Node | 수정 없이 실행만 하고 배포하지 않음. HAProxy(GPL-2.0)는 Wall 고지에 없어 **추가함** |
| 게스트 VM의 Lean 4(Apache-2.0), Rocq(LGPL-2.1) | 게스트 이미지에 복사됨. hypervisor 고지에 없어 **추가함**. 이미지를 배포할 때는 소스 제공 의무가 생김 |

## 외부 서비스 약관

| 서비스 | 확인한 기준 | 발견 | 조치 |
| --- | --- | --- | --- |
| Google 로그인 | [Google 로그인 브랜딩 가이드](https://developers.google.com/identity/branding-guidelines) | 아이콘만 있는 원형 버튼은 허용 여부가 불분명함. 테두리 색이 규격(#747775)과 달랐음 | 글자가 있는 밝은 테마 버튼으로 변경(흰 바탕, 1px #747775 테두리, #1F1F1F 글자, 표준 색 G 그대로) |
| Kakao 로그인 | [Kakao 로그인 디자인 가이드](https://developers.kakao.com/docs/ko/kakaologin/design-guide) | 심볼 색 #191919(규정은 #000000), 원형(규정 radius 12px), 레이블 없음 | #FEE500 컨테이너, #000000 심볼, 레이블 "카카오 로그인"(#000000 85%), radius 12px로 변경. 공식 리소스로 교체 권장 |
| NAVER 로그인 | NAVER Developers 가이드는 이 환경에서 열리지 않음 | "N"을 글꼴로 그린 표시는 공식 로고가 아닐 수 있음 | 레이블 "네이버 로그인"을 추가. **공식 버튼 리소스로 교체가 필요함**(FE `THIRD_PARTY_NOTICES.md`에 기재) |
| ORCID 로그인 | [Public API 약관](https://info.orcid.org/public-client-terms-of-service/), [로그인 가이드](https://info.orcid.org/documentation/integration-guide/orcid-oauth-sign-in-guidelines/) | 아이콘만 있는 버튼(동작 설명 없음). Public API는 비상업 용도만 허용하고 자격 증명은 개인 소유 | 공식 iD 아이콘 24px에 "ORCID로 계속하기" 문구 추가. 상표 표기 추가. **수익을 내는 서비스가 되면 ORCID 회원 자격 증명이 필요함** |
| Google Fonts | 폰트 라이선스(OFL 1.1), 개인정보 | 라이선스 문제없음. 글꼴 요청 시 IP가 Google로 전달된다는 고지가 없었음 | 개인정보처리방침 제2조에 고지 추가 |
| Gmail SMTP | 개인정보 처리 위탁·국외 이전 | 인증 메일의 수신 주소와 내용이 Google을 거친다는 고지가 없었음 | 개인정보처리방침 제2조에 고지 추가 |
| YouTube | YouTube API 서비스 약관 | 이전 작업에서 플레이어 표시·크기 문제를 수정함. 데이터 고지는 없었음 | 개인정보처리방침 제2조에 고지 추가 |
| 상표 일반 | 각 사 브랜드 가이드 | 상표 귀속 표기가 없었음 | 이용약관 제5조와 FE 고지에 상표 표기·비보증 문구 추가 |

## 남은 확인 사항
- NAVER 로그인 버튼을 공식 리소스로 교체해야 한다. Kakao 심볼도 공식 리소스 사용을 권장한다.
- ORCID Public API는 비상업 조건이 붙어 있다. 서비스가 유료화되거나 수익을 내면 ORCID 회원 가입이 필요하다.
- 컨테이너 이미지나 VM 이미지를 외부에 배포하는 경우에는 이미지별 라이선스 목록과 소스 제공 의무를 다시 검토해야 한다. 지금은 배포하지 않는다.
