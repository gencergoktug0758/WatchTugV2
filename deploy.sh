#!/bin/bash

# WatchTug Deployment Script
# Kullanım: ./deploy.sh

set -e

echo "🚀 WatchTug Deployment Başlatılıyor..."

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Proje dizini
PROJECT_DIR="/var/www/watchtug"
BACKEND_DIR="$PROJECT_DIR/server"
FRONTEND_DIR="$PROJECT_DIR/client"

# Git pull
echo -e "${YELLOW}📥 Git güncellemesi yapılıyor...${NC}"
cd $PROJECT_DIR
git pull origin main

# Backend güncelleme
echo -e "${YELLOW}🔧 Backend güncelleniyor...${NC}"
cd $BACKEND_DIR
npm install --production

# Frontend build
echo -e "${YELLOW}🏗️  Frontend build ediliyor...${NC}"
cd $FRONTEND_DIR
npm install
npm run build

# PM2 restart
echo -e "${YELLOW}🔄 PM2 restart ediliyor...${NC}"
pm2 restart watchtug-server

# Nginx reload
echo -e "${YELLOW}🔄 Nginx reload ediliyor...${NC}"
sudo systemctl reload nginx

echo -e "${GREEN}✅ Deployment tamamlandı!${NC}"
echo -e "${GREEN}📊 PM2 durumu:${NC}"
pm2 status

