/** Replace only the renderer for the already-registered core home route.
 * Customer pages remain unable to claim or duplicate the reserved `/` path. */
export function withDashboardPage<P extends {path:string;render:unknown}>(pages:readonly P[],dashboardPage:P['render']):P[]{
 const rootPages=pages.filter(page=>page.path==='/');
 if(rootPages.length!==1)throw new Error('DASHBOARD_ROUTE_REQUIRED');
 return pages.map(page=>page.path==='/'?{...page,render:dashboardPage} as P:page);
}
