// Local stand-in for Tranzila, for the end-to-end stack (never deployed) — tests/e2e/tranzila.spec.ts:
//   · the iframe: GET /<terminal>/iframenew.php?sum=…&tranmode=…&notify_url_address=… — a card form; its
//     button posts to /<terminal>/pay, which sends the notice (form fields, as Tranzila does) to the
//     notify address, server to server, then takes the iframe on to the success (or failure) address,
//     posting the same fields. Card 4580… is approved (a token is made); 4000 0000 0000 0002 fails;
//   · the API: POST /v1/transaction/credit_card/create — checks the HMAC headers against the app key and
//     secret, the token terminal, and that the token came from this form; approves it (or declines a
//     token it never made);
//   · GET /charges — the charges made (for the test's assertions); POST /reset; GET /health.
//
//   MOCK_TRANZILA_PORT=55050 MOCK_TRANZILA_APP_KEY=… MOCK_TRANZILA_SECRET=… node tests/support/mock-tranzila.mjs
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_TRANZILA_PORT || 55050);
const APP_KEY = process.env.MOCK_TRANZILA_APP_KEY || 'e2e-tranzila-app-key';
const SECRET = process.env.MOCK_TRANZILA_SECRET || 'e2e-tranzila-secret';
const TOKEN_TERMINAL = process.env.MOCK_TRANZILA_TOKEN_TERMINAL || 'badookinvittok';

/** token → the card it stands for */
const tokens = new Map();
let charges = [];
let notices = [];
// transaction ids go on from where they were (a restarted stand-in doesn't reuse them)
let txn = Math.floor(Date.now() / 1000);

const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const body = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
  });
const json = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};
const html = (res, page) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${page}</body></html>`);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/health') return json(res, 200, { ok: true });
  if (url.pathname === '/charges') return json(res, 200, { charges, notices });
  if (url.pathname === '/reset' && req.method === 'POST') {
    charges = [];
    notices = [];
    return json(res, 200, { ok: true });
  }

  // the card form
  const form = /^\/([^/]+)\/iframenew\.php$/.exec(url.pathname);
  if (form && req.method === 'GET') {
    const hidden = [...url.searchParams]
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('');
    return html(
      res,
      `<form method="post" action="/${esc(form[1])}/pay" style="font-family:sans-serif;padding:16px">
        <p data-testid="tz-sum">${esc(url.searchParams.get('sum'))} ₪ · ${esc(url.searchParams.get('pdesc') ?? '')}</p>
        ${hidden}
        <label>Card <input name="ccno" value="4580458045804580" data-testid="tz-card"></label>
        <label>Exp <input name="expmonth" value="08" size="2"><input name="expyear" value="29" size="2"></label>
        <label>CVV <input name="mycvv" value="123" size="3"></label>
        <label>ID <input name="myid" value="123456782"></label>
        <button type="submit" data-testid="tz-pay">Pay</button>
      </form>`,
    );
  }

  // the form's button: the notice, then on to the success / failure page
  const pay = /^\/([^/]+)\/pay$/.exec(url.pathname);
  if (pay && req.method === 'POST') {
    const sent = Object.fromEntries(new URLSearchParams(await body(req)));
    const ok = !sent.ccno.endsWith('0002');
    const token = ok ? `Z${randomBytes(9).toString('hex')}` : '';
    if (ok) tokens.set(token, { last4: sent.ccno.slice(-4), month: sent.expmonth, year: sent.expyear });
    const fields = {
      ...Object.fromEntries(Object.entries(sent).filter(([k]) => !/url_address$|^mycvv$|^ccno$/.test(k))),
      Response: ok ? '000' : '033',
      ccno: sent.ccno.slice(-4),
      index: String(++txn),
      ...(ok ? { TranzilaTK: token } : {}),
    };
    const notified = await fetch(sent.notify_url_address, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    })
      .then(async (r) => ({ status: r.status, text: await r.text() }))
      .catch((err) => ({ status: 0, text: String(err) }));
    notices.push({ fields: { ...fields, TranzilaTK: fields.TranzilaTK ? 'set' : '' }, response: notified });
    const next = ok ? sent.success_url_address : sent.fail_url_address;
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('');
    return html(
      res,
      `<form id="f" method="post" action="${esc(next)}">${inputs}</form><script>document.getElementById('f').submit()</script>`,
    );
  }

  // the API: charging a token
  if (url.pathname === '/v1/transaction/credit_card/create' && req.method === 'POST') {
    const h = req.headers;
    const time = String(h['x-tranzila-api-request-time'] ?? '');
    const nonce = String(h['x-tranzila-api-nonce'] ?? '');
    const expected = createHmac('sha256', SECRET + time + nonce)
      .update(APP_KEY)
      .digest('hex');
    const fresh = Math.abs(Date.now() / 1000 - Number(time)) < 300;
    if (h['x-tranzila-api-app-key'] !== APP_KEY || h['x-tranzila-api-access-token'] !== expected || !fresh)
      return json(res, 401, { error_code: 401, message: 'Unauthorized' });
    const b = JSON.parse(await body(req));
    const card = tokens.get(b.card_number);
    const approved =
      b.terminal_name === TOKEN_TERMINAL &&
      b.txn_type === 'debit' &&
      !!card &&
      Number(card.month) === b.expire_month &&
      2000 + Number(card.year) === b.expire_year;
    const id = ++txn;
    charges.push({
      terminal: b.terminal_name,
      amount: b.items?.[0]?.unit_price ?? null,
      remarks: b.remarks,
      email: b.client?.email ?? null,
      approved,
    });
    return json(res, 200, {
      error_code: 0,
      message: 'Success',
      transaction_result: {
        processor_response_code: approved ? '000' : '004',
        transaction_id: id,
        auth_number: approved ? '0' + String(id).padStart(6, '0') : null,
      },
    });
  }

  json(res, 404, { message: 'not found' });
});

server.listen(port, '127.0.0.1', () => console.log(`mock tranzila on ${port}`));
