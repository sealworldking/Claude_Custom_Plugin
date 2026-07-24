# transitway 자동 실행 러너 (Windows 작업 스케줄러가 호출).
# 1) MCP 서버 CLI 모드로 오늘 경로 브리핑 텍스트 생성
# 2) claude 헤드리스로 그 텍스트를 카카오톡(KakaotalkChat-MemoChat)에 전송
$ErrorActionPreference = "Stop"
$scriptsDir = $PSScriptRoot
$pluginDir  = Split-Path $scriptsDir
$server     = Join-Path $pluginDir "mcp-server\index.js"
$logsDir    = Join-Path $scriptsDir "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
$log = Join-Path $logsDir ("run-" + (Get-Date -Format "yyyyMMdd") + ".txt")

"[$(Get-Date -Format 'yyyyMMdd-HHmmss')] START transitway" | Out-File -FilePath $log -Append -Encoding utf8

# ODsay 키: 환경변수 우선, 없으면 scripts\odsay.key 파일에서 읽음. 둘 다 없으면 샘플데이터.
if (-not $env:ODSAY_API_KEY) {
  $keyFile = Join-Path $scriptsDir "odsay.key"
  if (Test-Path $keyFile) { $env:ODSAY_API_KEY = (Get-Content $keyFile -Raw).Trim() }
}

# 1) 경로 브리핑 생성
$brief = & node $server daily-brief 2>> $log
if ($LASTEXITCODE -ne 0 -or -not $brief) {
  "[ERROR] daily-brief 생성 실패" | Out-File -FilePath $log -Append -Encoding utf8
  exit 1
}
$brief | Out-File -FilePath $log -Append -Encoding utf8

# 2) 카카오 전송 (claude 헤드리스). 프로젝트 폴더에서 실행해 PlayMCP 커넥터 로드.
$claude = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claude) {
  $wg = "C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Packages\Anthropic.ClaudeCode_Microsoft.Winget.Source_8wekyb3d8bbwe\claude.exe"
  if (Test-Path $wg) { $claude = $wg }
}
if (-not $claude) { "[ERROR] claude.exe not found" | Out-File -FilePath $log -Append -Encoding utf8; exit 1 }

# KakaoTalk PlayMCP 커넥터가 등록된 Claude Code 프로젝트 폴더. TRANSITWAY_PROJECT_DIR 환경변수로 재정의 가능.
$projectDir = if ($env:TRANSITWAY_PROJECT_DIR) { $env:TRANSITWAY_PROJECT_DIR } else { $env:USERPROFILE }
Set-Location $projectDir
$prompt = "다음 내용을 수정하지 말고 그대로 KakaotalkChat-MemoChat 도구로 나에게 카카오톡 전송해줘:`n`n$brief"
& $claude -p $prompt --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath $log -Append

"[$(Get-Date -Format 'yyyyMMdd-HHmmss')] END exit=$LASTEXITCODE" | Out-File -FilePath $log -Append -Encoding utf8
