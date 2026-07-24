# transitway — Claude Code 플러그인 마켓플레이스

사용자가 직접 정의한 경유지 경로(way)별 대중교통 소요시간을 계산해,
매일 아침 **카카오톡 '나에게 보내기'**로 전송하는 Claude Code 플러그인.

ODsay + 카카오 로컬 API + PlayMCP(KakaoTalk) 조합.  
커스텀 MCP 서버 · 스킬 · 훅 · 에이전트 · 슬래시 커맨드 포함.

---

## 설치

```
/plugin marketplace add sealworldking/Claude_Custom_Plugin
/plugin install transitway@transitway
/reload-plugins
```

로컬에서 바로 쓰려면:
```
/plugin marketplace add <이 폴더 경로>
```

---

## 사전 준비

### 1. 환경변수 설정 (관리자 PowerShell, 1회)

```powershell
setx KAKAO_REST_API_KEY "여기에_카카오_REST_키"
setx ODSAY_API_KEY "여기에_ODsay_키"
```

설정 후 Claude Code 재시작 필요.

| 변수 | 용도 | 발급처 |
|------|------|--------|
| `KAKAO_REST_API_KEY` | 경유지 이름 → 좌표 변환 | [카카오 개발자 콘솔](https://developers.kakao.com) → 앱 → REST API 키 |
| `ODSAY_API_KEY` | 구간별 대중교통 소요시간 | [ODsay Lab](https://lab.odsay.com) 회원가입 후 발급 |
| `ODSAY_REFERER` | ODsay 등록 URI (선택) | 기본값 `http://localhost:5173` |

### 2. PlayMCP(카카오) 커넥터 연결 (1회)

claude.ai → **Connectors** → KakaoTalk PlayMCP 연결.  
`KakaotalkChat-MemoChat` 도구가 활성화되어야 카카오톡 전송 가능.

---

## 사용법

### Step 1 — 경로(way) 등록

경로는 경유지를 순서대로 나열해 저장합니다. **한 번만** 하면 됩니다.

**자연어로 여러 개 등록:**
```
way 2개 등록해줘.
way1: 강남역 -> 선릉역 -> 판교역
way2: 강남역버스정류장 -> 양재역 -> 판교역
```

**개별 등록:**
```
way1으로 "홍대입구역 -> 합정역 -> 여의도역" 경로 저장해줘
```

**확인:**
```
등록된 way 목록 보여줘
```

**수정/삭제:**
```
way1 삭제해줘
전체 way 초기화해줘
```

---

### Step 2 — 브리핑 전송

**방법 A — 슬래시 커맨드 (가장 빠름)**
```
/transitway
```

**방법 B — 자연어**
```
오늘 경로 카톡으로 보내줘
출근 경로 브리핑해줘
way 시간 계산해서 카카오톡 전송해줘
transit brief
```

**방법 C — 스킬 직접**
```
/transitway:transitway
```

**전송 결과 예시:**
```
[오늘의 경로 추천]

추천: way1 / 43분

경로 상세: 강남역→선릉역→판교역

다른 경로:
way1 43분 / way2 51분
```

---

### Step 3 — (선택) 평일 자동 전송

매일 07:20 카카오톡 자동 전송 설정.

```powershell
# 관리자 PowerShell
& "$env:USERPROFILE\.claude\plugins\cache\transitway\transitway\2.0.0\scripts\install-schedule.ps1"
```

경로는 `cache\<마켓플레이스>\<플러그인>\<버전>\` 구조다. `2.0.0` 자리는 설치된 버전으로 맞춘다.

카카오톡 커넥터가 연결된 Claude Code 프로젝트 폴더를 지정:
```powershell
setx TRANSITWAY_PROJECT_DIR "C:\내_프로젝트_폴더"
```

- 작업 스케줄러 작업명: `Transitway`
- PC가 해당 시각 켜져 있어야 실행됨
- 로그: `scripts/logs/run-YYYYMMDD.txt`
- 해제: `scripts/uninstall-schedule.ps1`

---

## 활성화되는 기능

| 기능 | 종류 | 트리거 |
|------|------|--------|
| `/transitway` | 슬래시 커맨드 | `/transitway` 입력 |
| `transitway:transitway` | 스킬 | "경로 카톡으로", "출근 브리핑" 등 자연어 |
| `route-advisor` | 에이전트 | 경로 비교·추천 요청 시 자동 호출 |
| SessionStart 훅 | 훅 | 세션 시작 시 등록 경로 수 자동 표시 |
| transit MCP | MCP 서버 | `set_way` / `get_ways` / `clear_ways` / `brief_ways` |

---

## MCP 도구 직접 사용

| 도구 | 기능 | 예시 |
|------|------|------|
| `set_way` | 경로 저장 | `set_way(id="way1", path="출발지 -> 환승역 -> 도착지")` |
| `get_ways` | 전체 경로 조회 | — |
| `clear_ways` | 경로 삭제 | `clear_ways(id="way1")` 또는 id 없이 전체 삭제 |
| `brief_ways` | 소요시간 계산 + 추천 텍스트 반환 | — |

---

## 저장소 구조

```
Claude_Custom_Plugin/
├─ .claude-plugin/marketplace.json   # 마켓플레이스 매니페스트
├─ plugins/
│  └─ transitway/                    # 플러그인 본체
│     ├─ .claude-plugin/plugin.json
│     ├─ .mcp.json
│     ├─ mcp-server/index.js         # 커스텀 MCP 서버 (무의존성)
│     ├─ skills/transitway/SKILL.md
│     ├─ agents/route-advisor.md
│     ├─ commands/transitway.md
│     ├─ hooks/
│     ├─ scripts/
│     └─ config.example.json
└─ README.md
```

---

## 주의사항

- 소요시간은 ODsay 최단경로 구간 합산 **근사값**입니다 (환승 대기 등 오차 있음).
- 카카오톡 메시지는 200자 이내 제한 준수.
- 정보 제공 목적이며 정확한 도착 시간을 보장하지 않습니다.
