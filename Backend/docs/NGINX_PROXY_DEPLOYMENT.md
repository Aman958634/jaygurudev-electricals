# Nginx reverse-proxy deployment

The production backend must run only behind one local Nginx proxy hop. The application defaults to `TRUST_PROXY_HOPS=1` and `BIND_HOST=127.0.0.1` when `NODE_ENV=production`; do not expose port 5000 publicly.

Use these environment values in the systemd service:

```ini
Environment=NODE_ENV=production
Environment=TRUST_PROXY_HOPS=1
Environment=BIND_HOST=127.0.0.1
```

Use this Nginx API location (and keep the existing static-site location):

```nginx
location /api/ {
    # Keep in sync with IMPORT_MAX_ZIP_MB (50 MiB by default).
    client_max_body_size 55m;
    client_body_timeout 300s;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /uploads/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Before reloading Nginx, validate it with `sudo nginx -t`. Confirm the backend is loopback-only with `sudo ss -lntp | grep :5000`; it must show `127.0.0.1:5000`, not `0.0.0.0:5000` or a public address. If UFW is used, keep `5000/tcp` denied from the internet.

For persistent uploads and import manifests, PM2 configuration, backup-first
migration commands, and post-deploy Bulk Import smoke checks, use
`docs/PRODUCTION_BULK_IMPORT_DEPLOYMENT.md`. Do not expose the configured
`IMPORT_STORAGE_ROOT` through Nginx.
