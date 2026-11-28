// Keep one backend process: import coordination is process-local while job
// manifests persist under IMPORT_STORAGE_ROOT.
module.exports = {
  apps: [{
    name: 'jaygurudev-api',
    cwd: '/var/www/jaygurudev/Backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    time: true,
    kill_timeout: 15000,
    listen_timeout: 10000,
    max_memory_restart: '750M',
    env_production: {
      NODE_ENV: 'production',
      BIND_HOST: '127.0.0.1',
      TRUST_PROXY_HOPS: '1',
    },
  }],
};
