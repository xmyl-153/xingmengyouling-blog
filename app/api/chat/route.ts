// app/api/chat/route.ts
import { siteConfig } from '../../../siteConfig'; // 确保这里的路径指向你的 siteConfig

export const runtime = 'edge';

export async function POST(req: Request) {
  console.log("🚀 [1/5] 路由进入：开始对接 AI 脑回路");

  try {
    const { message } = await req.json();

    // 🌟 读取环境变量
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
    const llmBaseUrl = (process.env.LLM_BASE_URL || '').trim();
    const llmModel = (process.env.LLM_MODEL || '').trim();

    const systemPrompt = siteConfig.geminiConfig.systemPrompt;
    const maxTokens = siteConfig.geminiConfig.maxOutputTokens;
    const temperature = siteConfig.geminiConfig.temperature;

    // ── 分支 1：Gemini（Google，需要代理访问）──
    if (geminiKey) {
      console.log("📡 [2/5] 正在呼叫 Gemini 模型");
      const modelId = siteConfig.geminiConfig.modelId;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("🚨 Gemini 拒绝了请求:", JSON.stringify(data));
        return new Response(JSON.stringify({
          error: `模型拒绝访问: ${response.status}`,
          details: data.error?.message || "未知错误"
        }), { status: response.status });
      }

      console.log("✅ [3/5] Google 成功响应");
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "本喵现在不想理你喵...";
      return new Response(JSON.stringify({ reply }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── 分支 2：OpenAI 兼容接口（DeepSeek / 智谱 / 通义 等国内大模型）──
    if (openaiKey) {
      const baseUrl = (llmBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const model = llmModel || 'gpt-4o-mini';
      console.log(`📡 [2/5] 正在呼叫 OpenAI 兼容模型: ${model} @ ${baseUrl}`);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: maxTokens,
          temperature,
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("🚨 OpenAI 兼容接口拒绝了请求:", JSON.stringify(data));
        return new Response(JSON.stringify({
          error: `模型拒绝访问: ${response.status}`,
          details: data.error?.message || "未知错误"
        }), { status: response.status });
      }

      console.log("✅ [3/5] AI 成功响应");
      const reply = data.choices?.[0]?.message?.content || "本喵现在不想理你喵...";
      return new Response(JSON.stringify({ reply }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── 两个 Key 都没有 ──
    console.error("❌ 找不到 API Key");
    return new Response(JSON.stringify({ error: "Key missing" }), { status: 500 });

  } catch (error: any) {
    console.error("🔥 [5/5] 运行时崩溃:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function GET() {
  return new Response(JSON.stringify({ status: "Ready", model: "Multi-Provider" }), { status: 200 });
}