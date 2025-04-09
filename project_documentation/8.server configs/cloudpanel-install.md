# ChatMimic Connect Server Installation Guide for CloudPanel

This guide provides steps to install the ChatMimic Connect server on CloudPanel with the specific directory structure:

```
/home/denoteai-api-chat/
├── htdocs/
│   └── api.chat.denoteai.tech/
│       ├── index.js
│       ├── googleOAuth.js
│       └── other server files...
│
└── credentials/
    ├── .env
    └── denoteai-firebase-adminsdk-fbsvc-f91a6418cd.json
```

## Step 1: Upload Server Files

1. Upload all server files to `/home/denoteai-api-chat/htdocs/api.chat.denoteai.tech/`:
   - index.js
   - googleOAuth.js
   - package.json
   - Other server files

## Step 2: Configure Environment Variables

1. Make sure your `.env` file is in the correct location:
   ```
   /home/denoteai-api-chat/credentials/.env
   ```

2. Verify the Firebase Admin SDK credentials are at:
   ```
   /home/denoteai-api-chat/credentials/denoteai-firebase-adminsdk-fbsvc-f91a6418cd.json
   ```

3. Set appropriate permissions:
   ```bash
   chmod 600 /home/denoteai-api-chat/credentials/.env
   chmod 600 /home/denoteai-api-chat/credentials/denoteai-firebase-adminsdk-fbsvc-f91a6418cd.json
   ```

## Step 3: Install Node.js Dependencies

1. Navigate to the server directory:
   ```bash
   cd /home/denoteai-api-chat/htdocs/api.chat.denoteai.tech/
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Step 4: Create Systemd Service

1. Create a systemd service file:
   ```bash
   sudo nano /etc/systemd/system/chatmimic-server.service
   ```

2. Add the following configuration (already adjusted for your paths):
   ```
   [Unit]
   Description=ChatMimic Connect Server
   After=network.target

   [Service]
   Type=simple
   User=denoteai-api-chat
   WorkingDirectory=/home/denoteai-api-chat/htdocs/api.chat.denoteai.tech
   EnvironmentFile=/home/denoteai-api-chat/credentials/.env
   Environment=GOOGLE_APPLICATION_CREDENTIALS=/home/denoteai-api-chat/credentials/denoteai-firebase-adminsdk-fbsvc-f91a6418cd.json
   ExecStart=/usr/bin/node /home/denoteai-api-chat/htdocs/api.chat.denoteai.tech/index.js
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

3. Start and enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start chatmimic-server
   sudo systemctl enable chatmimic-server
   ```

4. Check service status:
   ```bash
   sudo systemctl status chatmimic-server
   ```

## Step 5: Configure NGINX in CloudPanel

1. Navigate to your domain settings in CloudPanel

2. Add the following under the Custom NGINX Configuration area:

   ```nginx
   location /api/ {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
   }
   ```

3. Update your CloudPanel domain configuration as follows:
   - Document Root: `/home/denoteai-api-chat/htdocs/chat.denoteai.tech/dist` (for frontend)
   - NGINX Vhost Template: Custom

## Step 6: Monitor Logs

Monitor the server logs to ensure everything is working correctly:

```bash
sudo journalctl -u chatmimic-server -f
```

## Troubleshooting

### Common Issues in CloudPanel

1. **Permission Issues**:
   - Make sure the service user (`denoteai-api-chat`) has access to all required files
   - Verify file permissions with `ls -la`

2. **Path Issues**:
   - Double-check all paths in the systemd service file
   - Make sure Node.js is installed and available at `/usr/bin/node`

3. **NGINX Configuration**:
   - Check the NGINX error logs in CloudPanel
   - Verify that the proxy settings are correct

4. **Service Not Starting**:
   - Check service status: `systemctl status chatmimic-server`
   - View detailed logs: `journalctl -u chatmimic-server` 