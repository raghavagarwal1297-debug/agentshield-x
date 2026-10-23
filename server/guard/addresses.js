// Strict email-address parsing for allowlist checks (v2 fix #9).
// Exact domain match only: "nimbusretail.in.evil.com", "a@nimbusretail.in@evil.com",
// lists of recipients and punycode / non-ASCII lookalikes are all rejected.

// Returns the lowercase domain of ONE plain address, or null if it is not a
// single well-formed ASCII address. Accepts "Name <user@domain>".
export function emailDomain(raw) {
  if (typeof raw !== 'string') return null;
  let addr = raw.trim();
  const angle = addr.match(/^[^<>@]*<([^<>]+)>$/);
  if (angle) addr = angle[1].trim();
  addr = addr.toLowerCase();
  if (/[\s,;<>()"']/.test(addr)) return null;          // several recipients or junk
  if (/[^\x21-\x7e]/.test(addr)) return null;          // non-ASCII lookalike letters
  const parts = addr.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const domain = parts[1].replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return null;
  if (domain.split('.').some((label) => label.startsWith('xn--'))) return null; // punycode
  return domain;
}

export function isAllowedEmail(raw, allowedDomains = []) {
  const domain = emailDomain(raw);
  return !!domain && allowedDomains.map((d) => d.toLowerCase()).includes(domain);
}

// Host of a URL (lowercase), or null if it cannot be parsed.
export function urlHost(raw) {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

export function isAllowedUrl(raw, allowedDomains = []) {
  const host = urlHost(raw);
  if (!host || host.split('.').some((l) => l.startsWith('xn--'))) return false;
  return allowedDomains.map((d) => d.toLowerCase()).includes(host);
}
