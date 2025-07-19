# SvelteKit Single Executable Application Build Script for Windows
Write-Host "Building SvelteKit Single Executable Application..." -ForegroundColor Green

# Step 1: Build the SvelteKit application
Write-Host "Step 1: Building SvelteKit application..." -ForegroundColor Yellow
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Generate the SEA blob
Write-Host "Step 2: Generating SEA blob..." -ForegroundColor Yellow
node --experimental-sea-config sea-config.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "SEA blob generation failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Create a copy of Node.js executable
Write-Host "Step 3: Creating Node.js executable copy..." -ForegroundColor Yellow
$nodePath = (Get-Command node).Source
Copy-Item $nodePath "adnmb-backup-web.exe"

# Step 4: Remove signature (optional on Windows)
Write-Host "Step 4: Removing signature (if signtool is available)..." -ForegroundColor Yellow
try {
    signtool remove /s "adnmb-backup-web.exe" 2>$null
    Write-Host "Signature removed successfully" -ForegroundColor Green
} catch {
    Write-Host "signtool not found or failed - this is optional, continuing..." -ForegroundColor Yellow
}

# Step 5: Inject the blob using postject
Write-Host "Step 5: Injecting SEA blob..." -ForegroundColor Yellow
npx postject "adnmb-backup-web.exe" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE -ne 0) {
    Write-Host "Blob injection failed!" -ForegroundColor Red
    exit 1
}

# Step 6: Sign the binary (optional)
Write-Host "Step 6: Signing binary (if certificate available)..." -ForegroundColor Yellow
try {
    signtool sign /fd SHA256 "adnmb-backup-web.exe" 2>$null
    Write-Host "Binary signed successfully" -ForegroundColor Green
} catch {
    Write-Host "Signing failed or certificate not available - this is optional" -ForegroundColor Yellow
}

Write-Host "Success! Single executable created: adnmb-backup-web.exe" -ForegroundColor Green
Write-Host "You can now run: .\adnmb-backup-web.exe" -ForegroundColor Cyan

# Clean up intermediate files
Write-Host "Cleaning up intermediate files..." -ForegroundColor Yellow
Remove-Item "sea-prep.blob" -ErrorAction SilentlyContinue

Write-Host "Build complete!" -ForegroundColor Green 