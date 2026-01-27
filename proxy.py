#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import urlopen, Request

BLOCKSCOUT_BASE = "https://optimism.blockscout.com/api/v2"


class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path not in ("/token-transfers",):
            self._set_headers(404, "text/plain")
            self.wfile.write(b"not found")
            return

        params = parse_qs(parsed.query)
        address = (params.get("address") or [""])[0].strip()
        if not address:
            self._set_headers(400, "application/json")
            self.wfile.write(b'{"error":"missing address"}')
            return

        block_number = (params.get("block_number") or [""])[0].strip()
        index = (params.get("index") or [""])[0].strip()
        filter_param = (params.get("filter") or [""])[0].strip()
        query = ""
        extras = []
        if block_number and index:
            extras.append(f"block_number={block_number}")
            extras.append(f"index={index}")
        if filter_param:
            extras.append(f"filter={filter_param}")
        if extras:
            query = "?" + "&".join(extras)
        url = f"{BLOCKSCOUT_BASE}/addresses/{address}/token-transfers{query}"
        try:
            req = Request(url, headers={"User-Agent": "op-txcount-proxy"})
            with urlopen(req, timeout=15) as resp:
                data = resp.read()
                self._set_headers(200, "application/json")
                self.wfile.write(data)
        except Exception as exc:
            self._set_headers(502, "application/json")
            msg = str(exc).replace('"', "'")
            self.wfile.write(f'{{"error":"{msg}"}}'.encode("utf-8"))


def main():
    server = HTTPServer(("127.0.0.1", 8787), Handler)
    print("Proxy running on http://127.0.0.1:8787")
    server.serve_forever()


if __name__ == "__main__":
    main()
