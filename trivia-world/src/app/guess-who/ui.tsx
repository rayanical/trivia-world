import type { ComponentProps } from 'react';
export const panelClass = 'rounded-xl border border-blue-300/15 bg-[#16263f] p-4 sm:p-6';
export const inputClass = 'w-full min-w-0 rounded-md border border-blue-200/20 bg-white/5 p-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300';
export function GuessButton({ className = '', secondary = false, type = 'button', ...props }: ComponentProps<'button'> & { secondary?: boolean }) {
    return <button type={type} {...props} className={`min-h-11 rounded-md px-4 py-2 font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200 disabled:opacity-50 disabled:cursor-not-allowed ${secondary ? 'bg-white/10 hover:bg-white/20' : 'bg-blue-700 hover:bg-blue-800'} ${className}`} />;
}
