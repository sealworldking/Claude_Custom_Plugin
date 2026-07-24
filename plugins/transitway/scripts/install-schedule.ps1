# 평일(월~금) 07:20 KST에 transitway를 실행하는 Windows 작업 스케줄러 항목 등록.
$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "run.ps1"
if (-not (Test-Path $runner)) { throw "run.ps1 not found: $runner" }

$taskName = "Transitway"
$action   = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $runner)
$trigger  = New-ScheduledTaskTrigger -Weekly `
  -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 7:20am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Settings $settings `
  -Description "Weekday 07:20 KST: transit route brief to KakaoTalk" `
  -Force | Out-Null

Write-Output "Registered scheduled task '$taskName'."
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object NextRunTime
