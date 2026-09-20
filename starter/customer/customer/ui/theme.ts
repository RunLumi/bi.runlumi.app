/** Customer brand overrides are token-based and scoped. They must not use global
 * CSS overrides that change core accessibility, state semantics or layout contracts.
 * Only the CSS custom properties documented by DESIGN.md may be set here. */
const ALLOWED_TOKENS:Record<string,string>={'--primary':'#006093','--background':'#F4F0E8'};
export function applyBrandTokens(tokens:Record<string,string>=ALLOWED_TOKENS):void{
 if(typeof document==='undefined')return;
 for(const [token,value]of Object.entries(tokens)){
  if(!/^--[a-z-]+$/.test(token))throw new Error(`Brand token must be a CSS custom property: ${token}`);
  document.documentElement.style.setProperty(token,value);
 }
}
