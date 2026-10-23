// Validation for PUT /api/policy. Returns a list of problems (empty = valid).
import { TOOL_NAMES } from '../agent/tools.js';

const isStrArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function validatePolicy(p) {
  const errors = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['policy must be a JSON object'];

  if (!p.roles || typeof p.roles !== 'object') errors.push('"roles" object is required');
  for (const [role, cfg] of Object.entries(p.roles || {})) {
    if (!isStrArray(cfg?.tools)) { errors.push(`roles.${role}.tools must be an array of tool names`); continue; }
    for (const t of cfg.tools) if (t !== '*' && !TOOL_NAMES.includes(t)) errors.push(`roles.${role}.tools: unknown tool "${t}"`);
    for (const [type, fields] of Object.entries(cfg.data || {})) {
      if (!isStrArray(fields)) errors.push(`roles.${role}.data.${type} must be an array of field names`);
    }
    for (const [k, v] of Object.entries(cfg.limits || {})) {
      if (!Number.isInteger(v) || v < 0) errors.push(`roles.${role}.limits.${k} must be a whole number >= 0`);
    }
  }
  for (const role of ['admin', 'hr', 'intern']) if (!p.roles?.[role]) errors.push(`role "${role}" is required (users.json uses it)`);

  if (!Array.isArray(p.approval_required)) errors.push('"approval_required" must be an array');
  for (const [i, r] of (p.approval_required || []).entries()) {
    if (!TOOL_NAMES.includes(r?.tool)) errors.push(`approval_required[${i}].tool must be a known tool`);
    if (r?.when !== undefined && !/^\s*\w+\s*(>=|<=|>|<|==)\s*[\d.]+\s*$/.test(String(r.when))) {
      errors.push(`approval_required[${i}].when must look like "amount > 10000"`);
    }
  }

  for (const k of ['email_domains_allowed', 'url_domains_allowed']) {
    if (!isStrArray(p.egress?.[k])) errors.push(`egress.${k} must be an array of domains`);
  }

  const t = p.thresholds || {};
  if (!(Number.isFinite(t.warn) && Number.isFinite(t.block) && t.warn >= 0 && t.block <= 100 && t.warn < t.block)) {
    errors.push('thresholds must be numbers with 0 <= warn < block <= 100');
  }

  if (p.document_classification && typeof p.document_classification !== 'object') errors.push('document_classification must be an object');
  if (p.redaction?.roles) {
    for (const [role, list] of Object.entries(p.redaction.roles)) {
      if (!isStrArray(list)) errors.push(`redaction.roles.${role} must be an array like ["customers.phone", "secrets"]`);
    }
  }
  return errors;
}
