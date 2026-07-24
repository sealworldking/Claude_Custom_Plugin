# Transitway 작업 스케줄러 항목 제거.
$ErrorActionPreference = "Stop"
$taskName = "Transitway"
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Output "Removed scheduled task '$taskName'."
} else {
  Write-Output "No scheduled task named '$taskName'."
}
