const { DomainError } = require('../domain/error');

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError('JSON形式が不正です', 400, 'BAD_JSON');
  }
}

function handleError(res, error) {
  if (error instanceof DomainError) {
    return sendJson(res, error.status, {
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  return sendJson(res, 500, {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'サーバ内部エラーが発生しました',
    },
  });
}

function notFound(res) {
  return sendJson(res, 404, {
    error: {
      code: 'NOT_FOUND',
      message: '指定されたリソースが見つかりません',
    },
  });
}

module.exports = {
  sendJson,
  readJsonBody,
  handleError,
  notFound,
};
