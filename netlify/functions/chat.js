// /api/chat - 催熟板块的追问对话
// token 控制策略：
//   1) 只传精简上下文（不传引用全文 quote，只传书名+章节+关联）
//   2) 历史对话滑动窗口只保留最近 10 轮（防上下文无限膨胀）
//   3) 前端限制每条灵感最多 10 轮、单条问题 <=200 字
const { deepseekChat, json, readBody } = require('../../src/lib/deepseek.js');

const MAX_TURNS = 10;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { inspiration, ripen, question, history } = readBody(event);
    const q = String(question || '').trim();
    if (!q) return json({ error: '请输入问题' }, 400);
    if (q.length > 200) return json({ error: '问题请控制在 200 字以内' }, 400);

    const i = inspiration || {};
    const r = ripen || {};

    // 精简上下文：灵感只取标题/洞察/标签；催熟只取书名+章节+关联（不取 quote 全文）
    const inspBrief = [
      '标题：' + (i.title || ''),
      '洞察：' + (i.insight || ''),
      '标签：' + ((i.tags || []).join('、') || '无'),
    ].join('\n');

    let ripenBrief = '';
    const cites = Array.isArray(r.citations) ? r.citations : [];
    if (cites.length) {
      ripenBrief = '已给出的著作：\n' + cites.slice(0, 4).map(c =>
        `- 《${c.title || ''}》${c.author || ''}${c.chapter ? '（' + c.chapter + '）' : ''}：${(c.relevance || '').slice(0, 40)}`
      ).join('\n');
    }
    const secs = (r.outline && Array.isArray(r.outline.sections)) ? r.outline.sections : [];
    if (secs.length) {
      ripenBrief += '\n已给出的骨架：' + secs.slice(0, 6).map(s => (s.name || '') + '（' + (s.hint || '') + '）').join('；');
    }
    const acts = (r.structure && Array.isArray(r.structure.acts)) ? r.structure.acts : [];
    if (acts.length) {
      ripenBrief += '\n已给出的结构：' + acts.slice(0, 5).map(a => (a.name || '') + '（' + (a.hint || '') + '）').join('；');
    }

    // 历史滑动窗口：只保留最近 10 轮（每轮含问答两条）
    const hist = Array.isArray(history) ? history.slice(-MAX_TURNS * 2) : [];
    const messages = [
      { role: 'system', content: `你是内容顾问，正在帮用户深挖一条灵感。

这条灵感：
${inspBrief}

${ripenBrief || '（还没有给出参考内容）'}

回答要求：
- 紧扣这条灵感，直接、具体、可执行，不写空话套话
- 200 字以内，口语化
- 不要编造具体事实、数据、书名（除非上面已给出）
- 用户没给正文，所以不要假装在引用原文
- 用户的问题可能超出上面已给的参考内容，这是完全正常的：此时就围绕这条灵感本身、
  结合常识来回答，不要硬把话题拽回那些著作。跟着用户关心的问题走` },
      ...hist.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.text || '').slice(0, 500) })),
      { role: 'user', content: q },
    ];

    try {
      const result = await deepseekChat(messages, process.env.DEEPSEEK_API_KEY, false);
      const answer = (result.choices?.[0]?.message?.content || '').trim();
      if (!answer) throw new Error('empty');
      return json({ success: true, answer, turns: hist.length + 1, maxTurns: MAX_TURNS });
    } catch (err) {
      return json({ success: false, error: 'AI 暂时无法回答，稍后再试' }, 200);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
