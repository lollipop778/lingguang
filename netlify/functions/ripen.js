// /api/ripen - 催熟：针对具体灵感给出真实著作引用 (Netlify Function)
const { deepseekChat, parseAI, json, readBody, demoRipen } = require('../../src/lib/deepseek.js');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { inspiration, userTags } = readBody(event);
    const insp = inspiration || {};
    const tagStr = (insp.tags || userTags || []).join('、') || '未分类';
    const topic = [insp.title, insp.insight, insp.raw].filter(Boolean).join(' / ') || tagStr;

    try {
      const result = await deepseekChat([
        { role: 'system', content: `你是一位博学的思想引路人。用户记录了一条灵感，你的任务是找出真正与之相关的经典著作，并给出有据可查的引用。

用户这条灵感：${topic}
标签：${tagStr}

请挑选 2-3 部与该灵感主题真正相关的经典著作或思想作品。要求：
1. 必须是真实存在的著作，书名、作者、出版年份准确，不要编造
2. 每部给出：title（书名）、author（作者）、year（首版年份）、chapter（相关章节或核心概念，10字内）
3. quote：该书中与该灵感真正相关的原文片段或核心观点转述，40-80字，要具体、有信息量，不要空泛的套话。如果无法确认精确原文，就转述该书的核心观点，但必须忠实于原书思想
4. relevance：说明这本书的这个观点与用户这条灵感的具体关联，50字内，说清楚为什么这条灵感可以在这本书里找到源头或回应

严格返回 JSON（不要 markdown）：
{"citations":[{"title":"","author":"","year":2000,"chapter":"","quote":"","relevance":""}]}` },
        { role: 'user', content: '请为这条灵感找出思想源头，给出真实著作的具体引用' },
      ], process.env.DEEPSEEK_API_KEY);

      const parsed = parseAI(result.choices?.[0]?.message?.content || '', { citations: [] });
      const cites = Array.isArray(parsed.citations) ? parsed.citations : [];
      if (!cites.length) throw new Error('empty');
      return json({ success: true, demo: false, citations: cites });
    } catch (err) {
      return json(demoRipen());
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
