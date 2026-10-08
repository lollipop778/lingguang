// /api/clip - 链接转存（YouTube / 网页）→ 提炼成灵感
// 说明：YouTube 服务端字幕抓取已不可用（新版验证机制），故不做；
//       核心素材是"用户写的那句话"，标题等元信息用于补充。
const { deepseekChat, parseAI, json, readBody } = require('../../src/lib/deepseek.js');

function ytId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { url, note } = readBody(event);
    if (!url || !String(url).trim()) return json({ error: '缺少链接' }, 400);

    const meta = { title: '', author: '', thumbnail: '', source: String(url).trim(), kind: 'link' };
    const vid = ytId(url);

    if (vid) {
      // YouTube：oEmbed 免 key 拿标题/作者/缩略图
      try {
        const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`);
        if (r.ok) {
          const o = await r.json();
          meta.kind = 'video';
          meta.title = o.title || '';
          meta.author = o.author_name || '';
          meta.thumbnail = o.thumbnail_url || '';
          meta.source = `https://www.youtube.com/watch?v=${vid}`;
        }
      } catch (e) { /* 失败则用原始链接 */ }
    } else {
      // 普通网页：尽力抓 <title>
      try {
        const r = await fetch(meta.source, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
        if (r.ok) {
          const h = await r.text();
          const t = h.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (t) meta.title = t[1].trim().slice(0, 120);
        }
      } catch (e) { /* 抓不到就留空 */ }
    }

    // 没有用户的话也没有标题 → 无法提炼
    if (!note && !meta.title) return json({ error: '没拿到页面信息，请自己写一句为什么存它' }, 400);

    const fallback = {
      title: (note || meta.title || '').slice(0, 20),
      tags: ['待整理'],
      insight: note || meta.title || '',
      actionHint: '先记着，之后整理',
      related: '',
    };

    try {
      const result = await deepseekChat([
        { role: 'system', content: `用户存了一个链接，并写了一句话说明"为什么存它"。请把它提炼成一条灵感。

链接标题：${meta.title || '（未知）'}
作者/来源：${meta.author || meta.source}
用户为什么存它：${note || '（用户没写，只存了链接）'}

请提炼：
1. title：这条灵感的标题，15字以内，要具体
2. tags：2-3 个标签（内容主题，如：时间管理、消费心理、创作方法）
3. insight：一句深度洞察，50字以内，说明这条灵感的价值在哪
4. actionHint：一个可执行的下一步，20字以内
5. related：这条与其他领域可能的关联，30字内，无则填"无"

严格要求：
- 基于用户写的那句话来理解，不要臆测视频/文章的具体内容（你没有正文）
- 如果用户没写为什么存它，就基于标题做合理推断，但 insight 要保守，不要编造细节

严格返回 JSON（不要 markdown）：
{"title":"","tags":[],"insight":"","actionHint":"","related":""}` },
        { role: 'user', content: '请把这个链接转存为一条灵感' },
      ], process.env.DEEPSEEK_API_KEY);

      const parsed = parseAI(result.choices?.[0]?.message?.content || '', fallback);
      return json({ success: true, demo: false, ...parsed, meta });
    } catch (err) {
      return json({ success: true, demo: true, ...fallback, meta });
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
