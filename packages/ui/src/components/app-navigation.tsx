import {useEffect,useId,useState} from 'react';
import {NavLink,useLocation} from 'react-router-dom';
import {IconChevronDown,IconFileText,IconLayoutGrid} from '@tabler/icons-react';
import type {AppPage} from '../app.tsx';
import {Button} from './ui/button.tsx';

/** Ordered customer-owned groups. Unassigned pages remain direct links.
 * Visibility always comes from the page's existing nav predicate. */
export interface AppNavGroup {id:string;label:string;paths:string[]}

function NavigationGroup({group,pages,onNavigate}:{group:AppNavGroup;pages:AppPage[];onNavigate:(()=>void)|undefined}){
 const {pathname}=useLocation();
 const active=pages.some(page=>pathname===page.path||page.path!=='/'&&pathname.startsWith(`${page.path}/`));
 const [open,setOpen]=useState(active);
 const id=useId();
 useEffect(()=>{if(active)setOpen(true);},[pathname,active]);
 return <div className="min-w-0">
  <Button variant="ghost" className={`h-auto min-h-10 w-full justify-between whitespace-normal px-3 py-2.5 text-left ${active?'text-primary':''}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
   <IconLayoutGrid aria-hidden="true" className="sidebar-nav-icon"/><span className="nav-label">{group.label}</span><IconChevronDown aria-hidden="true" className={`sidebar-group-chevron size-4 shrink-0 ${open?'rotate-180':''}`}/>
  </Button>
  <div id={id} hidden={!open}>
   <ul className="sidebar-group-pages ml-3 grid list-none gap-1 border-l border-border pl-2">
    {pages.map(page=><li key={page.path}><NavLink title={page.label} to={page.path} end={page.path==='/'} onClick={onNavigate}><span className="sidebar-nav-icon" aria-hidden="true">{page.glyph?<page.glyph/>:<IconFileText/>}</span><span className="nav-label">{page.label}</span></NavLink></li>)}
   </ul>
  </div>
 </div>;
}

export function AppNavigation({pages,groups=[],label,onNavigate}:{pages:AppPage[];groups?:AppNavGroup[];label:string;onNavigate?:()=>void}){
 // Preserve the existing flat layout for installations without groups.
 if(groups.length===0)return <nav id="primary-navigation" aria-label={label}>{pages.map(page=><NavLink key={page.path} title={page.label} to={page.path} end={page.path==='/'} onClick={onNavigate}><span className="sidebar-nav-icon" aria-hidden="true">{page.glyph?<page.glyph/>:<IconFileText/>}</span><span className="nav-label">{page.label}</span></NavLink>)}</nav>;
 // First assignment wins; a page is never duplicated across groups.
 const assigned=new Set<string>();
 const sections=groups.map(group=>({group,pages:group.paths.flatMap(path=>{
  const page=pages.find(candidate=>candidate.path===path);
  if(!page||assigned.has(path))return [];
  assigned.add(path);return [page];
 })})).filter(section=>section.pages.length>0);
 return <nav id="primary-navigation" aria-label={label} className="!block min-h-0 overflow-y-auto">
  <ul className="grid list-none gap-1">
   {pages.filter(page=>!assigned.has(page.path)).map(page=><li key={page.path}><NavLink title={page.label} to={page.path} end={page.path==='/'} onClick={onNavigate}><span className="sidebar-nav-icon" aria-hidden="true">{page.glyph?<page.glyph/>:<IconFileText/>}</span><span className="nav-label">{page.label}</span></NavLink></li>)}
   {sections.map(({group,pages})=><li key={group.id}><NavigationGroup group={group} pages={pages} onNavigate={onNavigate}/></li>)}
  </ul>
 </nav>;
}
