import Image from 'next/image';
import CustomSelect from '../components/CustomSelect';
import { categoryOptions } from '@/lib/categories';

type Props = { name: string; avatar: string | null; signedIn: boolean; onProfile: () => void; onLogin: () => void; onHome: () => void; onStart: () => void; category: string; setCategory: (value: string) => void; difficulty: string; setDifficulty: (value: string) => void };

export default function SoloSetup({ name, avatar, signedIn, onProfile, onLogin, onHome, onStart, category, setCategory, difficulty, setDifficulty }: Props) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#101710] px-4 pb-8 pt-20 sm:px-6 text-white">
            <div className="absolute top-4 right-4">
                {signedIn ? (
                    <button onClick={onProfile} className="bg-blue-800 hover:bg-blue-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                        Profile
                    </button>
                ) : (
                    <button onClick={onLogin} className="bg-green-800 hover:bg-green-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                        Login/Signup
                    </button>
                )}
            </div>
            <div className="flex flex-col items-center gap-3 mb-4 w-full">
                {avatar ? (
                    <div className="relative w-20 h-20 rounded-full overflow-hidden">
                        <Image src={avatar} alt="Player Avatar" fill sizes="80px" style={{ objectFit: 'cover' }} />
                    </div>
                ) : (
                    <div className="w-20 h-20 rounded-full bg-green-800 flex items-center justify-center text-3xl font-bold">{name?.charAt(0).toUpperCase()}</div>
                )}
                <h1 className="max-w-full break-words text-center text-3xl sm:text-4xl font-bold">Hi, {name}!</h1>
            </div>
            <p className="text-lg mb-6">Setup Your Solo Game</p>
            <div className="w-full max-w-md space-y-6">
                <div>
                    <label htmlFor="solo-category" className="block mb-2 font-bold">Category</label>
                    <CustomSelect id="solo-category" options={categoryOptions} value={category} onChange={setCategory} placeholder="Select a category..." />
                </div>
                <div>
                    <p className="block mb-2 font-bold">Difficulty</p>
                    <div className="grid grid-cols-2 gap-2">
                        {['Easy', 'Medium', 'Hard', 'Random'].map((diff) => {
                            const key = diff === 'Random' ? '' : diff.toLowerCase();
                            const isSelected = difficulty === key;
                            const selectedClass = isSelected
                                ? key === 'easy'
                                    ? 'bg-green-800'
                                    : key === 'medium'
                                    ? 'bg-yellow-500'
                                    : key === 'hard'
                                    ? 'bg-red-700'
                                    : 'bg-blue-700'
                                : 'bg-white/10 hover:bg-white/20';

                            return (
                                <button key={diff} onClick={() => setDifficulty(key)} className={`p-3 rounded-md transition-colors cursor-pointer ${selectedClass}`}>
                                    {diff}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={onHome} className="min-w-0 flex-1 h-14 rounded-md bg-gray-700 text-base sm:text-xl font-bold hover:bg-gray-800 cursor-pointer">
                        Home
                    </button>
                    <button onClick={onStart} className="min-w-0 flex-1 h-14 rounded-md bg-green-800 text-base sm:text-xl font-bold hover:bg-green-900 cursor-pointer">
                        Start Game
                    </button>
                </div>
            </div>
        </div>
    );
}
