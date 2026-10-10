// Local stand-in for Tranzila, for the end-to-end stack (never deployed) — tests/e2e/tranzila.spec.ts:
//   · the handshake: POST /cgi-bin/tranzila71dt.cgi (supplier, TranzilaPW, sum) → thtk=…, which the form
//     then requires for that sum;
//   · the card form: GET /<terminal>/iframenew.php?sum=…&tranmode=VK&benid=…&notify_url_address=… — its
//     button posts to /<terminal>/pay, which holds the sum on the card (VK), makes a token, sends the
//     notice (form fields, as Tranzila does: Response, TranzilaTK, expmonth, expyear, index,
//     ConfirmationCode, sum, benid…) to the notify address, server to server, then takes the iframe on
//     to the success (or failure) address, posting the same fields. Card 4000 0000 0000 0002 is refused;
//   · the API: POST /v1/transaction/credit_card/create — checks the HMAC headers, refuses fields its
//     schema doesn't know (20004), and: force takes a hold (on the iframe terminal, naming it by
//     reference_txn_id and authorization_number), debit charges a token (on the token terminal),
//     reversal lets a hold go; a token it never made is "no such card" (20401);
//   · GET /charges — what was done (for the test's assertions); GET /health.
//
//   MOCK_TRANZILA_PORT=55050 node tests/support/mock-tranzila.mjs
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_TRANZILA_PORT || 55050);
const APP_KEY = process.env.MOCK_TRANZILA_APP_KEY || 'e2e-tranzila-app-key';
const SECRET = process.env.MOCK_TRANZILA_SECRET || 'e2e-tranzila-secret';
const TERMINAL = process.env.MOCK_TRANZILA_TERMINAL || 'badookinvit';
const TERMINAL_PW = process.env.MOCK_TRANZILA_PW || 'e2e-terminal-pw';
const TOKEN_TERMINAL = process.env.MOCK_TRANZILA_TOKEN_TERMINAL || 'badookinvittok';
const FIELDS = new Set([
  'terminal_name',
  'txn_type',
  'txn_currency_code',
  'payment_plan',
  'card_number',
  'expire_month',
  'expire_year',
  'items',
  'response_language',
  'reference_txn_id',
  'authorization_number',
]);

/** token → the card (and the buyer's email, for the test) */
const tokens = new Map();
/** the form's holds: transaction id → { token, sum, auth, state } */
const holds = new Map();
/** handshakes: thtk → sum */
const handshakes = new Map();
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
const html = (res, page, status = 200) => {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${page}</body></html>`);
};
const result = (res, code, extra = {}) =>
  json(res, 200, {
    error_code: 0,
    message: 'Success',
    transaction_result: { processor_response_code: code, transaction_id: ++txn, ...extra },
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/health') return json(res, 200, { ok: true });
  if (url.pathname === '/charges') return json(res, 200, { charges, notices });

  // the handshake
  if (url.pathname === '/cgi-bin/tranzila71dt.cgi' && req.method === 'POST') {
    const p = Object.fromEntries(new URLSearchParams(await body(req)));
    if (p.supplier !== TERMINAL || p.TranzilaPW !== TERMINAL_PW)
      return html(res, 'Transactions are not allowed from this location');
    const thtk = randomBytes(12).toString('hex');
    handshakes.set(thtk, p.sum);
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end(`thtk=${thtk}`);
  }

  // the card form
  const form = /^\/([^/]+)\/iframenew\.php$/.exec(url.pathname);
  if (form && req.method === 'GET') {
    if (form[1] !== TERMINAL) return html(res, 'הדף שחיפשת לא נמצא', 404);
    const thtk = url.searchParams.get('thtk');
    if (thtk && handshakes.get(thtk) !== url.searchParams.get('sum'))
      return html(res, 'The sum does not match the handshake', 400);
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
        <button type="submit" data-testid="tz-pay">Pay</button>
      </form>`,
    );
  }

  // the form's button: the hold and the token, the notice, then on to the success / failure page
  const pay = /^\/([^/]+)\/pay$/.exec(url.pathname);
  if (pay && req.method === 'POST') {
    const sent = Object.fromEntries(new URLSearchParams(await body(req)));
    const ok = !sent.ccno.endsWith('0002');
    const index = String(++txn);
    const token = ok ? `Z${randomBytes(9).toString('hex')}` : '';
    const auth = String(1000000 + (txn % 8999999));
    if (ok) {
      tokens.set(token, { month: sent.expmonth, year: sent.expyear, email: sent.email ?? null });
      if (sent.tranmode === 'VK') holds.set(index, { token, sum: sent.sum, auth, state: 'held' });
    }
    const fields = {
      ...Object.fromEntries(Object.entries(sent).filter(([k]) => !/url_address$|^mycvv$|^ccno$/.test(k))),
      Response: ok ? '000' : '033',
      ccno: sent.ccno.slice(-4),
      index,
      ...(ok ? { TranzilaTK: token, ConfirmationCode: auth } : {}),
    };
    const notified = await fetch(sent.notify_url_address, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    })
      .then(async (r) => ({ status: r.status, text: await r.text() }))
      .catch((err) => ({ status: 0, text: String(err) }));
    notices.push({ email: sent.email ?? null, response: notified });
    const next = ok ? sent.success_url_address : sent.fail_url_address;
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('');
    return html(
      res,
      `<form id="f" method="post" action="${esc(next)}">${inputs}</form><script>document.getElementById('f').submit()</script>`,
    );
  }

  // the API
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
    const unknown = Object.keys(b).filter((k) => !FIELDS.has(k));
    if (unknown.length)
      return json(res, 200, { error_code: 20004, message: 'Schema mismatch', mismatch_info: unknown });
    const card = tokens.get(b.card_number);
    const amount = b.items?.[0]?.unit_price ?? null;
    const record = (approved) =>
      charges.push({
        terminal: b.terminal_name,
        type: b.txn_type,
        amount,
        email: card?.email ?? null,
        approved,
      });
    if (!card) {
      record(false);
      return json(res, 200, { error_code: 20401, message: 'Credit card fetching failed.' });
    }
    const sameCard = Number(card.month) === b.expire_month && 2000 + Number(card.year) === b.expire_year;
    if (b.txn_type === 'debit') {
      const approved = b.terminal_name === TOKEN_TERMINAL && sameCard;
      record(approved);
      return result(res, approved ? '000' : '004', approved ? { auth_number: '0' + txn } : {});
    }
    if (b.txn_type === 'force' || b.txn_type === 'reversal') {
      const hold = holds.get(String(b.reference_txn_id));
      if (!hold || hold.token !== b.card_number || b.terminal_name !== TERMINAL) {
        record(false);
        return json(res, 200, { error_code: 20112, message: 'Original transaction not found' });
      }
      if (!b.authorization_number || b.authorization_number !== hold.auth) {
        record(false);
        return json(res, 200, { error_code: 21303, message: 'Empty authorization number' });
      }
      if (hold.state !== 'held' || Number(amount) > Number(hold.sum)) {
        record(false);
        return result(res, '057');
      }
      hold.state = b.txn_type === 'force' ? 'captured' : 'released';
      record(true);
      return result(res, '000', { auth_number: hold.auth });
    }
    record(false);
    return json(res, 200, { error_code: 20004, message: 'Unsupported txn_type' });
  }

  json(res, 404, { message: 'not found' });
});

server.listen(port, '127.0.0.1', () => console.log(`mock tranzila on ${port}`));
