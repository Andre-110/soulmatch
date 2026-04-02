module.exports = {
  apps: [
    {
      name: 'soul-profile-app',
      script: '/home/ecs-user/tplink-app/tplink/soul_profile_app/scripts/start-prod.sh',
      interpreter: 'bash',
      cwd: '/home/ecs-user/tplink-app/tplink/soul_profile_app',
      treekill: true,
      kill_timeout: 8000,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '15s',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: '3010'
      }
    }
  ]
}
