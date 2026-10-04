'use client';
import type { SoloQuestion } from '@/hooks/useSoloGame';
import { formatCategory } from '@/lib/categories';
function answerClass(answer: string, selected: string | null, correct: string | undefined, answered: boolean) {
    if (!answered) return answer === selected ? 'border-blue-400 bg-blue-900' : 'border-[#3C4F3C] bg-[#1A201A] hover:bg-[#253325] hover:border-primary';
    if (answer === correct) return 'border-green-500 bg-green-900';
    if (answer === selected) return 'border-red-500 bg-red-900';
    return 'border-[#3C4F3C] bg-[#1A201A]';
}

type Props = { question: SoloQuestion; questionNumber: number; selectedAnswer: string | null; isAnswered: boolean; isSubmitting: boolean; submitAnswer: (answer: string) => void; nextQuestion: () => void };
export default function SoloQuestionCard({ question, questionNumber, selectedAnswer, isAnswered, isSubmitting, submitAnswer, nextQuestion }: Props) {
return (
<div className="flex flex-col gap-6 rounded-xl bg-[#253325] p-4 sm:p-6 shadow-lg">
                                <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-xs sm:text-base text-gray-400">
                                    <span>Question {questionNumber}</span>
                                    <span className="capitalize">Category: {formatCategory(question.category)}</span>
                                    <span className="capitalize">
                                        Difficulty:{' '}
                                        <span
                                            className={`font-bold ${
                                                question.difficulty === 'easy' ? 'text-green-600' : question.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'
                                            }`}
                                        >
                                            {question.difficulty}
                                        </span>
                                    </span>
                                </div>
                                <h2 className="break-words text-center text-lg sm:text-xl md:text-2xl font-bold text-white">{question.question}</h2>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {question.all_answers.map((answer) => (
                                        <button
                                            key={answer}
                                            onClick={() => submitAnswer(answer)}
                                            className={`flex w-full items-center gap-4 rounded-lg border-2 p-3 sm:p-4 text-left transition-colors ${answerClass(answer, selectedAnswer, question.correct_answer, isAnswered)} ${
                                                !isAnswered ? 'cursor-pointer' : 'cursor'
                                            }`}
                                            disabled={isAnswered || isSubmitting}
                                        >
                                            <span className="min-w-0 break-words text-base font-medium text-white">{answer}</span>
                                        </button>
                                    ))}
                                </div>

                                {isSubmitting && <p role="status" className="text-center text-white/70">Checking your answer…</p>}
                                {isAnswered && (
                                    <div className="flex justify-center pt-2">
                                        <button
                                            onClick={nextQuestion}
                                            className="h-12 min-w-[160px] rounded-full bg-green-800 hover:bg-green-900 px-6 text-lg font-bold text-white hover:scale-105 cursor-pointer"
                                        >
                                            Next Question
                                        </button>
                                    </div>
                                )}
                            </div>
);
}
