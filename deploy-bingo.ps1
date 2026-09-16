# ============================================================
# deploy-bingo.ps1 — Deploy Bingo Online feature to VPS
# รันจาก PowerShell ที่ root ของโปรเจกต์:
#   cd "D:\Project for dev\Classroom management\classroom-app"
#   .\deploy-bingo.ps1
# ============================================================

$VPS    = "root@72.62.67.40"
$REMOTE = "/opt/classroom-app"
$LOCAL  = "D:\Project for dev\Classroom management\classroom-app"

Write-Host ""
Write-Host "=== BINGO DEPLOY ===" -ForegroundColor Cyan
Write-Host "VPS: $VPS" -ForegroundColor Gray
Write-Host ""

# ── Step 1: สร้าง directory ใหม่บน VPS ──────────────────────
Write-Host "[1/4] สร้างโฟลเดอร์ใหม่บน VPS..." -ForegroundColor Yellow
ssh $VPS "mkdir -p $REMOTE/backend/controllers $REMOTE/backend/routes $REMOTE/frontend/src/pages"

# ── Step 2: SCP ไฟล์ทั้งหมดที่เปลี่ยน ──────────────────────
Write-Host "[2/4] อัปโหลดไฟล์..." -ForegroundColor Yellow

# Backend — schema (สำคัญมาก ต้องไปก่อน build)
Write-Host "  → schema.prisma"
scp "$LOCAL\backend\prisma\schema.prisma" "${VPS}:${REMOTE}/backend/prisma/schema.prisma"

# Backend — server.js
Write-Host "  → server.js"
scp "$LOCAL\backend\server.js" "${VPS}:${REMOTE}/backend/server.js"

# Backend — new files
Write-Host "  → bingoController.js"
scp "$LOCAL\backend\controllers\bingoController.js" "${VPS}:${REMOTE}/backend/controllers/bingoController.js"

Write-Host "  → bingoRoutes.js"
scp "$LOCAL\backend\routes\bingoRoutes.js" "${VPS}:${REMOTE}/backend/routes/bingoRoutes.js"

# Frontend — package.json (มี qrcode.react ใหม่)
Write-Host "  → package.json"
scp "$LOCAL\frontend\package.json" "${VPS}:${REMOTE}/frontend/package.json"

# Frontend — App.jsx
Write-Host "  → App.jsx"
scp "$LOCAL\frontend\src\App.jsx" "${VPS}:${REMOTE}/frontend/src/App.jsx"

# Frontend — Dashboard.jsx
Write-Host "  → Dashboard.jsx"
scp "$LOCAL\frontend\src\pages\Dashboard.jsx" "${VPS}:${REMOTE}/frontend/src/pages/Dashboard.jsx"

# Frontend — new pages
Write-Host "  → BingoLobby.jsx"
scp "$LOCAL\frontend\src\pages\BingoLobby.jsx" "${VPS}:${REMOTE}/frontend/src/pages/BingoLobby.jsx"

Write-Host "  → BingoHost.jsx"
scp "$LOCAL\frontend\src\pages\BingoHost.jsx" "${VPS}:${REMOTE}/frontend/src/pages/BingoHost.jsx"

Write-Host "  → BingoPlayer.jsx"
scp "$LOCAL\frontend\src\pages\BingoPlayer.jsx" "${VPS}:${REMOTE}/frontend/src/pages/BingoPlayer.jsx"

Write-Host "  ✓ อัปโหลดครบแล้ว" -ForegroundColor Green

# ── Step 3: Build → db push → up -d ─────────────────────────
Write-Host ""
Write-Host "[3/4] Build + DB push + Restart (อาจใช้เวลา 3-5 นาที)..." -ForegroundColor Yellow
Write-Host "      ดู log แบบ real-time ด้านล่าง:" -ForegroundColor Gray
Write-Host ""

ssh $VPS @"
cd $REMOTE && \
echo '--- Building images (no-cache) ---' && \
docker compose build --no-cache classroom-backend classroom-frontend && \
echo '--- Pushing schema to DB ---' && \
docker compose run --rm classroom-backend npx prisma db push && \
echo '--- Starting services ---' && \
docker compose up -d classroom-backend classroom-frontend && \
echo '--- Done! ---'
"@

# ── Step 4: ตรวจสอบผล ────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] ตรวจสอบ services..." -ForegroundColor Yellow
ssh $VPS "cd $REMOTE && docker compose ps && echo '' && docker compose logs --tail=20 classroom-backend"

Write-Host ""
Write-Host "=== DEPLOY COMPLETE ===" -ForegroundColor Green
Write-Host "Frontend : http://72.62.67.40:8081" -ForegroundColor Cyan
Write-Host "Backend  : http://72.62.67.40:5000" -ForegroundColor Cyan
Write-Host "Bingo    : http://72.62.67.40:8081/bingo" -ForegroundColor Cyan
Write-Host ""
