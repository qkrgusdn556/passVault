const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8']
]);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types.get(path.extname(filePath)) || 'application/octet-stream' });
    res.end(data);
  });
});

const port = Number(process.env.PORT || 8791);
server.listen(port, '127.0.0.1', () => {
  console.log(`PassVault web demo: http://127.0.0.1:/login-demo.html`);
});


