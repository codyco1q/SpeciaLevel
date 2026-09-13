@echo off
cd /d C:\Users\cody\uplevel
call npm run build > .tmp-build.log 2>&1
echo EXIT:%ERRORLEVEL% >> .tmp-build.log
