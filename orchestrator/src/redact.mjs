const secretKey = /(api[_-]?key|token|password|secret|cookie|authorization|service[_-]?role|supabase|stripe|resend|webhook)/i;
const bearer = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const knownSecret = /\b(?:sk(?:-ant)?|sk_live|sk_test|xox[baprs]|gh[pousr]|whsec|re)[-_][A-Za-z0-9_-]{8,}\b|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const assignment = /((?:["']?(?:api[_-]?key|token|password|secret|cookie|authorization|service[_-]?role|supabase|stripe|resend|webhook)["']?)\s*[:=]\s*["']?)([^"'\s,}]+)/gi;

export function redact(value) {
  if (typeof value === 'string') return value.replace(bearer, 'Bearer [REDACTED]').replace(knownSecret, '[REDACTED]');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? '[REDACTED]' : redact(item)]));
  }
  return value;
}

export function redactText(text) {
  return redact(String(text)).replace(assignment, '$1[REDACTED]');
}
