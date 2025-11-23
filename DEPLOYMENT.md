# WatchTug VPS Deployment Rehberi

Bu rehber, WatchTug projesini Ubuntu VPS sunucusuna deploy etmek için adım adım talimatlar içerir.

## Gereksinimler

- Ubuntu 20.04+ VPS
- Root veya sudo yetkisi
- Domain adresi (opsiyonel, IP ile de çalışır)
- SSH erişimi

## 1. Sunucu Hazırlığı

### Gerekli paketleri yükleyin:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nodejs npm nginx git curl
```

### Node.js versiyonunu kontrol edin (18+ olmalı):

```bash
node --version
npm --version
```

Eğer Node.js 18+ değilse:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### PM2'yi global olarak yükleyin:

```bash
sudo npm install -g pm2
```

## 2. Projeyi Sunucuya Klonlama

```bash
cd /var/www
sudo git clone https://github.com/gencergoktug0758/WatchTugV2.git watchtug
sudo chown -R $USER:$USER /var/www/watchtug
cd watchtug
```

## 3. Backend Kurulumu

```bash
cd server
npm install
```

### Environment değişkenlerini ayarlayın:

```bash
nano .env
```

`.env` dosyasına şunları ekleyin:

```env
PORT=3000
NODE_ENV=production
CLIENT_URL=http://your-domain.com
```

### PM2 ile başlatın:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

PM2'nin önerdiği komutu çalıştırın (genellikle `sudo env PATH=...` ile başlar).

## 4. Frontend Build

```bash
cd ../client
npm install
npm run build
```

Build çıktısı `client/dist` klasöründe olacak.

## 5. Nginx Yapılandırması

### Nginx config dosyasını oluşturun:

```bash
sudo nano /etc/nginx/sites-available/watchtug
```

`nginx.conf` dosyasındaki içeriği buraya kopyalayın ve `your-domain.com` kısmını kendi domain'inizle değiştirin (veya IP adresinizle).

### Site'ı aktifleştirin:

```bash
sudo ln -s /etc/nginx/sites-available/watchtug /etc/nginx/sites-enabled/
sudo nginx -t  # Yapılandırmayı test edin
sudo systemctl restart nginx
```

## 6. Firewall Ayarları

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (SSL için)
sudo ufw enable
```

## 7. SSL Sertifikası (Opsiyonel ama Önerilen)

Let's Encrypt ile ücretsiz SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 8. Güncellemeler

Projeyi güncellemek için:

```bash
cd /var/www/watchtug
git pull origin main

# Backend
cd server
npm install
pm2 restart watchtug-server

# Frontend
cd ../client
npm install
npm run build
sudo systemctl reload nginx
```

## 9. Log Kontrolü

### PM2 Logları:

```bash
pm2 logs watchtug-server
```

### Nginx Logları:

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 10. Sorun Giderme

### Backend çalışmıyorsa:

```bash
pm2 status
pm2 logs watchtug-server
pm2 restart watchtug-server
```

### Nginx çalışmıyorsa:

```bash
sudo systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx
```

### Port 3000 kullanımda mı kontrol edin:

```bash
sudo netstat -tulpn | grep 3000
```

## Önemli Notlar

- PM2 otomatik restart yapar, sunucu yeniden başladığında uygulama otomatik başlar
- Nginx reverse proxy olarak çalışır, port 3000'i dışarıya açmaz
- Frontend build'i her güncellemede yeniden yapılmalı
- `.env` dosyasındaki `CLIENT_URL` domain'inizle eşleşmeli

## Güvenlik İpuçları

1. Firewall'u aktif tutun
2. SSH key authentication kullanın (şifre yerine)
3. Düzenli güncellemeler yapın
4. SSL sertifikası kullanın (HTTPS)
5. PM2 log rotation ayarlayın

