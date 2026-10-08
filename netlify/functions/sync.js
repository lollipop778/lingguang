// /api/sync - 跨设备同步（同步码 + Netlify Blobs）
// 设计：无账号，用户自设一个同步码；各设备用同一个码拉取/推送。
// 合并策略：按 id 去重，取 updatedAt（或 time）较新的那条。
const { json, readBody } = require('../../src/lib/deepseek.js');

const STORE = 'lingguang-sync';

function merge(a, b) {
  const map = new Map();
  [...a, ...b].forEach((item) => {
    if (!item || item.id == null) return;
    const cur = map.get(item.id);
    if (!cur) { map.set(item.id, item); return; }
    const ta = new Date(cur.updatedAt || cur.time || 0).getTime();
    const tb = new Date(item.updatedAt || item.time || 0).getTime();
    if (tb > ta) map.set(item.id, item);
  });
  return [...map.values()].sort((x, y) => new Date(y.time || 0) - new Date(x.time || 0));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  let store;
  try {
    const { getStore } = require('@netlify/blobs');
    store = getStore(STORE);
  } catch (e) {
    return json({ error: '同步服务未启用（依赖未安装）' }, 503);
  }

  try {
    if (event.httpMethod === 'GET') {
      const code = (event.queryStringParameters || {}).code || '';
      if (!code) return json({ error: '缺少同步码' }, 400);
      const raw = await store.get(code);
      if (!raw) return json({ success: true, data: [] });
      let arr = [];
      try { arr = JSON.parse(raw); } catch { arr = []; }
      return json({ success: true, data: Array.isArray(arr) ? arr : [] });
    }

    if (event.httpMethod === 'POST') {
      const { code, data } = readBody(event);
      if (!code) return json({ error: '缺少同步码' }, 400);
      const local = Array.isArray(data) ? data : [];

      let remote = [];
      try {
        const raw = await store.get(code);
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) remote = p; }
      } catch (e) { /* 云端为空或解析失败，按空处理 */ }

      const merged = merge(remote, local);
      await store.set(code, JSON.stringify(merged));
      return json({ success: true, data: merged, pulled: remote.length, mergedCount: merged.length });
    }

    return json({ error: '不支持的方法' }, 405);
  } catch (err) {
    return json({ error: err.message || '同步失败' }, 500);
  }
};
