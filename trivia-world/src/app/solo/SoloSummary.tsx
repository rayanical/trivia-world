'use client';
import SoloSaveStatus from '../components/SoloSaveStatus';
type Props = { score: number; signedIn: boolean; onProfile: () => void; onHome: () => void; onLogin: () => void; resetGame: () => void };
export default function SoloSummary({ score, signedIn, onProfile, onHome, onLogin, resetGame }: Props) {
return (
                <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#1A201A] px-4 pb-8 pt-20 sm:px-6 text-white">
                    <div className="absolute top-4 right-4">
                        {signedIn ? (
                            <button onClick={() => onProfile()} className="bg-blue-800 hover:bg-blue-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                                Profile
                            </button>
                        ) : (
                            <button onClick={() => onLogin()} className="bg-green-800 hover:bg-green-900 p-2 rounded-md text-white cursor-pointer transition-colors">
                                Login/Signup
                            </button>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold">Game Over!</h1>
                    <p className="text-2xl mt-4">Correct Answers:</p>
                    <p className="text-6xl font-bold text-green-800 my-8">{score}</p>
                    <SoloSaveStatus />
                    <div className="flex w-full max-w-sm gap-3">
                        <button onClick={() => onHome()} className="min-w-0 flex-1 rounded-full bg-gray-700 hover:bg-gray-800 px-3 py-3 text-base sm:text-lg font-bold cursor-pointer">
                            Home
                        </button>
                        <button onClick={resetGame} className="min-w-0 flex-1 rounded-full bg-green-800 hover:bg-green-900 px-3 py-3 text-base sm:text-lg font-bold cursor-pointer">
                            Play Again
                        </button>
                    </div>
                </div>
);
}
