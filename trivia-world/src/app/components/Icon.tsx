import type { SVGProps } from 'react';

const paths = {
    home: 'm3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
    person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    groups: 'M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-2a8 8 0 0 1 16 0v2M18 4a4 4 0 0 1 0 8m3 9v-2a8 8 0 0 0-3-6',
    chevron: 'm6 9 6 6 6-6',
};

export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
