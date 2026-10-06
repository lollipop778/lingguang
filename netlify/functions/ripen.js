// /api/ripen - 催熟：按灵感类型分流（思想型/实用型/创作型）
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
        { role: 'system', content: `你是一位内容顾问。用户记录了一条灵感，要帮它"催熟"（变得可执行、可产出）。

用户这条灵感：${topic}
标签：${tagStr}

【第一步】判断这条灵感属于哪一类，只选一个：
- thought（思想型）：探讨概念、追问为什么、观察社会现象、思辨类。例：人为什么会无聊、消费社会的困境
- practical（实用型）：攻略、清单、教程、经验分享、教人怎么做。例：乌鲁木齐避坑指南、如何高效开会
- creative（创作型）：想写故事、做作品、创意表达。例：想写一个关于老人的短篇

【第二步】按类型给出对应的催熟内容（只填该类型的字段，其余留空）：

A. 若 thought：找 2-3 部真正相关的经典著作
   - 必须真实存在，书名/作者/首版年份准确，不得编造
   - chapter：相关章节或核心概念，10字内
   - quote：与该灵感相关的原文片段或核心观点转述，40-80字，具体有信息量，不写空泛套话
   - relevance：说清这本书与这条灵感的具体关联，50字内
   填 citations 数组，每个元素严格用这个字段名：
   {"title":"书名（含书名号）","author":"作者","year":1985,"chapter":"章节","quote":"引用","relevance":"关联"}
   注意：书名的字段名必须是 title，不要用 book / name / 书名 等其他写法

B. 若 practical：只搭内容骨架，绝不替用户撰写具体内容
   - sections：3-6 个板块，每个含 name（板块名，8字内）、hint（这板块要覆盖什么，20字内）、questions（3-5 个"你需要去查证或确认的问题"，用问句，每条25字内）
   - checklist：发布前自查清单，3-5 条，每条20字内
   - tips：一句提醒，关于怎么让这篇内容更有价值，40字内
   填 outline 对象

   ⚠️ 极其重要（实用型必须遵守）：
   - 你的任务是列出「需要调研什么」，不是「告诉用户答案」
   - 绝对不要写任何具体的事实、数字、价格、地名、时间、营业信息、攻略结论
   - 你没有实时信息源，任何具体内容都可能是错的，会误导用户
   - 所有实质内容留给用户自己查证和填写
   - questions 必须是问句，例如"当地实际作息与北京时间差多少？"而不是"当地作息晚2小时"

C. 若 creative：给创作结构建议
   - acts：3-5 个结构段落，每个含 name（6字内）、hint（25字内）
   - references：2-3 个可参考的真实作品或方向，每个含 title、author、why（25字内）
   填 structure 对象

严格返回 JSON（不要 markdown 代码块）：
{"type":"thought","typeLabel":"思想型","citations":[],"outline":{"sections":[],"checklist":[],"tips":""},"structure":{"acts":[],"references":[]}}` },
        { role: 'user', content: '请判断这条灵感的类型，并给出对应的催熟内容' },
      ], process.env.DEEPSEEK_API_KEY);

      const parsed = parseAI(result.choices?.[0]?.message?.content || '', null);
      if (!parsed || !parsed.type) throw new Error('parse failed');

      // 规范化：保证前端能安全渲染
      const out = {
        type: ['thought', 'practical', 'creative'].includes(parsed.type) ? parsed.type : 'thought',
        typeLabel: parsed.typeLabel || '思想型',
        // 容错：模型偶尔用 book/name 等字段名，统一归一为 title
        citations: (Array.isArray(parsed.citations) ? parsed.citations : []).map((c) => ({
          title: c.title || c.book || c.name || '',
          author: c.author || '',
          year: c.year || null,
          chapter: c.chapter || '',
          quote: c.quote || '',
          relevance: c.relevance || '',
        })).filter((c) => c.title),
        outline: parsed.outline || { sections: [], checklist: [], tips: '' },
        structure: parsed.structure || { acts: [], references: [] },
      };
      if (out.type === 'thought' && !out.citations.length) throw new Error('no citations');
      if (out.type === 'practical' && !(out.outline.sections || []).length) throw new Error('no outline');
      if (out.type === 'creative' && !(out.structure.acts || []).length) throw new Error('no structure');

      return json({ success: true, demo: false, ...out });
    } catch (err) {
      return json(demoRipen());
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
