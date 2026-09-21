import type {AppPage} from '@runlumi/ui/app.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';

/** Alpha: a distinct customer page proving composition from the packaged core. */
function AlphaBriefing({user}:{user:InstallationUser}){
 return <div className="page-title"><div><p className="eyebrow">ALPHA EXTENSION</p><h1>Alpha briefing</h1><p>Alpha's own page, composed from the packaged core UI without touching its internals.</p></div>
  <Card><CardHeader><CardTitle>Operating rhythm</CardTitle></CardHeader><CardContent>
   <p className="metric-definition">Alpha reviews commerce findings every Monday and operational cost monthly. Signed in as {user.displayName||user.name} ({user.role}).</p>
  </CardContent></Card></div>;
}
export const customerPages:AppPage[]=[
 {path:'/customer-note',label:'Alpha briefing',nav:({user})=>!!user,render:({user})=>user?<AlphaBriefing user={user}/>:null}
];
