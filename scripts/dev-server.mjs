import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PORT = Number(process.env.PORT || 5173);
const MAX_PORT_ATTEMPTS = 10;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

startServer(DEFAULT_PORT);

async function handleRequest(req, res) {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const safeUrl = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  let relativePath = decodeURIComponent(safeUrl.pathname);
  if (relativePath.endsWith('/')) {
    relativePath += 'index.html';
  }

  const filePath = path.join(ROOT, relativePath);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      await sendFile(path.join(filePath, 'index.html'), res);
    } else {
      await sendFile(filePath, res);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('File not found');
    } else {
      res.writeHead(500);
      res.end('Server error');
    }
  }
}

function sendFile(filePath, res) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
}

function startServer(port, attempt = 0) {
  const server = createServer(handleRequest);

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS - 1) {
      startServer(port + 1, attempt + 1);
      return;
    }

    console.error(`Failed to start dev server on port ${port}: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });
}
