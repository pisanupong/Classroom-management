# push.ps1 — commit + push ให้ GitHub Actions deploy อัตโนมัติ
param([string]$msg = "update")

git add .
git commit -m $msg
git push origin main
Write-Host ""
Write-Host "✓ Push แล้ว — ดู deploy ได้ที่:" -ForegroundColor Green
Write-Host "  https://github.com/pisanupong/asset-manage/actions" -ForegroundColor Cyan
