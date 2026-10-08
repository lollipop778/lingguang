// /api/verify - 校验授权码
// 环境变量 ACCESS_CODES 为逗号分隔的授权码列表。
// 重要：若未配置该变量则一律放行（避免把自己也锁在外面）。
const { json, readBody } = require('../../src/lib/deepseek.js');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  try {
    const { code } = readBody(event);
    const list = (process.env.ACCESS_CODES || '')
      .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

    // 未配置授权码 → 不限制
    if (!list.length) return json({ success: true, unlimited: true });

    const input = String(code || '').trim().toUpperCase();
    if (!input) return json({ success: false, error: '请输入授权码' }, 400);

    if (list.includes(input)) return json({ success: true });
    return json({ success: false, error: '授权码无效' }, 403);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
