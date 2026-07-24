# transitway (Claude Code 플러그인 마켓플레이스)

사용자 정의 경유지 경로별 대중교통 소요시간을 계산해 매일 아침 카카오톡으로 전송하는 Claude Code 플러그인 마켓플레이스.

## 수록 플러그인

- **transitway** — 경유지 순서로 정의한 경로(way)별 대중교통(버스+지하철) 소요시간을
  ODsay + 카카오 API로 계산해 매일 아침 카카오톡으로 전송. 커스텀 MCP + 스킬 + 훅 + 에이전트 + 커맨드.

## 설치

```
/plugin marketplace add sealworldking/Claude_Custom_Plugin
/plugin install transitway@transitway
/reload-plugins
```

> `sealworldking/transitway`는 이 저장소를 GitHub에 올린 뒤의 `owner/repo` 경로입니다.
> 로컬에서 바로 쓰려면: `/plugin marketplace add <이 폴더 경로>`

## 저장소 구조

```
transitway/
├─ .claude-plugin/marketplace.json   # 마켓플레이스 매니페스트
├─ plugins/
│  └─ transitway/                    # 플러그인 본체
└─ README.md
```
