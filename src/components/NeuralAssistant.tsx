import { useState, useEffect, useRef } from 'react';
import { Mic, Send, Sparkles, X, Loader2, BrainCircuit } from 'lucide-react';
import { parseTripCommand, type ParsedTripCommand } from '../lib/ai';

interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

declare let window: Window;

interface NeuralAssistantProps {
    onCommand: (command: ParsedTripCommand) => void;
    className?: string;
}

export default function NeuralAssistant({ onCommand, className = '' }: NeuralAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    // @ts-expect-error - non-standard web API
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current!;
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
                handleSubmit(transcript);
            };

            recognition.onerror = () => {
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

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

        setIsProcessing(true);
        const result = await parseTripCommand(text);
        setIsProcessing(false);

        if (result) {
            onCommand(result);
            setIsOpen(false);
            setInput('');
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
                <div className="p-6 space-y-4">
                    <p className="text-color-text-secondary text-sm">
                        Describe your trip naturally. For example:
                        <br />
                        <span className="text-neon-blue italic">"Plan a trip from San Francisco to LA avoiding highways."</span>
                    </p>

                    <div className="relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Where would you like to go?"
                            className="w-full bg-surface-highlight border border-white/10 rounded-xl p-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple min-h-[100px] resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(input);
                                }
                            }}
                        />

                        <div className="absolute bottom-3 right-3 flex gap-2">
                            {recognitionRef.current && (
                                <button
                                    onClick={toggleListening}
                                    className={`p-2 rounded-lg transition-all ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
                                    title="Voice Input"
                                >
                                    <Mic className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={() => handleSubmit(input)}
                                disabled={!input.trim() || isProcessing}
                                className="p-2 bg-neon-purple hover:bg-neon-purple/80 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
