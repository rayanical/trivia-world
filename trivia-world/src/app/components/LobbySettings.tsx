'use client';
import CustomSelect from './CustomSelect';
import { categoryOptions } from '@/lib/categories';
type Props = { category: string; setCategory: (value: string) => void; difficulty: string; setDifficulty: (value: string) => void; amount: string; setAmount: (value: string) => void; isTimeLimitEnabled: boolean; setIsTimeLimitEnabled: (value: boolean) => void; timeLimit: string; setTimeLimit: (value: string) => void };
export default function LobbySettings({ category, setCategory, difficulty, setDifficulty, amount, setAmount, isTimeLimitEnabled, setIsTimeLimitEnabled, timeLimit, setTimeLimit }: Props) {
return <>
                                <div>
                                    <label htmlFor="lobby-category" className="block mb-2 font-bold">Category</label>
                                    <CustomSelect
                                        id="lobby-category"
                                        options={categoryOptions}
                                        value={category}
                                        onChange={setCategory}
                                        placeholder="Select a category..."
                                    />
                                </div>
                                <div>
                                    <p className="block mb-2 font-bold">Difficulty</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { key: 'easy', label: 'Easy' },
                                            { key: 'medium', label: 'Medium' },
                                            { key: 'hard', label: 'Hard' },
                                            { key: '', label: 'Random' },
                                        ].map(({ key, label }) => {
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
                                                <button key={key} onClick={() => setDifficulty(key)} className={`p-3 rounded-md transition-colors cursor-pointer ${selectedClass}`}>
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="question-count" className="block mb-2 font-bold">Questions</label>
                                    <input
                                        id="question-count" min={1} max={50} step={1}
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full p-2 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="time-limit" className="block mb-2 font-bold">Time Limit (seconds)</label>
                                    <div className="flex items-center gap-4 mb-2">
                                        <label htmlFor="enable-timer">Enable Time Limit</label>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input id="enable-timer" aria-label="Enable Time Limit" type="checkbox" checked={isTimeLimitEnabled} onChange={(e) => setIsTimeLimitEnabled(e.target.checked)} className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-transform dark:border-gray-600 peer-checked:bg-green-600"></div>
                                        </div>
                                    </div>
                                    {isTimeLimitEnabled && (
                                        <input
                                            id="time-limit"
                                            type="number"
                                            value={timeLimit}
                                            min={5}
                                            max={120}
                                            onChange={(e) => setTimeLimit(e.target.value)}
                                            className="w-full p-2 rounded-md bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-green-800 cursor-pointer"
                                        />
                                    )}
                                </div>

</>;
}
