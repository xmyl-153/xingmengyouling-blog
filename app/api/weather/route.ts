// app/api/weather/route.ts
import { NextResponse } from 'next/server';

// 🌟 内存缓存：15 分钟内重复请求直接返回缓存，大幅节省和风天气 API 配额
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 分钟
let cache: { data: any; expiresAt: number } | null = null;

export async function GET() {
  const token = process.env.QWEATHER_KEY;
  const locationId = "101010100"; // 北京

  if (!token) {
    console.error("❌ 环境变量 QWEATHER_KEY (Token) 未找到");
    return NextResponse.json({ code: "500", message: "Token missing" }, { status: 500 });
  }

  // 🌟 命中缓存直接返回（每天最多 96 次真实请求）
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'public, max-age=900' } });
  }

  // 🌟 智能判断认证方式：
  // - 以 eyJ 开头 → JWT 凭据 → 使用 Authorization: Bearer 头
  // - 其他（32位 UUID 等）→ API Key 凭据 → 使用 ?key= 查询参数
  const isJWT = token.trim().startsWith("eyJ");
  console.log(`📡 认证方式: ${isJWT ? "JWT (Bearer 头)" : "API Key (查询参数)"}`);

  // 🌟 核心：按照你提供的文档，尝试两个可能的 Host
  // 如果你有特定的 API Host（例如 xxx.qweather.com），请把第一个换成它
  const apiHosts = [
    'https://api.qweather.com/v7/weather/now',
    'https://devapi.qweather.com/v7/weather/now'
  ];

  for (const host of apiHosts) {
    try {
      // 构造 URL：API Key 方式附加查询参数
      const url = isJWT
        ? `${host}?location=${locationId}`
        : `${host}?location=${locationId}&key=${encodeURIComponent(token.trim())}`;

      console.log(`📡 尝试请求: ${host}`);

      const headers: Record<string, string> = {
        'Accept-Encoding': 'gzip',
        'User-Agent': 'Vercel-Weather-Proxy/1.0'
      };

      // JWT 方式使用 Bearer 认证头
      if (isJWT) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store'
      });

      const data = await res.json();

      // 如果返回 200，说明这套认证终于对上暗号了！
      if (data.code === "200" || res.status === 200) {
        console.log(`✅ 认证通过! 来源: ${host}`);
        // 🌟 写入缓存
        cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=900' } });
      }

      console.warn(`⚠️ ${host} 认证未通过:`, data);

    } catch (err: any) {
      console.error(`🔥 请求 ${host} 出错:`, err.message);
      continue;
    }
  }

  return NextResponse.json({
    code: "500",
    message: "认证协议对接失败，请检查是否在 Vercel 填写了正确的 Token"
  }, { status: 500 });
}