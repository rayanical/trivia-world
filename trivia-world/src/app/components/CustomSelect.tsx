'use client';

import { useState, useRef, useEffect, memo } from 'react';

type Option = { value: string; label: string };
type CustomSelectProps = { options: Option[]; value: string; onChange: (value: string) => void; placeholder: string };

/**
 * Displays a stylized dropdown select component with custom theming.
 * @param props - List of selectable options, the current value, and callbacks.
 * @returns A toggleable dropdown menu for choosing an option.
 */
function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);
    const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={selectRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-3 flex justify-between items-center rounded-md bg-white/10 border border-white/20 focus:ring-2 focus:ring-primary cursor-pointer"
            >
                <span className={value ? 'text-white' : 'text-gray-400'}>{selectedLabel}</span>
                <span className={`material-symbols-outlined transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full mt-2 max-h-60 overflow-y-auto rounded-md bg-[#253325] border border-border-color shadow-lg">
                    {options.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className="px-4 py-3 text-white cursor-pointer hover:bg-green-800 transition-colors "
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default memo(CustomSelect);
