# transitway

사용자가 직접 정의한 여러 경로(**way = 경유지 순서**)별 대중교통 소요시간을 계산해,
추천(최단) 경로와 함께 매일 아침 **카카오톡 '나에게 보내기'**로 전송하는 Claude Code 플러그인.

## 구성

```
transitway/
├─ .claude-plugin/plugin.json
├─ .mcp.json                          # 커스텀 MCP 서버 등록 (transit)
├─ mcp-server/index.js                # 카카오 지오코딩 + ODsay 구간시간 계산 (무의존성)
├─ skills/transitway/SKILL.md         # 전체 절차 스킬
├─ agents/route-advisor.md            # 경로 추천 서브에이전트
├─ commands/transitway.md             # /transitway 슬래시 커맨드
├─ hooks/hooks.json                   # SessionStart 훅 (등록 경로 수 표시)
├─ hooks/session-preview.js
├─ scripts/run.ps1                    # 아침 자동 전송 러너
├─ scripts/install-schedule.ps1       # Windows 작업 스케줄러 등록
├─ scripts/uninstall-schedule.ps1     # 스케줄러 해제
└─ config.example.json                # 경로 설정 예시
```

---

## 사전 준비

### 환경변수 설정 (관리자 PowerShell, 1회)

```powershell
setx KAKAO_REST_API_KEY "여기에_카카오_REST_키"
setx ODSAY_API_KEY "여기에_ODsay_키"
```

설정 후 **Claude Code 재시작** 필요.

| 변수 | 용도 | 발급 |
|------|------|------|
| `KAKAO_REST_API_KEY` | 경유지 이름 → 좌표 변환 (카카오 로컬 API) | [카카오 개발자 콘솔](https://developers.kakao.com) → 앱 → REST API 키 |
| `ODSAY_API_KEY` | 구간별 대중교통 소요시간 조회 | [ODsay Lab](https://lab.odsay.com) 회원가입 후 발급 |
| `ODSAY_REFERER` | ODsay 등록 URI (선택) | 기본값 `http://localhost:5173` |

### PlayMCP(카카오) 커넥터 연결 (1회)

claude.ai → **Connectors** → KakaoTalk PlayMCP 연결.  
`KakaotalkChat-MemoChat` 도구가 활성화되어야 카카오톡 전송이 가능합니다.

---

## 설치

```
/plugin marketplace add sealworldking/Claude_Custom_Plugin
/plugin install transitway@transitway
/reload-plugins
```

---

## 사용법

### Step 1. 경로(way) 등록

경로는 **경유지를 순서대로 나열**해 저장합니다. 한 번만 하면 됩니다.

**예시 입력:**
```
way 2개 등록해줘.
way1: 강남역 -> 선릉역 -> 판교역
way2: 강남역버스정류장 -> 양재역 -> 판교역
```

Claude가 `set_way` MCP 도구로 각각 저장합니다.

**개별 등록:**
```
way1으로 "홍대입구역 -> 합정역 -> 여의도역" 경로 저장해줘
```

**등록 확인:**
```
등록된 way 목록 보여줘
```

**경로 수정/삭제:**
```
way1 삭제해줘
전체 way 초기화해줘
```

---

### Step 2. 경로 브리핑 전송

#### 방법 A — 슬래시 커맨드 (가장 빠름)
```
/transitway
```

#### 방법 B — 자연어
```
오늘 경로 카톡으로 보내줘
출근 경로 브리핑해줘
way 시간 계산해서 카카오톡 전송해줘
```

#### 방법 C — 스킬 직접 호출
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

### Step 3. (선택) 평일 자동 전송

매일 07:20에 자동으로 카카오톡 전송합니다.

**설치 (관리자 PowerShell):**
```powershell
& "$env:USERPROFILE\.claude\plugins\cache\transitway@transitway\scripts\install-schedule.ps1"
```

또는 카카오톡이 연동된 Claude Code 프로젝트 폴더를 환경변수로 지정:
```powershell
setx TRANSITWAY_PROJECT_DIR "C:\내_프로젝트_폴더"
```

- 작업 스케줄러 작업명: `Transitway`
- PC가 해당 시각 켜져 있어야 실행됨
- 로그: `scripts/logs/run-YYYYMMDD.txt`
- 해제: `scripts/uninstall-schedule.ps1` 실행

---

## 활성화되는 기능 목록

| 기능 | 종류 | 설명 |
|------|------|------|
| `/transitway` | 커맨드 | 경로 브리핑 계산 후 카카오톡 전송 |
| `transitway:transitway` | 스킬 | 동일 동작. 자연어로도 트리거됨 |
| `route-advisor` | 에이전트 | 여러 경로 중 최적 경로 선택 및 이유 설명 |
| SessionStart 훅 | 훅 | 세션 시작 시 등록된 경로 수를 컨텍스트로 표시 |
| transit MCP | MCP 서버 | `set_way` / `get_ways` / `clear_ways` / `brief_ways` 도구 제공 |

---

## MCP 도구 직접 사용

자연어 대신 도구를 직접 호출할 수도 있습니다.

| 도구 | 예시 |
|------|------|
| `set_way` | `set_way(id="way1", path="출발지 -> 환승역 -> 도착지")` |
| `get_ways` | 저장된 전체 경로 반환 |
| `clear_ways` | `clear_ways(id="way1")` 또는 전체 삭제 |
| `brief_ways` | 모든 경로 소요시간 계산 + 추천 텍스트 반환 |

---

## 주의사항

- 소요시간은 경유지 구간별 ODsay 최단경로 합산으로 **근사값**입니다 (환승 대기 등 오차 있음).
- 카카오톡 메시지는 **200자 이내** 제한을 준수합니다.
- 정보 제공 목적이며 정확한 도착 시간을 보장하지 않습니다.
