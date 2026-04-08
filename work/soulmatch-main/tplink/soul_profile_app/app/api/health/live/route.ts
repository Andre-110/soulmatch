import { NextResponse } from 'next/server';

/**
 * 极简存活探针：不跑 top、不连库，供负载均衡 / Nginx / 运维 curl 判断「Node 是否在跑」。
 * 若本接口也 502，多半是反代到上游的地址或端口错误，或进程未启动。
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'soul_profile_app' }, { status: 200 });
}
