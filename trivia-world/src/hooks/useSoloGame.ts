'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, jsonBody } from '@/lib/api';
import { useAlert } from '@/context/AlertContext';

export type SoloQuestion = {
    id: string;
    token?: string;
    question: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
    correct_answer?: string;
    all_answers: string[];
};

export function useSoloGame(category: string, difficulty: string) {
    const { showAlert } = useAlert();
    const [questions, setQuestions] = useState<SoloQuestion[]>([]);
    const [phase, setPhase] = useState<'setup' | 'playing' | 'ended'>('setup');
    const [questionNumber, setQuestionNumber] = useState(1);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const questionRequest = useRef<AbortController | null>(null);
    const answerRequest = useRef<AbortController | null>(null);
    const answeredId = useRef<string | null>(null);
    const active = useRef(false);
    const currentQuestion = questions[0];

    const cancelRequests = useCallback(() => {
        questionRequest.current?.abort();
        answerRequest.current?.abort();
        questionRequest.current = null;
        answerRequest.current = null;
    }, []);
    useEffect(() => cancelRequests, [cancelRequests]);

    const fetchQuestions = useCallback(async () => {
        if (questionRequest.current) return;
        const controller = new AbortController();
        questionRequest.current = controller;
        setIsLoading(true);
        try {
            const data = await api<SoloQuestion[]>('/solo/questions', { ...jsonBody({ category: category || undefined, difficulty: difficulty || undefined }), signal: controller.signal });
            if (!controller.signal.aborted) setQuestions(previous => [...previous, ...data]);
        } catch (error) {
            if (!controller.signal.aborted) showAlert(error instanceof Error ? error.message : 'Could not load questions.');
        } finally {
            if (questionRequest.current === controller) {
                questionRequest.current = null;
                setIsLoading(false);
            }
        }
    }, [category, difficulty, showAlert]);

    const startGame = () => {
        if (active.current) return;
        active.current = true;
        cancelRequests();
        answeredId.current = null;
        setQuestions([]);
        setQuestionNumber(1);
        setScore(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsSubmitting(false);
        setPhase('playing');
        void fetchQuestions();
    };

    const nextQuestion = () => {
        // A synchronous guard also catches two clicks before React renders again.
        if (!currentQuestion || answeredId.current !== currentQuestion.id) return;
        answeredId.current = null;
        setQuestions(previous => previous.slice(1));
        setQuestionNumber(previous => previous + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        if (questions.length <= 4) void fetchQuestions();
    };

    const submitAnswer = async (answer: string) => {
        if (!currentQuestion || answerRequest.current || answeredId.current === currentQuestion.id) return;
        const controller = new AbortController();
        answerRequest.current = controller;
        setSelectedAnswer(answer);
        setIsSubmitting(true);
        try {
            const result = await api<{ correct: boolean; correctAnswer: string }>('/solo/answer', { ...jsonBody({ id: currentQuestion.id, token: currentQuestion.token, answer }), signal: controller.signal });
            if (controller.signal.aborted) return;
            answeredId.current = currentQuestion.id;
            setQuestions(previous => previous.map(question => question.id === currentQuestion.id ? { ...question, correct_answer: result.correctAnswer } : question));
            setIsAnswered(true);
            if (result.correct) setScore(previous => previous + 1);
        } catch (error) {
            if (!controller.signal.aborted) {
                setSelectedAnswer(null);
                showAlert(error instanceof Error ? error.message : 'Could not submit your answer. Please retry.');
            }
        } finally {
            if (answerRequest.current === controller) {
                answerRequest.current = null;
                setIsSubmitting(false);
            }
        }
    };

    const endGame = () => { active.current = false; cancelRequests(); setIsLoading(false); setIsSubmitting(false); setPhase('ended'); };
    const resetGame = () => { active.current = false; cancelRequests(); setPhase('setup'); };
    return { currentQuestion, questionNumber, score, selectedAnswer, isAnswered, isLoading, isSubmitting, gameStarted: phase !== 'setup', isGameOver: phase === 'ended', fetchQuestions, startGame, nextQuestion, submitAnswer, endGame, resetGame };
}
