# Optimism 地址交易次数查询（网页版）

一个独立的静态网页工具，使用 Blockscout TokenTx 统计转入次数。

## 使用

1. 部署 Cloudflare Worker（解决跨域）：
   - 新建 Worker，并把 `worker.js` 内容粘贴进去
   - 发布后得到 Worker 访问地址
2. 启动本地静态服务器：
   - `python3 -m http.server 8080`
   - 浏览器访问：`http://localhost:8080`
3. 在页面中勾选「仅统计转入（to=地址）」
4. 填写 Worker 地址
5. 粘贴地址列表（每行一个）并点击「开始查询」
6. 可复制或下载 CSV 结果

## 说明

- Blockscout TokenTx：`https://optimism.blockscout.com/api/v2/addresses/{address}/token-transfers`
