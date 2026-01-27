export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/token-transfers") {
      return new Response("not found", { status: 404 });
    }

    const address = (url.searchParams.get("address") || "").trim();
    if (!address) {
      return json({ error: "missing address" }, 400);
    }

    const blockNumber = (url.searchParams.get("block_number") || "").trim();
    const index = (url.searchParams.get("index") || "").trim();
    const filter = (url.searchParams.get("filter") || "").trim();

    const params = new URLSearchParams();
    if (blockNumber && index) {
      params.set("block_number", blockNumber);
      params.set("index", index);
    }
    if (filter) {
      params.set("filter", filter);
    }

    const targetUrl = `https://optimism.blockscout.com/api/v2/addresses/${address}/token-transfers${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    try {
      const resp = await fetch(targetUrl, {
        headers: { "User-Agent": "op-txcount-worker" },
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: corsHeaders(),
      });
    } catch (error) {
      return json({ error: String(error) }, 502);
    }
  },
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders(),
  });
}
