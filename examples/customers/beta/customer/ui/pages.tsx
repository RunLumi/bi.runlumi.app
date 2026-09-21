import type {AppPage} from '@runlumi/ui/app.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';

/** Beta: a different page from Alpha over the same packaged core. */
function BetaPlaybook({user}:{user:InstallationUser}){
 return <div className="page-title"><div><p className="eyebrow">BETA EXTENSION</p><h1>Beta playbook</h1><p>Beta ships a different customer page over the same core release.</p></div>
  <Card><CardHeader><CardTitle>Escalation path</CardTitle></CardHeader><CardContent>
   <p className="metric-definition">Beta routes any negative-contribution finding to the on-call owner. Current viewer: {user.displayName||user.name}.</p>
  </CardContent></Card></div>;
}
export const customerPages:AppPage[]=[
 {path:'/customer-note',label:'Beta playbook',nav:({user})=>!!user,render:({user})=>user?<BetaPlaybook user={user}/>:null}
];
