// 共享模块：DeepSeek API 调用（CommonJS，Netlify zip-it-and-ship-it 可自动打包）
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

async function deepseekChat(messages, apiKey, enableWebSearch = false) {
  if (!apiKey) throw new Error('NO_API_KEY');

  const body = {
    model: 'deepseek-chat',
    messages,
    stream: false,
    temperature: 0.7,
    max_tokens: 2000,
  };
  if (enableWebSearch) {
    body.tools = [{ type: 'web_search', web_search: { enable: true } }];
  }

  const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek API error ${resp.status}`);
  }
  return resp.json();
}

function parseAI(content, fallback) {
  try {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

// Netlify 统一响应格式（自带 CORS）
function json(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(data),
  };
}

function readBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

// ── Demo 降级数据 ─────────────────────
function demoRefine(raw) {
  const seed = (raw || '').length % 5;
  const titles = ['关于「' + (raw || '').slice(0, 8) + '」的思考', '重新审视：' + (raw || '').slice(0, 10), '一个想法：' + (raw || '').slice(0, 10)];
  const tags = [['产品思考', '效率工具'], ['社会观察', '日常洞察'], ['技术趋势', '未来展望']];
  const insights = [
    '你注意到了一个有趣的现象，这背后可能反映了更深层的用户需求变化。',
    '这个观察角度很独特，值得进一步探索它的边界条件。',
    '这或许是一个信号，暗示某类问题的解决方案正在发生范式转移。',
  ];
  const idx = seed % 3;
  return { success: true, demo: true, title: titles[idx], tags: tags[idx], insight: insights[idx], related: '无', actionHint: '花10分钟头脑风暴' };
}

function demoRipen() {
  const pool = [
    { title: '《工作、消费主义和新穷人》', author: '齐格蒙特·鲍曼', year: 2004, chapter: '消费社会', quote: '在消费社会中，贫穷不仅意味着物质匮乏，更意味着被排除在正常生活的想象之外。', relevance: '你观察到的现象，鲍曼把它追溯到了消费社会对人之价值的重新定义。' },
    { title: '《思考，快与慢》', author: '丹尼尔·卡尼曼', year: 2011, chapter: '系统一与系统二', quote: '系统一自动快速地运作，系统二则需要集中注意力处理费力的心智活动。', relevance: '你的直觉来自系统一，而这条灵感要变成洞见需要系统二的审视。' },
  ];
  return { success: true, demo: true, type: 'thought', typeLabel: '思想型', citations: pool, outline: { sections: [], checklist: [], tips: '' }, structure: { acts: [], references: [] } };
}

function demoDraft() {
  return {
    success: true, demo: true,
    title: '这条灵感值得写成一篇笔记',
    body: '（AI 未就绪，这是示例）\n\n把你真实的经历和感受写在这里，比任何通用攻略都更有价值。',
    tags: ['灵感', '记录', '生活'],
    tips: '配上你自己的照片或真实细节，效果会好很多。',
  };
}

function demoPersona() {
  return {
    success: true, demo: true,
    type: '灵感收集者',
    archetype: '你在持续记录中，人设正在慢慢成形。',
    traits: ['留意日常细节', '喜欢追问为什么', '关注人与系统的互动'],
    blindSpot: '记录多但推进少，想法容易停在纸面',
    suggest: '挑一条最想做的，设个24小时倒计时先动起来',
  };
}

module.exports = { deepseekChat, parseAI, json, readBody, demoRefine, demoRipen, demoPersona, demoDraft };
