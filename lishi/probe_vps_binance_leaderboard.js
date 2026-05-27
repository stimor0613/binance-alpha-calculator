#!/usr/bin/env node
'use strict';

const ENDPOINT = 'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/resource/summary/list';

const tests = [
  {
    slug: 'chip_resourceId',
    referer: 'https://www.binance.com/zh-CN/activity/trading-competition/futures-chip-challenge?utm_source=appanns',
    body: { resourceId: 51201, leaderboardType: 'USER', pageIndex: 1, pageSize: 20 },
  },
  {
    slug: 'chip_resourceIdList',
    referer: 'https://www.binance.com/zh-CN/activity/trading-competition/futures-chip-challenge?utm_source=appanns',
    body: { resourceIdList: ['51201'], pageIndex: 1, pageSize: 20 },
  },
  {
    slug: 'soon_r2_resourceId',
    referer: 'https://www.binance.com/activity/trading-competition/futures-soon-challenge3/tradingcompetitionr2?utm_source=appanns',
    body: { resourceId: 50567, leaderboardType: 'USER', pageIndex: 1, pageSize: 20 },
  },
  {
    slug: 'soon_r2_resourceIdList',
    referer: 'https://www.binance.com/activity/trading-competition/futures-soon-challenge3/tradingcompetitionr2?utm_source=appanns',
    body: { resourceIdList: ['50567'], pageIndex: 1, pageSize: 20 },
  },
  {
    slug: 'aigensyn_control',
    referer: 'https://www.binance.com/zh-CN/activity/trading-competition/futures-aigensyn-challenge?utm_source=appanns',
    body: { resourceId: 54596, leaderboardType: 'USER', pageIndex: 1, pageSize: 5 },
  },
];

function extractRows(json) {
  const data = json?.data || {};
  const list = Array.isArray(data.resourceSummaryList)
    ? data.resourceSummaryList[0]
    : data.resourceSummaryList || data.summaryList || data;
  if (Array.isArray(list?.data)) return list.data;
  if (Array.isArray(list?.list)) return list.list;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

async function main() {
  const results = [];
  for (const test of tests) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          origin: 'https://www.binance.com',
          referer: test.referer,
          clienttype: 'web',
          lang: 'zh-CN',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        },
        body: JSON.stringify(test.body),
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      const rows = extractRows(json);
      results.push({
        slug: test.slug,
        status: res.status,
        success: json?.success,
        code: json?.code,
        message: json?.message,
        rowCount: rows.length,
        sample: rows.slice(0, 5).map((row) => ({
          rank: row.sequence ?? row.rank,
          name: row.nickName ?? row.name,
          volumeUSDT: row.grade ?? row.tradingVolume,
          keys: Object.keys(row).slice(0, 12),
        })),
        rawHead: rows.length ? undefined : text.slice(0, 300),
      });
    } catch (err) {
      results.push({ slug: test.slug, error: err.message });
    }
  }
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    node: process.version,
    endpoint: ENDPOINT,
    results,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
