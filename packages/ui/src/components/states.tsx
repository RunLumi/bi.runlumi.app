import {Button} from './ui/button.tsx';import {message} from '../lib/api.ts';
export function Loading(){return <div className="state" role="status">Đang kiểm tra quyền và tải dữ liệu…</div>;}
export function ErrorState({error,retry}:{error:unknown;retry?:()=>void}){return <div className="state" role="alert"><p>{message(error)}</p>{retry&&<Button variant="outline" onClick={retry}>Thử lại</Button>}</div>;}
export function Empty({children}:{children:React.ReactNode}){return <div className="state">{children}</div>;}
