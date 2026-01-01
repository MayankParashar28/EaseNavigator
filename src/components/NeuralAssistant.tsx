import { useState, useRef } from 'react';
import { Mic, Send, Sparkles, X, Loader2, BrainCircuit } from 'lucide-react';
import { type ParsedTripCommand, getChatResponse, type ChatMessage } from '../lib/ai';
import { EVModel } from '../lib/localStorage';
import { RouteWithGeom } from './RouteMap';

interface NeuralAssistantProps {
    onCommand: (command: ParsedTripCommand) => void;
    className?: string;
    context?: {
        origin?: string;
        destination?: string;
        evModel?: EVModel;
        routes?: RouteWithGeom[];
        startingBattery?: number;
    };
}

export default function NeuralAssistant({ onCommand, context, className = '' }: NeuralAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    const suggestions = context?.routes?.length
        ? ["Avoid tolls", "Minimize charging cost", "Explain this route", "Plan for winter"]
        : ["Plan a trip to SF", "Go from NY to DC", "Scenic route to LA"];


    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setInput('');
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const handleSubmit = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: ChatMessage = {
            role: 'user',
            content: text,
            timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsProcessing(true);

        try {
            const { response, command } = await getChatResponse({
                text,
                history: messages,
                context
            });

            const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: response,
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, assistantMsg]);

            if (command) {
                onCommand(command);
            }
        } catch (err) {
            console.error("Assistant error", err);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-r from-neon-purple to-neon-blue shadow-[0_0_20px_rgba(127,90,240,0.5)] hover:shadow-[0_0_30px_rgba(127,90,240,0.8)] transition-all duration-300 group ${className}`}
            >
                <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse-glow"></div>
                <BrainCircuit className="w-6 h-6 text-white relative z-10" />
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-surface-highlight border border-white/10 px-3 py-1 rounded-lg text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Ask Neural Assistant
                </span>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-enter-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-neon-purple/20 to-neon-blue/20 p-4 flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-neon-purple" />
                        <h3 className="font-bold text-white">Neural Assistant</h3>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-col h-[500px]">
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                    >
                        {messages.length === 0 && (
                            <div className="text-center py-8 space-y-4">
                                <div className="w-16 h-16 bg-neon-purple/10 rounded-full flex items-center justify-center mx-auto">
                                    <Sparkles className="w-8 h-8 text-neon-purple" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-lg">Neural Assistant</h4>
                                    <p className="text-color-text-secondary text-sm px-8">
                                        Your EV co-pilot. I can plan routes, optimize charging, and explain travel metrics.
                                    </p>
                                </div>
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                            >
                                <div className={`max-w-[85%] rounded-2xl p-4 ${m.role === 'user'
                                    ? 'bg-neon-purple text-white rounded-tr-none shadow-[0_5px_15px_rgba(127,90,240,0.3)]'
                                    : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                                    }`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                    <span className="text-[10px] opacity-40 mt-2 block">{m.timestamp}</span>
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 flex gap-2">
                                    <span className="w-2 h-2 bg-neon-purple rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-2 h-2 bg-neon-green rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white/5 border-t border-white/5 space-y-4">
                        {/* Suggestions */}
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSubmit(s)}
                                    className="px-3 py-1.5 rounded-full bg-surface-highlight border border-white/5 hover:border-neon-blue/50 text-[11px] font-medium text-gray-400 hover:text-neon-blue transition-all"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Where would you like to go?"
                                className="w-full bg-surface-highlight border border-white/10 rounded-xl p-3 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple min-h-[50px] max-h-[150px] resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(input);
                                    }
                                }}
                            />

                            <div className="absolute bottom-2.5 right-2.5 flex gap-2">
                                {recognitionRef.current && (
                                    <button
                                        onClick={toggleListening}
                                        className={`p-1.5 rounded-lg transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
                                        title="Voice Input"
                                    >
                                        <Mic className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => handleSubmit(input)}
                                    disabled={!input.trim() || isProcessing}
                                    className="p-1.5 bg-neon-purple hover:bg-neon-purple/80 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
