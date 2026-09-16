# ============================================================
# setup-vps-git.ps1 — ตั้งค่า VPS ให้ pull จาก GitHub ได้
# รันครั้งเดียวก่อนใช้ GitHub Actions
# ============================================================
#
# สิ่งที่ script นี้ทำ:
#   1. สร้าง SSH deploy key บนเครื่อง dev
#   2. ใส่ public key เข้า VPS (~/.ssh/authorized_keys)
#   3. แก้ git remote บน VPS ให้ชี้มาที่ repo ที่ถูก
#   4. ทำ git pull ครั้งแรกบน VPS
#   5. แสดง private key ให้คัดลอกไปใส่ GitHub Secrets
# ============================================================

$VPS         = "root@72.62.67.40"
$REMOTE      = "/opt/classroom-app"
$REPO_URL    = "https://github.com/pisanupong/Classroom-management.git"
$KEY_FILE    = "$env:USERPROFILE\.ssh\classroom_deploy_key"

Write-Host ""
Write-Host "=== VPS Git Setup ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. สร้าง SSH key pair ─────────────────────────────────────
if (-not (Test-Path $KEY_FILE)) {
    Write-Host "[1/5] สร้าง SSH deploy key..." -ForegroundColor Yellow
    ssh-keygen -t ed25519 -C "github-actions-classroom" -f $KEY_FILE -N '""'
    Write-Host "  ✓ สร้างแล้ว: $KEY_FILE" -ForegroundColor Green
} else {
    Write-Host "[1/5] พบ SSH key อยู่แล้ว: $KEY_FILE" -ForegroundColor Gray
}

# ── 2. ใส่ public key เข้า VPS ───────────────────────────────
Write-Host "[2/5] ใส่ public key เข้า VPS..." -ForegroundColor Yellow
$pubKey = Get-Content "$KEY_FILE.pub"
ssh $VPS "mkdir -p ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
Write-Host "  ✓ เพิ่ม public key แล้ว" -ForegroundColor Green

# ── 3. ตั้งค่า git remote บน VPS ─────────────────────────────
Write-Host "[3/5] ตั้งค่า git remote บน VPS..." -ForegroundColor Yellow
ssh $VPS @"
cd $REMOTE
git remote set-url origin $REPO_URL 2>/dev/null || git remote add origin $REPO_URL
git config --global --add safe.directory $REMOTE
echo 'remote set to: $REPO_URL'
git remote -v
"@
Write-Host "  ✓ ตั้งค่า remote แล้ว" -ForegroundColor Green

# ── 4. git pull ครั้งแรก ─────────────────────────────────────
Write-Host "[4/5] git pull ครั้งแรก..." -ForegroundColor Yellow
Write-Host "  (ถ้า repo เป็น private จะขอ username/password — ใช้ Personal Access Token)" -ForegroundColor Gray
ssh $VPS @"
cd $REMOTE
git fetch origin
git reset --hard origin/main
echo 'pull done'
git log --oneline -5
"@
Write-Host "  ✓ pull แล้ว" -ForegroundColor Green

# ── 5. แสดง private key สำหรับ GitHub Secrets ───────────────
Write-Host ""
Write-Host "[5/5] เพิ่ม Secrets ใน GitHub:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ไปที่ https://github.com/pisanupong/Classroom-management/settings/secrets/actions" -ForegroundColor Cyan
Write-Host "  แล้วเพิ่ม 3 secrets นี้:" -ForegroundColor White
Write-Host ""
Write-Host "  VPS_HOST  = 72.62.67.40" -ForegroundColor White
Write-Host "  VPS_USER  = root" -ForegroundColor White
Write-Host "  VPS_SSH_KEY = (เนื้อหาด้านล่าง ทั้งหมด)" -ForegroundColor White
Write-Host ""
Write-Host "--- COPY ทั้งหมดนี้ไปใส่ VPS_SSH_KEY ---" -ForegroundColor Magenta
Get-Content $KEY_FILE
Write-Host "--- END ---" -ForegroundColor Magenta
Write-Host ""
Write-Host "=== Setup เสร็จแล้ว! ===" -ForegroundColor Green
Write-Host "หลังจากใส่ Secrets แล้ว ทุกครั้งที่ git push origin main จะ deploy อัตโนมัติ" -ForegroundColor Cyan
Write-Host ""
