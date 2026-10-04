'use client';

import { memo } from 'react';
import Icon from './Icon';

type Option = { value: string; label: string };
type CustomSelectProps = { id?: string; options: Option[]; value: string; onChange: (value: string) => void; placeholder: string };

// A native select supplies keyboard, touch, and screen-reader behavior without
// global listeners or another menu implementation to keep in sync.
function CustomSelect({ id, options, value, onChange, placeholder }: CustomSelectProps) {
    return <div className="relative">
        <select id={id} aria-label={id ? undefined : placeholder} value={value} onChange={event => onChange(event.target.value)} className="w-full appearance-none p-3 pr-10 rounded-md bg-[#253325] border border-white/20 text-white focus:ring-2 focus:ring-primary cursor-pointer">
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Icon name="chevron" className="pointer-events-none absolute right-3 top-3" />
    </div>;
}

export default memo(CustomSelect);
