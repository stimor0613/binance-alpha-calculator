#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { crawlerFetchJson } = require('../src/binance_request_layer');

const LEADERBOARD_ENDPOINT = 'https://www.binance.com/bapi/growth/v1/friendly/growth-paas/resource/summary/list';
const FUNDING_RATE_ENDPOINT = 'https://fapi.binance.com/fapi/v1/fundingRate';
const EXCHANGE_INFO_ENDPOINT = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
const OUT_DIR = __dirname;
const PROJECT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(OUT_DIR, 'competition_config.json');
const REPORT_PATH = path.join(OUT_DIR, 'report.json');
const HTML_DATA_PATH = path.join(OUT_DIR, 'report_data.js');
const MAX_RANK = 200;
const PAGE_SIZE = 100;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { wearCostPer1m: null, config: CONFIG_PATH, skipFetch: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--wear') args.wearCostPer1m = numOrNull(argv[++i]);
    else if (arg === '--config') args.config = path.resolve(argv[++i]);
    else if (arg === '--skip-fetch') args.skipFetch = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function numOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function beijingDateStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function parseBeijingDateTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const ts = Date.parse(`${text.replace(' ', 'T')}:00+08:00`.replace(/:00:00\+08:00$/, ':00+08:00'));
  return Number.isFinite(ts) ? ts : null;
}

function addDays(ts, days) {
  return ts + Number(days) * 24 * 60 * 60 * 1000;
}

function dateStartUtcMs(ymd) {
  return Date.parse(`${ymd}T00:00:00.000Z`);
}

function dateFromBeijingTime(value) {
  const ts = parseBeijingDateTime(value);
  if (!ts) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts));
}

function buildPayload(target, pageIndex) {
  if (target.requestMode === 'resourceIdList') {
    return { resourceIdList: [String(target.resourceId)], pageIndex, pageSize: PAGE_SIZE };
  }
  return {
    resourceId: target.resourceId,
    leaderboardType: target.leaderboardType || 'USER',
    pageIndex,
    pageSize: PAGE_SIZE,
  };
}

function extractResourceSummaryList(json) {
  const data = json?.data || {};
  if (data.resourceSummaryList && !Array.isArray(data.resourceSummaryList)) return data.resourceSummaryList;
  if (Array.isArray(data.resourceSummaryList)) {
    return data.resourceSummaryList.find((item) => Array.isArray(item?.data) || Array.isArray(item?.list) || Array.isArray(item?.rows)) || data.resourceSummaryList[0] || null;
  }
  if (data.summaryList && !Array.isArray(data.summaryList)) return data.summaryList;
  if (Array.isArray(data.summaryList)) return data.summaryList[0] || null;
  if (Array.isArray(data.data)) return { data: data.data, total: data.total };
  if (Array.isArray(data.list)) return { data: data.list, total: data.total };
  return null;
}

function extractRows(list) {
  if (!list) return [];
  if (Array.isArray(list.data)) return list.data;
  if (Array.isArray(list.list)) return list.list;
  if (Array.isArray(list.rows)) return list.rows;
  return [];
}

function rowRank(row) {
  return Number(row.sequence ?? row.rank ?? row.ranking ?? row.no ?? row.index);
}

function rowName(row) {
  return String(row.nickName ?? row.name ?? row.userName ?? row.nickname ?? '');
}

async function fetchLeaderboard(target) {
  const snapshotLeaderboard = readSnapshotLeaderboard(target.snapshotFile);
  if (snapshotLeaderboard.length) {
    return {
      ok: true,
      reason: 'snapshot_file',
      endpoint: target.snapshotFile,
      pages: [],
      leaderboard: snapshotLeaderboard,
    };
  }
  const fallbackLeaderboard = normalizeFallbackLeaderboard(target.fallbackLeaderboard);
  if (!target.resourceId) {
    return {
      ok: fallbackLeaderboard.length > 0,
      reason: fallbackLeaderboard.length > 0 ? 'fallback_leaderboard' : 'missing_resource_id',
      leaderboard: fallbackLeaderboard,
      pages: [],
    };
  }
  const rows = [];
  const pages = [];
  const seen = new Set();
  for (let pageIndex = 1; pageIndex <= Math.ceil(MAX_RANK / PAGE_SIZE) + 2; pageIndex += 1) {
    const payload = buildPayload(target, pageIndex);
    const { status, json } = await crawlerFetchJson(LEADERBOARD_ENDPOINT, {
      method: 'POST',
      jsonBody: payload,
      label: `lishi:${target.slug}:page${pageIndex}`,
      cacheKey: `lishi:${target.slug}:${pageIndex}:${JSON.stringify(payload)}`,
      cacheTtlMs: 60_000,
      headers: {
        Origin: 'https://www.binance.com',
        Referer: target.sourceUrl || 'https://www.binance.com/',
        Clienttype: 'web',
      },
    });
    if (status < 200 || status >= 300 || !json.success) {
      throw new Error(`${target.slug}: leaderboard HTTP ${status}, code=${json.code}, message=${json.message || ''}`);
    }
    const list = extractResourceSummaryList(json);
    const pageRows = extractRows(list);
    pages.push({ pageIndex, rowCount: pageRows.length, total: list?.total ?? null, updatedTime: json.data?.updatedTime ?? null });
    if (!pageRows.length) break;
    for (const row of pageRows) {
      const item = {
        rank: rowRank(row),
        name: rowName(row),
        volumeUSDT: numOrNull(row[target.volumeField || 'grade']),
      };
      const key = `${item.rank}:${item.name}:${item.volumeUSDT}`;
      if (!Number.isFinite(item.rank) || item.rank > MAX_RANK || seen.has(key)) continue;
      seen.add(key);
      rows.push(item);
    }
    if (rows.length >= MAX_RANK) break;
  }
  const leaderboard = rows.sort((a, b) => a.rank - b.rank);
  if (!leaderboard.length && fallbackLeaderboard.length) {
    return {
      ok: true,
      reason: 'fallback_leaderboard_after_empty_api',
      endpoint: LEADERBOARD_ENDPOINT,
      pages,
      leaderboard: fallbackLeaderboard,
    };
  }
  return { ok: true, endpoint: LEADERBOARD_ENDPOINT, pages, leaderboard };
}

function readSnapshotLeaderboard(snapshotFile) {
  if (!snapshotFile) return [];
  const file = path.isAbsolute(snapshotFile) ? snapshotFile : path.join(PROJECT_DIR, snapshotFile);
  try {
    const json = readJson(file);
    const rows = Array.isArray(json.leaderboard)
      ? json.leaderboard
      : Array.isArray(json.leaderboard?.leaderboard)
        ? json.leaderboard.leaderboard
        : [];
    return normalizeFallbackLeaderboard(rows);
  } catch (_) {
    return [];
  }
}

function normalizeFallbackLeaderboard(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      rank: Number(row.rank),
      name: String(row.name || ''),
      volumeUSDT: numOrNull(row.volumeUSDT ?? row.volume),
    }))
    .filter((row) => Number.isFinite(row.rank) && row.rank > 0 && row.rank <= MAX_RANK && Number.isFinite(row.volumeUSDT))
    .sort((a, b) => a.rank - b.rank);
}

async function fetchDailyClose(config, symbol, ymd) {
  if (!ymd) return { ok: false, price: null, reason: 'missing_date' };
  const override = config.priceOverrides?.[symbol]?.[ymd];
  if (override && Number.isFinite(Number(override.price))) {
    return {
      ok: true,
      ymd,
      price: Number(override.price),
      close: Number(override.price),
      source: 'override',
      reason: override.reason || '',
    };
  }
  const startTime = dateStartUtcMs(ymd);
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&startTime=${startTime}&limit=1`;
  try {
    const { json } = await crawlerFetchJson(url, {
      method: 'GET',
      label: `price:${symbol}:${ymd}`,
      cacheKey: `price:${symbol}:${ymd}`,
      cacheTtlMs: 3_600_000,
      preflight: true,
      jitter: false,
    });
    const row = Array.isArray(json) ? json[0] : null;
    if (!row) return { ok: false, price: null, reason: 'no_kline', ymd };
    return {
      ok: true,
      ymd,
      openTime: row[0],
      open: numOrNull(row[1]),
      high: numOrNull(row[2]),
      low: numOrNull(row[3]),
      close: numOrNull(row[4]),
      volume: numOrNull(row[5]),
      quoteVolume: numOrNull(row[7]),
      price: numOrNull(row[4]),
      sourceUrl: url,
    };
  } catch (err) {
    return { ok: false, price: null, reason: err.message, ymd, sourceUrl: url };
  }
}

async function fetchMarketMicro(symbol) {
  const exchangeUrl = `${EXCHANGE_INFO_ENDPOINT}?symbol=${encodeURIComponent(symbol)}`;
  const out = {
    ok: false,
    symbol,
    tickSize: null,
    endClosePrice: null,
    oneTickCostPer1mUAtEnd: null,
    sourceUrls: { exchangeInfo: exchangeUrl },
  };
  try {
    const { json: exchange } = await crawlerFetchJson(exchangeUrl, {
      method: 'GET',
      label: `exchangeInfo:${symbol}`,
      cacheKey: `exchangeInfo:${symbol}`,
      cacheTtlMs: 3_600_000,
      preflight: true,
      jitter: false,
    });
    const info = Array.isArray(exchange?.symbols) ? exchange.symbols.find((item) => item.symbol === symbol) : null;
    const priceFilter = Array.isArray(info?.filters) ? info.filters.find((item) => item.filterType === 'PRICE_FILTER') : null;
    out.tickSize = numOrNull(priceFilter?.tickSize);
    out.ok = Number.isFinite(out.tickSize);
    return out;
  } catch (err) {
    return { ...out, reason: err.message };
  }
}

async function fetchFundingRates(symbol, startTime, endTime) {
  if (!symbol || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return { ok: false, reason: 'invalid_time_range', rows: [], sumFundingRate: null };
  }
  const url = `${FUNDING_RATE_ENDPOINT}?symbol=${encodeURIComponent(symbol)}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
  try {
    const { json } = await crawlerFetchJson(url, {
      method: 'GET',
      label: `funding:${symbol}:${startTime}:${endTime}`,
      cacheKey: `funding:${symbol}:${startTime}:${endTime}`,
      cacheTtlMs: 3_600_000,
      preflight: true,
      jitter: false,
    });
    const rows = Array.isArray(json) ? json.map((row) => ({
      symbol: row.symbol,
      fundingTime: Number(row.fundingTime),
      fundingTimeISO: Number.isFinite(Number(row.fundingTime)) ? new Date(Number(row.fundingTime)).toISOString() : '',
      fundingRate: numOrNull(row.fundingRate),
      markPrice: numOrNull(row.markPrice),
    })).filter((row) => Number.isFinite(row.fundingTime) && Number.isFinite(row.fundingRate)) : [];
    const sumFundingRate = rows.reduce((sum, row) => sum + row.fundingRate, 0);
    return {
      ok: true,
      sourceUrl: url,
      startTime,
      endTime,
      startTimeISO: new Date(startTime).toISOString(),
      endTimeISO: new Date(endTime).toISOString(),
      count: rows.length,
      sumFundingRate: round(sumFundingRate, 10),
      rows,
    };
  } catch (err) {
    return { ok: false, sourceUrl: url, reason: err.message, rows: [], sumFundingRate: null };
  }
}

function rewardForRank(tiers, rank) {
  const tier = tiers.find((item) => rank >= item.rankStart && rank <= item.rankEnd);
  return tier ? Number(tier.rewardToken) : 0;
}

function rankSample(config, leaderboard) {
  return leaderboard.filter((row) => row.rank <= MAX_RANK);
}

function feeCostPer1m(config, scenario, side) {
  const fee = side === 'maker' ? config.baseFees.makerFee : config.baseFees.takerFee;
  return fee * scenario.bnbDiscount * (1 - scenario.rebateRate) * 1_000_000;
}

function buildRows(config, competition, leaderboard, prices, userWearCostPer1m, hedge) {
  const priceAtReward = prices.reward?.price ?? null;
  const priceAtEnd = prices.end?.price ?? null;
  const hedgeMakerFeeRate = Number(hedge?.makerFeeRate || 0);
  const hedgeFundingRateSum = Number(hedge?.funding?.sumFundingRate || 0);
  return rankSample(config, leaderboard).map((row) => {
    const rewardToken = rewardForRank(competition.rewardTiers, row.rank);
    const rewardAtEndU = priceAtEnd === null ? null : rewardToken * priceAtEnd;
    const rewardAtIssueU = priceAtReward === null ? null : rewardToken * priceAtReward;
    const hedgeDeltaU = rewardAtEndU === null || rewardAtIssueU === null ? null : rewardAtIssueU - rewardAtEndU;
    const hedgeTradingFeeU = rewardAtEndU === null || rewardAtIssueU === null
      ? null
      : rewardAtEndU * hedgeMakerFeeRate + rewardAtIssueU * hedgeMakerFeeRate;
    const hedgeFundingPnlU = rewardAtEndU === null || !Number.isFinite(hedgeFundingRateSum)
      ? null
      : rewardAtEndU * hedgeFundingRateSum;
    const hedgeNetU = rewardAtEndU === null || rewardAtIssueU === null || hedgeTradingFeeU === null || hedgeFundingPnlU === null
      ? null
      : rewardAtEndU - rewardAtIssueU - hedgeTradingFeeU + hedgeFundingPnlU;
    const hedgeLockedRewardU = rewardAtEndU === null || hedgeTradingFeeU === null || hedgeFundingPnlU === null
      ? null
      : rewardAtEndU - hedgeTradingFeeU + hedgeFundingPnlU;
    const breakEvenCostPer1mU = rewardAtIssueU === null ? null : (rewardAtIssueU / row.volumeUSDT) * 1_000_000;
    const scenarios = {};
    for (const scenario of config.feeScenarios) {
      const makerCost = feeCostPer1m(config, scenario, 'maker');
      const takerCost = feeCostPer1m(config, scenario, 'taker');
      scenarios[scenario.id] = {
        label: scenario.label,
        makerFeeCostPer1mU: round(makerCost, 4),
        takerFeeCostPer1mU: round(takerCost, 4),
        makerResidualWearPer1mU: breakEvenCostPer1mU === null ? null : round(breakEvenCostPer1mU - makerCost, 4),
        takerResidualWearPer1mU: breakEvenCostPer1mU === null ? null : round(breakEvenCostPer1mU - takerCost, 4),
      };
    }
    const user = userWearCostPer1m === null ? null : {
      wearCostPer1mU: userWearCostPer1m,
      costU: round(row.volumeUSDT / 1_000_000 * userWearCostPer1m, 4),
      netAtIssueU: rewardAtIssueU === null ? null : round(rewardAtIssueU - row.volumeUSDT / 1_000_000 * userWearCostPer1m, 4),
    };
    return {
      rank: row.rank,
      name: row.name,
      volumeUSDT: row.volumeUSDT,
      rewardToken,
      rewardAtEndU: roundOrNull(rewardAtEndU, 4),
      rewardAtIssueU: roundOrNull(rewardAtIssueU, 4),
      hedgeDeltaU: roundOrNull(hedgeDeltaU, 4),
      hedgeTradingFeeU: roundOrNull(hedgeTradingFeeU, 4),
      hedgeFundingPnlU: roundOrNull(hedgeFundingPnlU, 4),
      hedgeNetU: roundOrNull(hedgeNetU, 4),
      hedgeLockedRewardU: roundOrNull(hedgeLockedRewardU, 4),
      breakEvenCostPer1mU: roundOrNull(breakEvenCostPer1mU, 4),
      breakEvenCostRatePct: roundOrNull((breakEvenCostPer1mU || 0) / 10_000, 6),
      scenarios,
      user,
    };
  });
}

function summarizeBest(rows) {
  const candidates = rows.filter((row) => row.user && Number.isFinite(row.user.netAtIssueU));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.user.netAtIssueU - a.user.netAtIssueU)[0];
}

function cutoffs(leaderboard) {
  const byRank = (rank) => leaderboard.find((row) => row.rank === rank) || null;
  return {
    rank20: byRank(20),
    rank50: byRank(50),
    rank100: byRank(100),
    rank150: byRank(150),
    rank200: byRank(200),
  };
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function roundOrNull(value, digits = 2) {
  return Number.isFinite(Number(value)) ? round(value, digits) : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const config = readJson(args.config);
  const report = {
    generatedAt: new Date().toISOString(),
    captureDateBeijing: beijingDateStamp(),
    assumptions: {
      maxRank: MAX_RANK,
      pageSize: PAGE_SIZE,
      userWearCostPer1mU: args.wearCostPer1m,
      rewardIssueDate: 'configurable per competition',
      hedgePeriodDays: config.hedgePeriodDays || 15,
      hedgeMakerFeeRate: (config.baseFees?.makerFee || 0.0002) * 0.9,
      priceField: config.priceSource,
      unknownResourceIdHandling: 'competition is included with rule/price calculation but no leaderboard rows until resourceId is filled',
    },
    feeScenarios: config.feeScenarios.map((scenario) => ({
      ...scenario,
      makerFeeCostPer1mU: round(feeCostPer1m(config, scenario, 'maker'), 4),
      takerFeeCostPer1mU: round(feeCostPer1m(config, scenario, 'taker'), 4),
    })),
    competitions: [],
  };

  for (const competition of config.competitions) {
    const endDate = dateFromBeijingTime(competition.endTimeBeijing);
    const prices = {
      end: await fetchDailyClose(config, competition.symbol, endDate),
      reward: await fetchDailyClose(config, competition.symbol, competition.rewardIssueDate),
    };
    const market = await fetchMarketMicro(competition.symbol);
    const endClose = prices.end?.price ?? null;
    market.endClosePrice = endClose;
    market.oneTickCostPer1mUAtEnd = Number.isFinite(market.tickSize) && Number.isFinite(endClose) && endClose > 0
      ? round(market.tickSize / endClose * 1_000_000, 6)
      : null;
    if ((prices.reward.price === null || prices.reward.price === undefined) && prices.end.price !== null && prices.end.price !== undefined) {
      prices.reward = {
        ...prices.reward,
        ok: true,
        price: prices.end.price,
        close: prices.end.price,
        source: 'fallback_to_end_price',
        reason: `reward price unavailable for ${competition.rewardIssueDate}; using end-date close for provisional ROI`,
      };
    }
    const hedgeStartTime = parseBeijingDateTime(competition.endTimeBeijing);
    const hedgeEndTime = Number.isFinite(hedgeStartTime) ? addDays(hedgeStartTime, config.hedgePeriodDays || 15) : null;
    const hedge = {
      periodDays: config.hedgePeriodDays || 15,
      startTime: hedgeStartTime,
      endTime: hedgeEndTime,
      startTimeISO: Number.isFinite(hedgeStartTime) ? new Date(hedgeStartTime).toISOString() : '',
      endTimeISO: Number.isFinite(hedgeEndTime) ? new Date(hedgeEndTime).toISOString() : '',
      makerFeeRate: (config.baseFees?.makerFee || 0.0002) * 0.9,
      funding: await fetchFundingRates(competition.symbol, hedgeStartTime, hedgeEndTime),
    };
    const leaderboardResult = args.skipFetch
      ? { ok: false, reason: 'skip_fetch', leaderboard: [], pages: [] }
      : await fetchLeaderboard(competition);
    const rows = buildRows(config, competition, leaderboardResult.leaderboard, prices, args.wearCostPer1m, hedge);
    const item = {
      slug: competition.slug,
      name: competition.name,
      symbol: competition.symbol,
      token: competition.token,
      sourceUrl: competition.sourceUrl,
      stage: competition.stage || null,
      stageNote: competition.stageNote || '',
      startTimeBeijing: competition.startTimeBeijing,
      endTimeBeijing: competition.endTimeBeijing,
      rewardIssueDate: competition.rewardIssueDate,
      rewardPoolAmount: competition.rewardPoolAmount,
      rewardTiers: competition.rewardTiers,
      prices,
      market,
      hedge,
      leaderboardStatus: {
        ok: leaderboardResult.ok,
        reason: leaderboardResult.reason || '',
        endpoint: leaderboardResult.endpoint || LEADERBOARD_ENDPOINT,
        resourceId: competition.resourceId,
        pages: leaderboardResult.pages,
        rowCount: leaderboardResult.leaderboard.length,
        cutoffs: cutoffs(leaderboardResult.leaderboard),
      },
      rows,
      bestForUser: summarizeBest(rows),
    };
    report.competitions.push(item);
  }

  writeJson(REPORT_PATH, report);
  fs.writeFileSync(HTML_DATA_PATH, `window.LISHI_REPORT = ${JSON.stringify(report, null, 2)};\n`);
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    report: REPORT_PATH,
    htmlData: HTML_DATA_PATH,
    competitions: report.competitions.map((item) => ({
      slug: item.slug,
      rowCount: item.leaderboardStatus.rowCount,
      leaderboardOk: item.leaderboardStatus.ok,
      reason: item.leaderboardStatus.reason,
      endPrice: item.prices.end.price,
      rewardPrice: item.prices.reward.price,
      tickSize: item.market?.tickSize ?? null,
      oneTickCostPer1mUAtEnd: item.market?.oneTickCostPer1mUAtEnd ?? null,
      bestRank: item.bestForUser?.rank ?? null,
      bestNetU: item.bestForUser?.user?.netAtIssueU ?? null,
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
