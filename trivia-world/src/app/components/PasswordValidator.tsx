'use client';

import { useMemo } from 'react';

const PasswordValidator = ({ password }: { password: string }) => {
    const criteria = useMemo(() => {
        return [
            { label: 'At least 8 characters', pattern: /.{8,}/ },
            { label: 'At least one uppercase letter', pattern: /[A-Z]/ },
            { label: 'At least one lowercase letter', pattern: /[a-z]/ },
            { label: 'At least one number', pattern: /[0-9]/ },
            { label: 'At least one special character', pattern: /[!@#$%^&*(),.?":{}|<>]/ },
        ];
    }, []);

    return (
        <div className="my-4 text-sm text-white/70">
            {criteria.map((criterion, index) => {
                const isValid = criterion.pattern.test(password);
                return (
                    <div key={index} className={`transition-colors ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                        {isValid ? '✓' : '✗'} {criterion.label}
                    </div>
                );
            })}
        </div>
    );
};

export default PasswordValidator;
