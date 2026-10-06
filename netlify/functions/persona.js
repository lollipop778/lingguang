// /api/persona - 人设定位分析 (Netlify Function)
const { deepseekChat, parseAI, json, readBody, demoPersona } = require('../../src/lib/deepseek.js');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { inspirations: inspList } = readBody(event);

    if (!inspList || !inspList.length) {
      return json({
        success: true, type: '灵感新芽',
        archetype: '你才刚刚开始记录，人设正在形成中',
        traits: [], blindSpot: '',
        suggest: '再记录5条灵感，AI就能为你做精准人设定位',
      });
    }

    try {
      const summaries = inspList.slice(0, 20).map(i =>
        `[${(i.tags || []).join(',')}] ${i.title || ''} —— ${(i.insight || '').slice(0, 60)}`
      ).join('\n');

      const result = await deepseekChat([
        { role: 'system', content: `你是一个深度人格洞察助手。用户持续记录了以下灵感片段，请综合分析这些内容的主题、思考方式、关注角度，为用户做一个"创意人设定位"。

灵感记录：
${summaries}

请分析：
1. 用户是什么类型的思考者/创作者？（给一个独特的标签 type，10字以内，不要套话）
2. 一句话人设描述 archetype（50字以内）
3. 核心特质 traits（3条，每条15字以内，要具体不要笼统）
4. 盲区 blindSpot（1条，30字以内，诚实而有建设性）
5. 成长建议 suggest（1条，40字以内，可执行）

严格返回 JSON（不要 markdown 代码块）：
{"type":"","archetype":"","traits":[],"blindSpot":"","suggest":""}` },
        { role: 'user', content: '请分析我的创意人设' },
      ], process.env.DEEPSEEK_API_KEY);

      const parsed = parseAI(result.choices?.[0]?.message?.content || '', {
        type: '灵感收集者', archetype: '继续记录，让我更了解你', traits: [], blindSpot: '', suggest: '继续记录',
      });
      return json({ success: true, demo: false, ...parsed });
    } catch (err) {
      return json(demoPersona());
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
