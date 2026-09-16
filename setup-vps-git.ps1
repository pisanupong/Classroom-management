# setup-vps-git.ps1
$VPS      = "root@72.62.67.40"
$REMOTE   = "/opt/classroom-app"
$REPO_URL = "https://github.com/pisanupong/Classroom-management.git"
$KEY_FILE = "$env:USERPROFILE\.ssh\classroom_deploy_key"

Write-Host ""
Write-Host "=== VPS Git Setup ===" -ForegroundColor Cyan

# Step 1: Generate SSH key
Write-Host ""
Write-Host "[1/5] Generating SSH key..." -ForegroundColor Yellow
Write-Host "      -> Press ENTER twice (no passphrase needed)" -ForegroundColor Gray
Write-Host ""
if (Test-Path $KEY_FILE) {
    Write-Host "  Key already exists, skipping." -ForegroundColor Gray
} else {
    ssh-keygen -t ed25519 -C "github-actions" -f $KEY_FILE
}

if (-not (Test-Path "$KEY_FILE.pub")) {
    Write-Host "ERROR: Key generation failed. Run manually:" -ForegroundColor Red
    Write-Host "  ssh-keygen -t ed25519 -f $KEY_FILE" -ForegroundColor Yellow
    exit 1
}
Write-Host "  OK: Key created" -ForegroundColor Green

# Step 2: Copy public key to VPS
Write-Host ""
Write-Host "[2/5] Copying public key to VPS (enter VPS password)..." -ForegroundColor Yellow
$pubKey = (Get-Content "$KEY_FILE.pub").Trim()
ssh $VPS "mkdir -p ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'Public key added OK'"

# Step 3: Fix git remote on VPS
Write-Host ""
Write-Host "[3/5] Setting git remote on VPS..." -ForegroundColor Yellow
ssh $VPS "cd $REMOTE && git remote set-url origin $REPO_URL 2>/dev/null || git remote add origin $REPO_URL && git config --global --add safe.directory $REMOTE && echo 'Remote:' && git remote -v"

# Step 4: Pull latest code
Write-Host ""
Write-Host "[4/5] Pulling latest code on VPS..." -ForegroundColor Yellow
Write-Host "      (if private repo: enter GitHub username + Personal Access Token as password)" -ForegroundColor Gray
ssh $VPS "cd $REMOTE && git fetch origin && git reset --hard origin/main && git log --oneline -3"

# Step 5: Show private key
Write-Host ""
Write-Host "[5/5] Add these secrets to GitHub:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Go to: https://github.com/pisanupong/Classroom-management/settings/secrets/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Secret Name  | Value"
Write-Host "  -------------|--------------------------------"
Write-Host "  VPS_HOST     | 72.62.67.40"
Write-Host "  VPS_USER     | root"
Write-Host "  VPS_SSH_KEY  | (copy the block below)"
Write-Host ""
Write-Host "-------- COPY VPS_SSH_KEY FROM HERE --------" -ForegroundColor Magenta
Get-Content $KEY_FILE
Write-Host "------------ COPY TO HERE ------------------" -ForegroundColor Magenta
Write-Host ""
Write-Host "=== Done! After adding Secrets, every git push will auto-deploy. ===" -ForegroundColor Green
Write-Host ""
