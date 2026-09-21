import type {AppPage} from '@runlumi/ui/app.tsx';
import {manifest} from '../manifest.ts';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';

/** Customer-owned pages composed with the core application shell.
 * These are reviewed code in YOUR repository: they may use the public UI
 * package components and the session-scoped /api endpoints, but must not
 * import core internals. Reserved paths (/, /operations, /admin, ...) cannot
 * be shadowed. */
function MetricsNote({user}:{user:InstallationUser}){
 return <div className="page-title"><div><p className="eyebrow">CUSTOMER EXTENSION</p><h1>{manifest.displayName} metrics note</h1><p>This page ships in the customer repository, not in the core package.</p></div>
  <Card><CardHeader><CardTitle>Custom metric: example hours saved</CardTitle></CardHeader><CardContent>
   <p className="metric-definition">Served by the customer server extension under <code>/api/custom-metrics/customer.example_hours_saved</code>. Unavailable data stays unavailable.</p>
  </CardContent></Card></div>;
}

export const customerPages:AppPage[]=[
 {path:'/customer-note',label:'Customer note',nav:({user})=>!!user,render:({user})=>user?<MetricsNote user={user}/>:null}
];