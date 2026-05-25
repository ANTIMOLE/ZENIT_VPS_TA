module.exports = {
  apps: [
    {
      name: "backend-rest",
      script: "dist/server.js",
      cwd: "/home/zenit/e-commerce/apps/backend-rest",
      instances: 1, exec_mode: "fork",
      env_file: "/home/zenit/e-commerce/apps/backend-rest/.env",
      error_file: "/home/zenit/logs/rest-error.log",
      out_file: "/home/zenit/logs/rest-out.log",
      merge_logs: true, restart_delay: 2000, max_restarts: 5, watch: false,
    },
    {
      name: "backend-trpc",
      script: "dist/server.js",
      cwd: "/home/zenit/e-commerce/apps/backend-trpc",
      instances: 1, exec_mode: "fork",
      env_file: "/home/zenit/e-commerce/apps/backend-trpc/.env",
      error_file: "/home/zenit/logs/trpc-error.log",
      out_file: "/home/zenit/logs/trpc-out.log",
      merge_logs: true, restart_delay: 2000, max_restarts: 5, watch: false,
    },
    {
      name: "frontend",
      script: "pnpm",
      args: "start",
      cwd: "/home/zenit/e-commerce/apps/frontend",
      instances: 1, exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/home/zenit/logs/frontend-error.log",
      out_file: "/home/zenit/logs/frontend-out.log",
      merge_logs: true, restart_delay: 2000, max_restarts: 5, watch: false,
    },
  ],
};
