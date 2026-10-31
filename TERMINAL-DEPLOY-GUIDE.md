# Terminal Deployment Logbook

Use this file when doing the repo push and deploy work again. Run one command at a time. Do not chain commands with `&&` unless you are fully sure the shell is working.

## 1) Open the project folder

```powershell
Set-Location "C:\Users\Charlotte Galleta\Desktop\priority ph"
```

If PowerShell still fails to find `git`, use this path directly:

```powershell
& "C:\Program Files\Git\cmd\git.exe" -C "C:\Users\Charlotte Galleta\Desktop\priority ph" status --short --branch
```

## 2) Check repo status

```powershell
git status --short --branch
git remote -v
```

## 3) Build the app

```powershell
npm.cmd run build
```

## 4) Check Supabase migration status

```powershell
npx.cmd supabase --version
npx.cmd supabase migration list --linked
```

## 5) Seed test accounts when the key is in `.env`

The seed script reads `SUPABASE_SERVICE_ROLE_KEY` from the PowerShell process environment. If the key is stored in `.env`, load it into the current process before running the script:

```powershell
$line = Get-Content .env | Where-Object { $_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=' } | Select-Object -First 1; if (-not $line) { throw 'SUPABASE_SERVICE_ROLE_KEY was not found in .env' }; $env:SUPABASE_SERVICE_ROLE_KEY = ($line -replace '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*','').Trim().Trim('"').Trim("'"); if ([string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) { throw 'SUPABASE_SERVICE_ROLE_KEY in .env is empty' }; & "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Charlotte Galleta\Desktop\priority ph\scripts\seed-test-accounts.ps1"
```

Do not commit real service-role keys or passwords. Rotate the service-role key if it has been committed or shared.

## 6) Push database migration

```powershell
npx.cmd supabase db push --linked --yes
```

## 7) Commit the repo

```powershell
git add .
git commit -m "Deploy migration and app updates"
```

## 8) Push to GitHub

```powershell
git push origin main
```

## 9) Deploy to Vercel

```powershell
npx.cmd vercel --prod --yes
```

## Safe fallback if git is not recognized

```powershell
& "C:\Program Files\Git\cmd\git.exe" -C "C:\Users\Charlotte Galleta\Desktop\priority ph" status --short --branch
& "C:\Program Files\Git\cmd\git.exe" -C "C:\Users\Charlotte Galleta\Desktop\priority ph" add .
& "C:\Program Files\Git\cmd\git.exe" -C "C:\Users\Charlotte Galleta\Desktop\priority ph" commit -m "Deploy migration and app updates"
& "C:\Program Files\Git\cmd\git.exe" -C "C:\Users\Charlotte Galleta\Desktop\priority ph" push origin main
```

## Quick rules

- Run commands one at a time.
- Use `npx.cmd` in PowerShell.
- Do not write long chained commands.
- If a command fails, stop and fix that specific error before continuing.
- Keep the repo and Vercel environment aligned to the same Supabase project.
