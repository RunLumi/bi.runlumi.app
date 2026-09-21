/** Coordinated release version of the initial core packages. Recorded in lumi.lock.json. */
export const LUMI_CORE_VERSION = '0.1.0';
/** Extension API contract version. Customer code compiles against this surface;
 * a breaking change bumps the major and requires a documented migration. */
export const LUMI_EXTENSION_API = 1;
/** Control plane interface version. Cells and dedicated deployments declare the
 * interface they were built against when calling Control; Control refuses scopes
 * registered for a different interface version (fail closed on contract drift). */
export const LUMI_CONTROL_API = 1;
