# TRMNL Self-Hosting Guide

TRMNL is an e-ink dashboard display with a self-hostable server implementation called BYOS Laravel. This guide covers deploying your own TRMNL server to point devices to instead of the cloud service.

## Overview

BYOS Laravel is a PHP Laravel application that provides:
- Device management and monitoring
- Screen generation via plugins, recipes, API, or markup
- Auto-join for automatic device detection
- Cloud API proxy for Developer Edition users
- Docker support with SQLite by default

## Requirements

- Docker and Docker Compose (recommended)
- Or: PHP 8.2+, ImageMagick, Puppeteer, ext-simplexml, ext-zip

## Installation with Docker

Create a docker-compose.yml file:

```yaml
services:
    app:
        image: ghcr.io/usetrmnl/byos_laravel:latest
        ports:
            - "4567:8080"
        environment:
            - APP_KEY=base64:YOUR_KEY_HERE
            - PHP_OPCACHE_ENABLE=1
            - TRMNL_PROXY_REFRESH_MINUTES=15
            - DB_DATABASE=database/storage/database.sqlite
            - APP_TIMEZONE=America/New_York
            - REGISTRATION_ENABLED=1
        volumes:
            - database:/var/www/html/database/storage
            - storage:/var/www/html/storage/app/public/images/generated
        restart: unless-stopped

volumes:
    database:
    storage:
```

Generate an application key:

```bash
docker run --rm ghcr.io/usetrmnl/byos_laravel:latest php artisan key:generate --show
```

Update the APP_KEY value in docker-compose.yml with the generated key, then start the server:

```bash
docker compose up -d
```

Access the server at http://localhost:4567

## Local Development Setup

Clone and setup the repository:

```bash
git clone git@github.com:usetrmnl/byos_laravel.git
cd byos_laravel
cp .env.example .env
```

Install dependencies:

```bash
composer install
npm install
npm run build
```

Initialize the application:

```bash
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
```

Start the development server:

```bash
php artisan serve --host=0.0.0.0 --port 4567
```

Start the queue worker in a separate terminal:

```bash
php artisan queue:listen --tries=1
```

## Database Configuration

Default SQLite configuration requires no changes. For MySQL or PostgreSQL, update environment variables:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=your_password
```

Run migrations after changing database settings:

```bash
php artisan migrate --seed
```

## Device Setup

### Auto-Join Method

For single-user deployments:

1. Enable "Permit Auto-Join" toggle in the server header
2. Configure device firmware to point to your server URL
3. Device automatically appears in your account

### Manual Device Addition

1. Navigate to http://localhost:4567/devices
2. Click "Add New Device"
3. Enter device MAC address and API key

### Firmware Configuration

For firmware 1.4.6 and later:

1. Setup the device normally
2. After WiFi credentials, select "Custom Server"
3. Enter your server URL

Older firmware requires flashing updated firmware first.

## Cloud Proxy Setup

Requires TRMNL Developer Edition. Allows access to official cloud recipes:

1. Setup device with official cloud service
2. Deploy BYOS Laravel server and create user account
3. Enable "Permit Auto-Join" in server
4. Press and hold device button for 5 seconds
5. Re-setup device pointing to your custom server
6. Enable "Cloud Proxy" toggle for the device
7. Verify queue worker is running

Set proxy environment variables:

```bash
TRMNL_PROXY_BASE_URL=https://trmnl.app
TRMNL_PROXY_REFRESH_MINUTES=15
```

## Screen Generation

### Markup Method

1. Navigate to Plugins > Markup in the web interface
2. Enter custom markup or select from templates
3. Generate screen

### Blade View Method

Edit the Blade template:

```bash
resources/views/trmnl.blade.php
```

Generate screen from template:

```bash
php artisan trmnl:screen:generate
```

### API Method

Send POST request to generate screens programmatically:

```bash
POST /api/screen
Authorization: Bearer YOUR_TOKEN
```

### Recipe Import

Import community recipes from the catalog or TRMNL official recipes. Navigate to the Recipes section to browse and install.

## Production Configuration

Disable registration after creating accounts:

```yaml
environment:
    - REGISTRATION_ENABLED=0
```

Enable HTTPS when using a reverse proxy:

```bash
FORCE_HTTPS=1
SSL_MODE=full
```

Set appropriate timezone for scheduled tasks:

```bash
APP_TIMEZONE=America/New_York
```

## Updates

Pull latest image and restart:

```bash
docker compose pull
docker compose down
docker compose up -d
```

## Backup

Backup SQLite database:

```bash
docker ps
docker cp CONTAINER_ID:/var/www/html/database/storage/database.sqlite backup.sqlite
```

For persistent backups, ensure the database volume is backed up regularly.

## Environment Variables Reference

Core application settings:

```bash
APP_NAME=TrmnlServer
APP_ENV=production
APP_KEY=base64:YOUR_KEY_HERE
APP_DEBUG=false
APP_TIMEZONE=UTC
APP_URL=http://localhost
```

TRMNL-specific settings:

```bash
TRMNL_PROXY_BASE_URL=https://trmnl.app
TRMNL_PROXY_REFRESH_MINUTES=15
TRMNL_IMAGE_URL_TIMEOUT=30
REGISTRATION_ENABLED=1
SSL_MODE=off
FORCE_HTTPS=0
```

Performance settings:

```bash
PHP_OPCACHE_ENABLE=1
```

## Resources

- GitHub Repository: https://github.com/usetrmnl/byos_laravel
- Official BYOS Documentation: https://docs.usetrmnl.com/go/diy/byos
- Community Recipe Catalog: https://bnussbau.github.io/trmnl-recipe-catalog/
- Official Recipes: https://usetrmnl.com/recipes
- Design Framework: https://usetrmnl.com/framework
- API Documentation: https://docs.usetrmnl.com/go/private-api/introduction
