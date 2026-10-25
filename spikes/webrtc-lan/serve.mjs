// THROWAWAY SPIKE for issue #568: serve spike.html on the LAN so real tablets can run the pairing
// by copy and paste. Plain HTTP is enough for data channels; camera scanning needs HTTPS and is a
// separate check.
//
//   node spikes/webrtc-lan/serve.mjs     then open http://<this machine's LAN address>:8787/
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("./spike.html", import.meta.url)));
createServer((_, res) => {
  res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
  res.end(html);
}).listen(8787, "0.0.0.0", () => console.log("spike page on port 8787"));
