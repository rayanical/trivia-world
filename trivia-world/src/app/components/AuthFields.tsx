'use client';
import PasswordValidator from './PasswordValidator';
import type { useAuthForm } from '@/hooks/useAuthForm';
type Props = Pick<ReturnType<typeof useAuthForm>, 'email' | 'setEmail' | 'password' | 'setPassword' | 'username' | 'setUsername' | 'isSignup' | 'isResetting'>;
export default function AuthFields({ email, setEmail, password, setPassword, username, setUsername, isSignup, isResetting }: Props) {
    return <>
                <label htmlFor="auth-email" className="block mb-2 text-white">Email</label>
                <input
                    id="auth-email" name="email" autoComplete="email" required
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                />
                {!isResetting && <><label htmlFor="auth-password" className="block mb-2 text-white">Password</label><input
                    id="auth-password" name="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required
                    type="password"
                    placeholder={isSignup ? 'Password (min 8 chars, 1 upper, 1 number, 1 special)' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                /></>}
                {isSignup && <PasswordValidator password={password} />}

                {isSignup && (
                    <><label htmlFor="auth-username" className="block mb-2 text-white">Username</label><input
                        id="auth-username" name="username" autoComplete="nickname" required
                        type="text"
                        placeholder="Username (3-15 characters)"
                        value={username}
                        maxLength={15}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                    /></>
                )}
    </>;
}
