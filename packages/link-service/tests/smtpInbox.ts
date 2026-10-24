import { createServer, type Server, type Socket } from "node:net";

/** Local SMTP inbox for tests. It never forwards a message to a real address. */
export function createSmtpInbox(
  options: { silent?: boolean } = {},
): Promise<{ server: Server; port: number; received: string[] }> {
  const received: string[] = [];
  return new Promise((resolve) => {
    const server = createServer((socket: Socket) => {
      if (options.silent === true) return;
      socket.setEncoding("utf8");
      let data = "";
      let inData = false;
      socket.write("220 test inbox ready\r\n");
      socket.on("data", (chunk: string) => {
        data += chunk;
        for (;;) {
          if (inData) {
            const end = data.indexOf("\r\n.\r\n");
            if (end < 0) return;
            received.push(data.slice(0, end));
            data = data.slice(end + 5);
            inData = false;
            socket.write("250 queued\r\n");
            continue;
          }
          const eol = data.indexOf("\r\n");
          if (eol < 0) return;
          const line = data.slice(0, eol);
          data = data.slice(eol + 2);
          if (line.startsWith("EHLO")) socket.write("250 test inbox\r\n");
          else if (line.startsWith("MAIL") || line.startsWith("RCPT")) socket.write("250 ok\r\n");
          else if (line === "DATA") {
            inData = true;
            socket.write("354 go\r\n");
          } else if (line === "QUIT") socket.end("221 bye\r\n");
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === "object" && address ? address.port : 0,
        received,
      });
    });
  });
}
