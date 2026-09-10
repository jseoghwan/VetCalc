# KUVECC ER · ICU Tools

건국대 응급중환자의학과 내부용 임상 계산기 · 프로토콜 모음 (PWA).

## 구조

```
index.html              홈 — 도구 목록 (새 계산기는 여기 카드 추가)
tools/bloodgas.html     혈액가스 판독 (VBGA / ABGA)
tools/…                 앞으로 추가되는 계산기·프로토콜 (파일 하나 = 도구 하나)
manifest.webmanifest    앱 이름·아이콘·전체화면 설정
sw.js                   오프라인 캐시 (파일 갱신 시 VERSION 숫자 올리기)
icons/                  앱 아이콘
```

## 업데이트 절차

1. 바뀐 파일을 이 저장소에 올린다 (웹에서 Add file → Upload files, 같은 이름이면 덮어씀).
2. 새 도구를 추가했으면 `index.html`에 카드를 하나 추가하고, `sw.js`의 `PRECACHE` 목록에 파일 경로를 넣는다.
3. `sw.js`의 `VERSION`을 `v1 → v2`처럼 올린다. 이미 설치한 폰도 다음 접속 때 새 파일을 받는다.
4. 1–2분 뒤 사이트에 반영된다.

## 주의

- 저장소가 public이므로 링크를 아는 사람은 누구나 열 수 있다 (검색엔진 색인은 noindex·robots.txt로 막아 둠). 환자 정보·개인정보는 절대 넣지 않는다.
- 임상 판단의 보조 도구이며 최종 결정은 담당 수의사에게 있다.
