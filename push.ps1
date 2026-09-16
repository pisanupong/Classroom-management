# push.ps1 — commit + push ให้ GitHub Actions deploy อัตโนมัติ
param([string]$msg = "update")

git add .
git commit -m $msg
git push origin main
Write-Host ""
Write-Host "OK Push done — check deploy at:" -ForegroundColor Green
Write-Host "  https://github.com/pisanupong/Classroom-management/actions" -ForegroundColor Cyan
Write-Host "  Site: http://acp-sixseven.online:8081/" -ForegroundColor Cyan
