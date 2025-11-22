@echo off
title WTUG Başlatıcı

echo WTUG başlatılıyor...
echo.

:: Önce authtoken'ı al
set /p NGROK_AUTH_TOKEN=<ngrok_auth.txt

:: İlk CMD penceresini aç ve npm start komutunu çalıştır
echo Sunucu başlatılıyor...
start cmd /k "title WTUG Sunucu && cd /d %~dp0 && call npm start"

:: 3 saniye bekle
timeout /t 3 /nobreak >nul

:: İkinci CMD penceresini aç ve ngrok komutlarını çalıştır
echo Ngrok tüneli kuruluyor...
start cmd /k "title WTUG Ngrok Tüneli && cd /d %~dp0 && .\ngrok.exe http 3000"

echo.
echo WTUG başlatıldı!
echo Tarayıcınız ile http://localhost:3000 adresine gidebilirsiniz
echo veya Ngrok penceresindeki URL'i kullanarak internet üzerinden erişebilirsiniz.
echo.
echo Kapatmak için bu pencereyi kapatın ve açılan komut pencerelerini de kapatın.

pause
exit 