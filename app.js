const addressInput = document.getElementById("addressInput");
const btnQuery = document.getElementById("btnQuery");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const statusText = document.getElementById("statusText");
const statusHint = document.getElementById("statusHint");
const resultTable = document.getElementById("resultTable");
const onlyIncoming = document.getElementById("onlyIncoming");
const workerUrlInput = document.getElementById("workerUrl");

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const concurrencyLimit = 5;
const maxBlockscoutPages = 200;
const requestTimeoutMs = 15000;

let lastRows = [];
const isFileProtocol = window.location.protocol === "file:";

function normalizeAddresses(text) {
  const raw = text
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const map = new Map();
  raw.forEach((addr) => {
    if (!addressRegex.test(addr)) return;
    const key = addr.toLowerCase();
    if (!map.has(key)) {
      map.set(key, addr);
    }
  });
  return Array.from(map.values());
}

function updateStatus(message, hint = "") {
  statusText.textContent = message;
  statusHint.textContent = hint;
}

function renderRows(rows) {
  resultTable.innerHTML = `
    <div class="row header">
      <div>地址</div>
      <div>交易次数</div>
      <div>状态</div>
    </div>
  `;

  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = `row ${row.status === "成功" ? "ok" : "fail"}`;
    div.innerHTML = `
      <div>${row.address}</div>
      <div>${row.count}</div>
      <div>${row.status}</div>
    `;
    resultTable.appendChild(div);
  });
}

async function fetchTxCount(address) {
  const target = address.toLowerCase();
  const filterParam = onlyIncoming.checked ? "to" : "";
  const workerBase = (workerUrlInput.value || "").trim().replace(/\/$/, "");
  if (!workerBase) {
    throw new Error("缺少 Worker 地址");
  }

  const baseUrl = `${workerBase}/token-transfers?address=${encodeURIComponent(address)}${filterParam ? `&filter=${filterParam}` : ""}`;
  const res = await fetchWithTimeout(baseUrl);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  let total = 0;
  const firstItems = data?.items || [];
  if (onlyIncoming.checked) {
    total += firstItems.filter((item) => String(item?.to?.hash || "").toLowerCase() === target).length;
  } else {
    total += firstItems.length;
  }
  let pageParams = data?.next_page_params || null;
  let pageCount = 1;
  while (pageParams && pageCount < maxBlockscoutPages) {
    const params = new URLSearchParams();
    if (pageParams.block_number !== undefined) params.set("block_number", pageParams.block_number);
    if (pageParams.index !== undefined) params.set("index", pageParams.index);
    if (filterParam) params.set("filter", filterParam);
    const pageUrl = `${workerBase}/token-transfers?address=${encodeURIComponent(address)}&${params.toString()}`;
    const pageRes = await fetchWithTimeout(pageUrl);
    if (!pageRes.ok) {
      throw new Error(`HTTP ${pageRes.status}`);
    }
    const pageData = await pageRes.json();
    const pageItems = pageData?.items || [];
    if (onlyIncoming.checked) {
      total += pageItems.filter((item) => String(item?.to?.hash || "").toLowerCase() === target).length;
    } else {
      total += pageItems.length;
    }
    pageParams = pageData?.next_page_params || null;
    pageCount += 1;
  }
  if (pageParams) {
    throw new Error("页数过多");
  }
  return String(total);
}

function formatError(error) {
  const message = String(error?.message || "未知错误");
  if (message.includes("Failed to fetch")) {
    return "网络/跨域";
  }
  if (message.includes("超时")) {
    return "请求超时";
  }
  if (message.includes("HTTP 404")) {
    return "Worker 地址/路径错误";
  }
  if (message.includes("页数过多")) {
    return "数据量过大";
  }
  return message.replace("HTTP ", "HTTP");
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("超时");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildCsv(rows) {
  const header = "address,transactions_count,status";
  const lines = rows.map((row) => `${row.address},${row.count},${row.status}`);
  return [header, ...lines].join("\n");
}

async function runQueue(addresses) {
  const results = [];
  let finished = 0;
  const pending = [...addresses];

  const workers = Array.from({ length: concurrencyLimit }, async () => {
    while (pending.length) {
      const address = pending.shift();
      if (!address) return;
      try {
        const count = await fetchTxCount(address);
        results.push({ address, count, status: "成功" });
      } catch (error) {
        console.error("query error:", address, error);
        const reason = formatError(error);
        results.push({ address, count: "-", status: `失败(${reason})` });
      } finally {
        finished += 1;
        updateStatus(`查询中 ${finished}/${addresses.length}`);
        renderRows(results);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

btnQuery.addEventListener("click", async () => {
  if (isFileProtocol) {
    updateStatus("无法请求接口", "请用本地服务器打开此页面（file:// 会被浏览器拦截）");
    return;
  }

  if (!(workerUrlInput.value || "").trim()) {
    updateStatus("缺少 Worker 地址", "请填写 Cloudflare Worker 地址");
    return;
  }

  const addresses = normalizeAddresses(addressInput.value || "");
  if (addresses.length === 0) {
    updateStatus("请输入有效地址", "示例：每行一个 0x 开头地址");
    return;
  }

  btnQuery.disabled = true;
  btnCopy.disabled = true;
  btnDownload.disabled = true;
  lastRows = [];

  updateStatus("开始查询", "");
  renderRows([]);

  lastRows = await runQueue(addresses);

  updateStatus("查询完成", `成功 ${lastRows.filter((r) => r.status === "成功").length}`);
  btnQuery.disabled = false;
  btnCopy.disabled = lastRows.length === 0;
  btnDownload.disabled = lastRows.length === 0;
});

btnCopy.addEventListener("click", async () => {
  if (!lastRows.length) return;
  try {
    await navigator.clipboard.writeText(buildCsv(lastRows));
    updateStatus("已复制 CSV", "");
  } catch (error) {
    console.error("copy error:", error);
    updateStatus("复制失败", "请手动选择复制");
  }
});

btnDownload.addEventListener("click", () => {
  if (!lastRows.length) return;
  const blob = new Blob([buildCsv(lastRows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "optimism_tx_count.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

if (isFileProtocol) {
  updateStatus("提示", "建议用本地服务器打开（file:// 会被浏览器拦截跨域请求）");
}
