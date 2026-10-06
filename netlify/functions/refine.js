// /api/refine - 灵感提炼 (Netlify Function)
const { deepseekChat, parseAI, json, readBody, demoRefine } = require('../../src/lib/deepseek.js');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { rawText } = readBody(event);
    const raw = (rawText || '').trim();
    if (!raw) return json({ error: '请输入灵感内容' }, 400);

    try {
      const result = await deepseekChat([
        { role: 'system', content: `你是一个灵感提炼助手。用户会输入一段随意的文字（可能是吐槽、观察、想法、问题等），请你：
1. 提取核心观点，给一个吸引人的标题（15字以内）
2. 给2-3个标签（如：产品设计、社会观察、技术趋势、个人成长等）
3. 写一句深度洞察（50字以内），帮用户看到更深层的含义
4. 给一个关联提示 related（30字内，说明这条灵感和哪些领域或已有想法可能相关，无则填"无"）
5. 给一个可执行的下一步行动建议 actionHint（20字以内）

严格返回JSON（不要markdown代码块）：
{"title":"标题","tags":["标签1","标签2"],"insight":"洞察","related":"关联","actionHint":"行动建议"}` },
        { role: 'user', content: raw },
      ], process.env.DEEPSEEK_API_KEY);

      const content = result.choices?.[0]?.message?.content || '';
      const parsed = parseAI(content, {
        title: raw.slice(0, 15), tags: ['灵感'], insight: content.slice(0, 50), related: '无', actionHint: '进一步思考',
      });
      return json({ success: true, demo: false, ...parsed });
    } catch (err) {
      return json(demoRefine(raw));
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
