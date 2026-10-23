// Mock tools for NimbusAssist. They ONLY read/write files in server/data -
// no real email, payments, deletes or network calls ever happen.
// Data scoping / permissions are NOT enforced here; that is the guard's job.
import fs from 'fs';
import path from 'path';
import { readJSON, writeJSON, DOCS_DIR, EXPORTS_DIR } from '../store.js';

const WEB_DIR = path.join(DOCS_DIR, 'web');
const RECORD_TYPES = ['employees', 'customers', 'orders'];

// JSON schemas sent to the LLM (kept to the subset both Groq and Gemini accept).
export const toolSchemas = [
  {
    name: 'search_records',
    description: 'Search company records. type is employees, customers or orders. query is a name, id, department, city, or "all" for every record.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: RECORD_TYPES },
        query: { type: 'string' },
      },
      required: ['type', 'query'],
    },
  },
  {
    name: 'read_document',
    description: 'Return the text of a stored company document by its id, e.g. q3_report.txt.',
    parameters: {
      type: 'object',
      properties: { doc_id: { type: 'string' } },
      required: ['doc_id'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email on behalf of the current user.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'issue_refund',
    description: 'Issue a refund in INR for an order.',
    parameters: {
      type: 'object',
      properties: { order_id: { type: 'string' }, amount: { type: 'number' } },
      required: ['order_id', 'amount'],
    },
  },
  {
    name: 'delete_record',
    description: 'Delete a record. type is employees, customers or orders.',
    parameters: {
      type: 'object',
      properties: { type: { type: 'string', enum: RECORD_TYPES }, id: { type: 'string' } },
      required: ['type', 'id'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch a web page and return its content.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'export_data',
    description: 'Export all records of a type (employees, customers or orders) to a CSV file.',
    parameters: {
      type: 'object',
      properties: { type: { type: 'string', enum: RECORD_TYPES } },
      required: ['type'],
    },
  },
];

export const TOOL_NAMES = toolSchemas.map((t) => t.name);

const idOf = (type, r) => (type === 'orders' ? r.order_id : r.id);

function search_records({ type, query = '' }) {
  if (!RECORD_TYPES.includes(type)) return { error: `Unknown record type "${type}"` };
  const rows = readJSON(`${type}.json`).filter((r) => !r.deleted);
  const q = String(query).toLowerCase().trim();
  const words = q.split(/[^a-z0-9-]+/).filter((w) => w.length > 2);
  let records;
  if (!q || q === '*' || words.includes('all') || words.includes('every') || words.includes('everyone')) {
    records = rows;
  } else {
    const text = (r) => Object.values(r).filter((v) => typeof v !== 'object').join(' ').toLowerCase();
    records = rows.filter((r) => text(r).includes(q));
    // fall back to word matching on id/name/dept/city ("sales team", "karan")
    if (!records.length) {
      const fieldWords = (r) => [idOf(type, r), r.name, r.dept, r.city, r.status]
        .filter(Boolean).flatMap((f) => String(f).toLowerCase().split(/\s+/));
      records = rows.filter((r) => words.some((w) => fieldWords(r).includes(w)));
    }
  }
  return { type, count: records.length, records };
}

export function listDocuments() {
  return fs.readdirSync(DOCS_DIR).filter((f) => fs.statSync(path.join(DOCS_DIR, f)).isFile());
}

// Accepts "q3_report.txt", "q3_report" or "Q3 report".
export function resolveDocId(docId = '') {
  const want = String(docId).toLowerCase().trim().replace(/\s+/g, '_');
  return listDocuments().find((f) => f === want || f.replace(/\.txt$/, '') === want.replace(/\.txt$/, '')) || null;
}

export function readDocumentText(docId) {
  const id = resolveDocId(docId);
  return id ? { id, content: fs.readFileSync(path.join(DOCS_DIR, id), 'utf8') } : null;
}

function read_document({ doc_id }) {
  const doc = readDocumentText(doc_id);
  if (!doc) return { error: `Document "${doc_id}" not found. Available: ${listDocuments().join(', ')}` };
  const classification = readJSON('policy.json').document_classification?.[doc.id] || 'unclassified';
  return { doc_id: doc.id, classification, content: doc.content };
}

function send_email({ to, subject = '', body = '' }, ctx) {
  const outbox = readJSON('outbox.json');
  const email = {
    id: `MAIL-${String(outbox.length + 1).padStart(4, '0')}`,
    ts: new Date().toISOString(),
    from: ctx.user.email,
    to: String(to),
    subject: String(subject),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
  outbox.push(email);
  writeJSON('outbox.json', outbox);
  return { ok: true, message: `Email ${email.id} queued to ${email.to} (sandbox outbox, not really sent)` };
}

function issue_refund({ order_id, amount }) {
  const orders = readJSON('orders.json');
  const id = String(order_id).replace(/^#?(ord-)?/i, '');
  const order = orders.find((o) => o.order_id === id);
  const amt = Number(amount);
  if (!order) return { error: `Order ${order_id} not found` };
  if (!(amt > 0)) return { error: 'Refund amount must be a positive number' };
  if (order.refunded_amount + amt > order.amount) {
    return { error: `Refund exceeds order value (order Rs ${order.amount}, already refunded Rs ${order.refunded_amount})` };
  }
  order.refunded_amount += amt;
  order.status = 'refunded';
  writeJSON('orders.json', orders);
  return { ok: true, order_id: id, refunded: amt, message: `Refund of Rs ${amt} issued for order ${id}` };
}

function delete_record({ type, id }) {
  if (!RECORD_TYPES.includes(type)) return { error: `Unknown record type "${type}"` };
  const rows = readJSON(`${type}.json`);
  const row = rows.find((r) => String(idOf(type, r)).toLowerCase() === String(id).toLowerCase());
  if (!row || row.deleted) return { error: `${type} record ${id} not found` };
  row.deleted = true; // soft delete
  writeJSON(`${type}.json`, rows);
  return { ok: true, message: `${type} record ${idOf(type, row)} deleted` };
}

// Never touches the network: maps the URL's last path segment to a canned page.
function fetch_url({ url }) {
  const pages = fs.readdirSync(WEB_DIR);
  let name = '';
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    name = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
  } catch {
    name = String(url);
  }
  name = name.toLowerCase().replace(/\.html?$/, '').replace(/-/g, '_');
  const page = pages.find((p) => p.replace(/\.html$/, '') === name);
  if (!page) return { url, status: 404, content: `No page found. Known pages: ${pages.join(', ')}` };
  return { url, status: 200, content: fs.readFileSync(path.join(WEB_DIR, page), 'utf8') };
}

function export_data({ type }) {
  if (!RECORD_TYPES.includes(type)) return { error: `Unknown record type "${type}"` };
  const rows = readJSON(`${type}.json`).filter((r) => !r.deleted);
  const cols = Object.keys(rows[0] || {});
  const cell = (v) => `"${String(Array.isArray(v) ? v.join(' ') : v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const file = `${type}-${Date.now()}.csv`;
  fs.writeFileSync(path.join(EXPORTS_DIR, file), csv);
  return { ok: true, file: `exports/${file}`, rows: rows.length };
}

const impl = { search_records, read_document, send_email, issue_refund, delete_record, fetch_url, export_data };

// ctx = { user } - the server-side user object (never from message text)
export function runTool(name, args, ctx) {
  const fn = impl[name];
  if (!fn) return { error: `Unknown tool "${name}"` };
  try {
    return fn(args || {}, ctx);
  } catch (e) {
    return { error: `Tool ${name} failed: ${e.message}` };
  }
}
