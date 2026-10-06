// /api/health - 健康检查 (Netlify Function)
const { json } = require('../../src/lib/deepseek.js');

exports.handler = async () => {
  const live = !!process.env.DEEPSEEK_API_KEY;
  return json({ status: 'ok', mode: live ? 'live' : 'demo', time: new Date().toISOString() });
};
