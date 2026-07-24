---
name: transitway
description: >-
  사용자가 직접 정의한 여러 경로(way=경유지 순서)별 대중교통 소요시간을 계산해
  추천(최단) 경로와 함께 카카오톡 '나에게'로 보낼 때 사용합니다. 트리거:
  "출근 경로 보내줘", "way 시간 계산", "오늘 경로 추천 카톡", "경로별 몇 분 걸려",
  "transit brief". transit MCP로 각 경로의 구간을 ODsay로 조회·합산하고, 200자 이내
  하나의 메시지로 카카오톡 전송합니다.
---

# 사용자 지정 경로 브리핑 → 카카오톡

사용자가 등록한 여러 경로(way)의 대중교통 소요시간을 계산해, 추천 경로와 함께
카카오톡 '나에게 보내기'로 전송하는 작업입니다.

## 사전 요구사항

- **transit MCP** (이 플러그인의 자작 서버) — 도구 `set_way`, `get_ways`, `clear_ways`, `brief_ways`.
  - `KAKAO_REST_API_KEY` — 경유지 이름을 좌표로 바꾸는 지오코딩(카카오 로컬 REST).
  - `ODSAY_API_KEY` (+ `ODSAY_REFERER`) — 구간별 대중교통 소요시간(ODsay).
    ODsay 키는 등록 URI가 있으면 `ODSAY_REFERER`를 그 URI로 맞춰야 인증됩니다(기본 http://localhost:5173).
- **PlayMCP(kakao) 커넥터** — `KakaotalkChat-MemoChat`로 '나에게 보내기'. 미연결 시 안내 후 전송 중단.

## 1단계 — 경로(way) 등록/확인

- `get_ways`로 저장된 경로를 확인합니다.
- 없거나 바꾸려면 `set_way`로 저장합니다. path는 경유지를 순서대로:
  - 예: `set_way(id="way1", path="출발지 -> 환승역A -> 환승역B -> 도착지")`
  - 여러 개면 way1, way2, way3 … 로 반복 저장.
- 삭제는 `clear_ways`(id 지정 또는 전체).

## 2단계 — 소요시간 계산

- `brief_ways`를 호출하면 각 way의 경유지를 좌표로 바꾸고 구간별 ODsay 시간을 합산해,
  **추천(최단) 경로 + 경로별 시간**을 200자 이내 텍스트로 반환합니다.
- 좌표를 못 찾거나 조회 실패한 경로는 `확인불가`로 표기됩니다(추정 금지).

## 3단계 — 카카오톡 전송

- `brief_ways` 결과를 그대로 `KakaotalkChat-MemoChat`로 전송합니다. 하나의 메시지, 200자 이내.
- 형식:

```
[오늘의 경로 추천]

추천: way2 / 39분

경로 상세: [출발지]→[환승역]→[도착지]

다른 경로:
way1 52분 / way2 39분 / way3 47분
```

## 매일 아침 자동 실행

- `scripts/install-schedule.ps1` 실행 시 평일 07:20 자동 전송(Windows 작업 스케줄러 `Transitway`).
  PC가 그 시각 켜져 있어야 합니다. 해제: `scripts/uninstall-schedule.ps1`.

## 주의

- 소요시간은 경유지 구간별 ODsay 최단경로 합으로 근사합니다(환승 대기 등 오차 가능).
- 카카오톡 200자 제한을 지킵니다. 정보 제공용이며 투자·교통 자문이 아닙니다.
