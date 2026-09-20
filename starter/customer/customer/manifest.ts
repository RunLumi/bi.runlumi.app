/** Customer application identity and enabled modules.
 * Non-secret metadata only. Import this from both the worker and the browser
 * composition; it must never contain credentials, tokens or internal endpoints.
 * Server-only configuration lives in `infra/environments/<env>.json` and worker vars. */
export interface CustomerManifest {
  /** Stable, server-owned identity. Must match CUSTOMER_ID in the deployment env. */
  customerId: string;
  displayName: string;
  /** Default locale/currency/timezone for presentation. Financial rules stay in core. */
  locale: 'vi-VN' | 'en-US';
  currency: 'VND' | 'USD';
  timezone: string;
  /** Supported product modules. Reserved module IDs cannot be redefined. */
  modules: ('commerce' | 'operations' | 'ai')[];
  /** Custom metric/rule extension namespaces, reviewed and versioned. */
  extensions: { namespace: string; version: string }[];
  brand: { logoSrc: string; logoAlt: string };
}

export const manifest: CustomerManifest = {
  customerId: '__CUSTOMER_ID__',
  displayName: '__DISPLAY_NAME__',
  locale: 'vi-VN',
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  modules: ['commerce', 'operations'],
  extensions: [{ namespace: 'customer', version: '1.0.0' }],
  brand: { logoSrc: '/brand/customer-logo.svg', logoAlt: '' }
};

/** Reserved route prefixes and metric IDs owned by the shared core.
 * Customer pages and metrics cannot silently replace these. */
export const RESERVED_ROUTES = ['/', '/money', '/commerce-data', '/operations', '/configuration', '/control'] as const;
export const RESERVED_METRIC_NAMESPACES = ['lumi', 'commerce'] as const;
