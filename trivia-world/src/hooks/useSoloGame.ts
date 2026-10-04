'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, jsonBody } from '@/lib/api';
import { getAnswerOutbox } from '@/lib/answer-outbox';
import { prefetchSoloQuestions, takeReadySoloQuestions, takeSoloQuestions, type SoloQuestion } from '@/lib/solo-buffer';
import { useAlert } from '@/context/AlertContext';
import { useAuth } from '@/context/AuthContext';
export type { SoloQuestion } from '@/lib/solo-buffer';

export function useSoloGame(category: string, difficulty: string) {
    const { showAlert } = useAlert();
    const { user, loading } = useAuth();
    const owner = user?.id || 'guest';
    const [questions, setQuestions] = useState<SoloQuestion[]>([]);
    const [phase, setPhase] = useState<'setup' | 'playing' | 'ended'>('setup');
    const [questionNumber, setQuestionNumber] = useState(1);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [questionTask, setQuestionTask] = useState<AbortController | null>(null);
    const [answerTask, setAnswerTask] = useState<AbortController | null>(null);
    const questionRequest = useRef<AbortController | null>(null);
    const answerRequest = useRef<AbortController | null>(null);
    const answeredId = useRef<string | null>(null);
    const active = useRef(false);
    const currentQuestion = questions[0];

    const cancelRequests = useCallback(() => {
        questionRequest.current?.abort(); answerRequest.current?.abort();
        questionRequest.current = null; answerRequest.current = null;
    }, []);
    useEffect(() => cancelRequests, [cancelRequests]);
    useEffect(() => {
        if (loading || phase !== 'setup') return;
        const timer = setTimeout(() => prefetchSoloQuestions(owner, category, difficulty), 150);
        return () => clearTimeout(timer);
    }, [owner, category, difficulty, loading, phase]);

    const fetchQuestions = useCallback(async () => {
        if (questionRequest.current) return;
        const controller = new AbortController();
        questionRequest.current = controller;
        setQuestionTask(controller);
        try {
            const data = await takeSoloQuestions(owner, category, difficulty);
            if (!controller.signal.aborted) setQuestions(previous => [...previous, ...data]);
        } catch (error) {
            if (!controller.signal.aborted) showAlert(error instanceof Error ? error.message : 'Could not load questions.');
        } finally {
            if (questionRequest.current === controller) questionRequest.current = null;
            setQuestionTask(task => task === controller ? null : task);
        }
    }, [owner, category, difficulty, showAlert]);

    const startGame = () => {
        if (active.current) return;
        active.current = true;
        cancelRequests();
        answeredId.current = null;
        const ready = takeReadySoloQuestions(owner, category, difficulty);
        setQuestions(ready || []);
        setQuestionNumber(1); setScore(0); setSelectedAnswer(null); setIsAnswered(false);
        setAnswerTask(null); setQuestionTask(null); setPhase('playing');
        if (!ready) void fetchQuestions();
    };
    const nextQuestion = () => {
        if (!currentQuestion || answeredId.current !== currentQuestion.id) return;
        answeredId.current = null;
        setQuestions(previous => previous.slice(1));
        setQuestionNumber(previous => previous + 1);
        setSelectedAnswer(null); setIsAnswered(false);
        if (questions.length <= 6) void fetchQuestions();
    };

    // Compatibility during rolling deployment: older backends omit the answer key.
    const verifyLegacyAnswer = async (question: SoloQuestion, answer: string) => {
        const controller = new AbortController();
        answerRequest.current = controller;
        setAnswerTask(controller);
        try {
            const result = await api<{ correct: boolean; correctAnswer: string }>('/solo/answer', { ...jsonBody({ id: question.id, token: question.token, answer }), signal: controller.signal });
            if (controller.signal.aborted) return;
            answeredId.current = question.id;
            setQuestions(previous => previous.map(item => item.id === question.id ? { ...item, correct_answer: result.correctAnswer } : item));
            setIsAnswered(true);
            if (result.correct) setScore(previous => previous + 1);
        } catch (error) {
            if (!controller.signal.aborted) { setSelectedAnswer(null); showAlert(error instanceof Error ? error.message : 'Could not submit your answer. Please retry.'); }
        } finally {
            if (answerRequest.current === controller) answerRequest.current = null;
            setAnswerTask(task => task === controller ? null : task);
        }
    };
    const submitAnswer = (answer: string) => {
        if (!currentQuestion || answerRequest.current || answeredId.current === currentQuestion.id || !currentQuestion.all_answers.includes(answer)) return;
        setSelectedAnswer(answer);
        if (currentQuestion.correct_answer === undefined) { void verifyLegacyAnswer(currentQuestion, answer); return; }
        answeredId.current = currentQuestion.id;
        setIsAnswered(true);
        if (answer === currentQuestion.correct_answer) setScore(previous => previous + 1);
        getAnswerOutbox().enqueue(owner, { id: currentQuestion.id, token: currentQuestion.token, answer });
    };
    const endGame = () => { active.current = false; cancelRequests(); setQuestionTask(null); setAnswerTask(null); setPhase('ended'); };
    const resetGame = () => { active.current = false; cancelRequests(); setPhase('setup'); };
    return { currentQuestion, questionNumber, score, selectedAnswer, isAnswered, isLoading: questionTask !== null, isSubmitting: answerTask !== null, gameStarted: phase !== 'setup', isGameOver: phase === 'ended', fetchQuestions, startGame, nextQuestion, submitAnswer, endGame, resetGame };
}
