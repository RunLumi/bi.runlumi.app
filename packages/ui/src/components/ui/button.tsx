// Adapted from shadcn/ui (MIT). See THIRD_PARTY_NOTICES.md and public/licenses/shadcn-ui.txt.
import type {ComponentProps} from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva,type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/utils.ts';
const variants=cva('inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',{
 variants:{variant:{default:'bg-primary text-primary-foreground hover:bg-primary/90',outline:'border border-border bg-card text-foreground hover:bg-accent',ghost:'text-muted-foreground hover:bg-accent hover:text-foreground'},size:{default:'h-10 px-4',sm:'h-8 px-3 text-xs',icon:'size-10'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,type='button',...props}:ComponentProps<'button'>&VariantProps<typeof variants>&{asChild?:boolean}){
 const Comp=asChild?Slot:'button';return <Comp data-slot="button" type={asChild?undefined:type} className={cn(variants({variant,size}),className)} {...props}/>;
}
