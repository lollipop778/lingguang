// /api/draft - 把一条灵感组织成小红书风格的文案草稿
// 只做生成 + 复制，不做自动发布（小红书无开放发布 API）
const { deepseekChat, parseAI, json, readBody, demoDraft } = require('../../src/lib/deepseek.js');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { inspiration, platform, ripen, chat } = readBody(event);
    const i = inspiration || {};
    if (!i.title && !i.raw) return json({ error: '缺少灵感内容' }, 400);

    // 把推进记录一并交给 AI，草稿才能基于用户真实做过的事
    const logs = Array.isArray(i.logs) ? i.logs : [];
    const logText = logs.length
      ? '\n\n用户推进过程中记录下的真实内容：\n' + logs.map((l, n) => `${n + 1}. ${l.text}`).join('\n')
      : '';

    const tagStr = (i.tags || []).join('、') || '未分类';
    const isXhs = (platform || 'xiaohongshu') === 'xiaohongshu';

    // 催熟参考 + 追问对话，也作为写笔记的素材（精简以控 token）
    let ripenText = '';
    const r = ripen || {};
    const cites = Array.isArray(r.citations) ? r.citations.slice(0, 4) : [];
    if (cites.length) {
      ripenText += '\n\n可参考的著作观点（只取观点，不要照抄原文，也不要硬塞）：\n' +
        cites.map(c => `- 《${c.title || ''}》${c.author || ''}：${(c.relevance || '').slice(0, 50)}`).join('\n');
    }
    const secs = (r.outline && Array.isArray(r.outline.sections)) ? r.outline.sections.slice(0, 6) : [];
    if (secs.length) {
      ripenText += '\n可参考的骨架板块：' + secs.map(s => (s.name || '') + '（' + (s.hint || '').slice(0, 20) + '）').join('；');
    }
    const acts = (r.structure && Array.isArray(r.structure.acts)) ? r.structure.acts.slice(0, 5) : [];
    if (acts.length) {
      ripenText += '\n可参考的结构：' + acts.map(a => (a.name || '') + '（' + (a.hint || '').slice(0, 20) + '）').join('；');
    }

    let chatText = '';
    const ch = Array.isArray(chat) ? chat.slice(-6) : [];   // 最多 3 轮
    if (ch.length) {
      chatText = '\n\n你之前追问过的思路（可吸收其中的角度，但不要原样照搬成正文）：\n' +
        ch.map(m => `${m.role === 'user' ? '问' : '答'}：${String(m.text || '').slice(0, 150)}`).join('\n');
    }

    try {
      const result = await deepseekChat([
        { role: 'system', content: `你是一位${isXhs ? '小红书' : '社交媒体'}内容编辑。用户要把自己记录的一条灵感，写成一篇可以发布的笔记草稿。

这条灵感：
标题：${i.title || ''}
原始记录：${i.raw || ''}
洞察：${i.insight || ''}
标签：${tagStr}${logText}${ripenText}${chatText}

要求：
1. title：一个吸引人的笔记标题，20字以内。可以用数字、痛点、悬念、反差，但不要标题党到失真
2. body：正文，300-600字。要求：
   - 分段清晰，每段之间空一行
   - 口语化、有个人感，像真实用户在分享，不要像百科或广告
   - 恰当使用 emoji 分隔和强调（小红书风格，但不要过度堆砌，每段最多1-2个）
   - 有具体细节和场景感，避免空泛的正确废话
   - ${logs.length ? '优先使用用户推进记录里的真实内容作为素材' : '基于灵感本身合理展开'}
   - 结尾可以抛一个互动问题
3. tags：5-8 个话题标签，不带 # 号，贴合内容主题
4. tips：一句发布建议，40字内，提醒用户补充什么会让这篇更好

重要：不要编造用户的个人经历（比如"我去了三次""我朋友说"这类具体经历），除非推进记录里真的有。保持真实。

严格返回 JSON（不要 markdown）：
{"title":"","body":"","tags":[],"tips":""}` },
        { role: 'user', content: '请把这条灵感写成一篇可以发布的小红书笔记草稿' },
      ], process.env.DEEPSEEK_API_KEY);

      const parsed = parseAI(result.choices?.[0]?.message?.content || '', null);
      if (!parsed || !parsed.title) throw new Error('parse failed');

      return json({
        success: true, demo: false,
        title: parsed.title || i.title || '未命名',
        body: parsed.body || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean).slice(0, 8) : [],
        tips: parsed.tips || '',
      });
    } catch (err) {
      return json(demoDraft());
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
