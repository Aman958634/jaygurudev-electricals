function integerSetting(value, name) {
  if (!/^(?:0|[1-9]\d*)$/.test(String(value))) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return Number(value);
}

// Production is one Nginx hop away from this process. Do not trust arbitrary
// forwarded headers unless the backend is bound to loopback/firewalled as below.
export function trustProxyHops(env = process.env) {
  if (env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === '') {
    return env.NODE_ENV === 'production' ? 1 : false;
  }
  return integerSetting(env.TRUST_PROXY_HOPS, 'TRUST_PROXY_HOPS');
}

export function backendBindHost(env = process.env) {
  if (env.BIND_HOST) return env.BIND_HOST;
  return env.NODE_ENV === 'production' ? '127.0.0.1' : undefined;
}
