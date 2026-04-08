#!/bin/bash
# 每次启动前清掉 3010 端口的残留进程
fuser -k 3010/tcp 2>/dev/null
sleep 1
exec node_modules/.bin/next start -H 0.0.0.0 -p 3010
