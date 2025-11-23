# VPS Sorun Giderme Rehberi

## Bağlantı Reddediliyor Sorunu

### 1. PM2 Durumunu Kontrol Et

```bash
pm2 status
pm2 logs watchtug-server
```

Eğer çalışmıyorsa:
```bash
cd /var/www/watchtug/server
pm2 start ecosystem.config.cjs
pm2 save
```

### 2. Port 3000 Kontrolü

```bash
# Port 3000'de bir şey dinliyor mu?
sudo netstat -tulpn | grep 3000
# veya
sudo ss -tulpn | grep 3000

# Eğer çalışmıyorsa, manuel test:
cd /var/www/watchtug/server
node server.js
```

### 3. Nginx Durumu

```bash
# Nginx çalışıyor mu?
sudo systemctl status nginx

# Nginx config test
sudo nginx -t

# Nginx restart
sudo systemctl restart nginx

# Nginx logları
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### 4. Firewall Kontrolü

```bash
# UFW durumu
sudo ufw status

# Portları aç
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw reload
```

### 5. Domain DNS Kontrolü

```bash
# Domain IP'ye çözümleniyor mu?
nslookup watchtug.live
dig watchtug.live

# Sunucu IP'sini öğren
curl ifconfig.me
```

### 6. Nginx Config Kontrolü

```bash
# Config dosyasını kontrol et
sudo nano /etc/nginx/sites-available/watchtug

# Şunları kontrol et:
# - server_name watchtug.live olmalı
# - root /var/www/watchtug/client/dist olmalı
# - upstream localhost:3000 olmalı

# Config test
sudo nginx -t

# Eğer hata varsa düzelt, sonra:
sudo systemctl reload nginx
```

### 7. Frontend Build Kontrolü

```bash
# Build klasörü var mı?
ls -la /var/www/watchtug/client/dist

# Yoksa build yap:
cd /var/www/watchtug/client
npm run build
```

### 8. Backend .env Kontrolü

```bash
cd /var/www/watchtug/server
cat .env

# Şunlar olmalı:
# PORT=3000
# NODE_ENV=production
# CLIENT_URL=https://watchtug.live
```

### 9. Manuel Test

```bash
# Backend'i manuel başlat (PM2 olmadan)
cd /var/www/watchtug/server
node server.js

# Başka terminal'de test et:
curl http://localhost:3000
```

### 10. Tüm Servisleri Yeniden Başlat

```bash
# PM2 restart
pm2 restart all
pm2 save

# Nginx restart
sudo systemctl restart nginx

# Tüm servisleri kontrol et
pm2 status
sudo systemctl status nginx
```

## Hızlı Çözüm Komutları

```bash
# Tüm adımları tek seferde:
cd /var/www/watchtug/server
pm2 delete watchtug-server 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

cd /var/www/watchtug/client
npm run build

sudo systemctl restart nginx
sudo systemctl status nginx
pm2 status
```

