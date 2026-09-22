import {useEffect,useId,useState} from 'react';
import {NavLink,useLocation} from 'react-router-dom';
import {IconChevronDown} from '@tabler/icons-react';
import type {AppPage} from '../app.tsx';
import {Button} from './ui/button.tsx';

/** Ordered customer-owned groups. Unassigned pages remain direct links.
 * Visibility always comes from the page's existing nav predicate. */
export interface AppNavGroup {id:string;label:string;paths:string[]}

function NavigationGroup({group,pages}:{group:AppNavGroup;pages:AppPage[]}){
 const {pathname}=useLocation();
 const active=pages.some(page=>pathname===page.path||page.path!=='/'&&pathname.startsWith(`${page.path}/`));
 const [open,setOpen]=useState(active);
 const id=useId();
 useEffect(()=>{if(active)setOpen(true);},[pathname,active]);
 return <div className="min-w-0">
  <Button variant="ghost" className={`h-auto min-h-10 w-full justify-between whitespace-normal px-3 py-2.5 text-left ${active?'text-primary':''}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
   <span>{group.label}</span><IconChevronDown aria-hidden="true" className={`size-4 shrink-0 ${open?'rotate-180':''}`}/>
  </Button>
  <div id={id} hidden={!open}>
   <ul className="ml-3 grid list-none gap-1 border-l border-border pl-2">
    {pages.map(page=><li key={page.path}><NavLink to={page.path} end={page.path==='/'}>{page.label}</NavLink></li>)}
   </ul>
  </div>
 </div>;
}

export function AppNavigation({pages,groups=[],label}:{pages:AppPage[];groups?:AppNavGroup[];label:string}){
 // Preserve the existing flat layout for installations without groups.
 if(groups.length===0)return <nav aria-label={label}>{pages.map(page=><NavLink key={page.path} to={page.path} end={page.path==='/'}>{page.glyph?<page.glyph/>:null}{page.label}</NavLink>)}</nav>;
 // First assignment wins; a page is never duplicated across groups.
 const assigned=new Set<string>();
 const sections=groups.map(group=>({group,pages:group.paths.flatMap(path=>{
  const page=pages.find(candidate=>candidate.path===path);
  if(!page||assigned.has(path))return [];
  assigned.add(path);return [page];
 })})).filter(section=>section.pages.length>0);
 return <nav aria-label={label} className="!block min-h-0 overflow-y-auto">
  <ul className="grid list-none gap-1">
   {pages.filter(page=>!assigned.has(page.path)).map(page=><li key={page.path}><NavLink to={page.path} end={page.path==='/'}>{page.glyph?<page.glyph/>:null}{page.label}</NavLink></li>)}
   {sections.map(({group,pages})=><li key={group.id}><NavigationGroup group={group} pages={pages}/></li>)}
  </ul>
 </nav>;
}
