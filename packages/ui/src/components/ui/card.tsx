import type {ComponentProps} from 'react';
import {cn} from '../../lib/utils.ts';

type CardProps=ComponentProps<'section'>&{size?:'default'|'sm'};

export function Card({className,size='default',...props}:CardProps){
 return <section data-slot="card" data-size={size} className={cn('group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg border border-border bg-card py-(--card-spacing) text-card-foreground shadow-sm [--card-spacing:--spacing(5)] data-[size=sm]:[--card-spacing:--spacing(3)]',className)} {...props}/>;
}
export function CardHeader({className,...props}:ComponentProps<'div'>){
 return <div data-slot="card-header" className={cn('group/card-header @container/card-header grid auto-rows-min items-start gap-1 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',className)} {...props}/>;
}
export function CardTitle({className,...props}:ComponentProps<'h2'>){
 return <h2 data-slot="card-title" className={cn('text-base font-semibold leading-none tracking-tight',className)} {...props}/>;
}
export function CardDescription({className,...props}:ComponentProps<'p'>){
 return <p data-slot="card-description" className={cn('text-sm text-muted-foreground',className)} {...props}/>;
}
export function CardAction({className,...props}:ComponentProps<'div'>){
 return <div data-slot="card-action" className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end',className)} {...props}/>;
}
export function CardContent({className,...props}:ComponentProps<'div'>){
 return <div data-slot="card-content" className={cn('px-(--card-spacing)',className)} {...props}/>;
}
export function CardFooter({className,...props}:ComponentProps<'div'>){
 return <div data-slot="card-footer" className={cn('flex items-center gap-2 border-t border-border px-(--card-spacing) py-(--card-spacing)',className)} {...props}/>;
}
