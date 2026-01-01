import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface LocationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    icon?: React.ReactNode;
    isValid?: boolean;
    disabled?: boolean;
    className?: string;
}

interface Suggestion {
    place_id: string;
    display_name: string;
    lat: string;
    lon: string;
}

export default function LocationAutocomplete({
    value,
    onChange,
    placeholder,
    icon,
    isValid,
    disabled,
    className = ''
}: LocationAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout>();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = async (query: string) => {
        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
            );
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data);
                setIsOpen(data.length > 0);
            }
        } catch (err) {
            console.error('Autocomplete error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(newValue);
        }, 300);
    };

    const handleSelect = (s: Suggestion) => {
        onChange(s.display_name);
        setSuggestions([]);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative group ${className}`}>
            <div className="relative flex items-center">
                <div className="absolute left-4 text-color-text-tertiary group-focus-within:text-neon-blue transition-colors">
                    {icon || <MapPin className="w-5 h-5" />}
                </div>

                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    className={`input-modern !pl-12 !pr-10 ${isValid === true ? '!border-neon-green/30' :
                        isValid === false ? '!border-red-500/30' : ''
                        }`}
                />

                <div className="absolute right-3 flex items-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-neon-blue" />}
                    {isValid === true && !loading && <CheckCircle2 className="w-4 h-4 text-neon-green" />}
                    {isValid === false && !loading && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
            </div>

            {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60] animate-enter-up">
                    {suggestions.map((s) => (
                        <button
                            key={s.place_id}
                            type="button"
                            onClick={() => handleSelect(s)}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-start gap-3"
                        >
                            <MapPin className="w-4 h-4 text-neon-blue mt-1 shrink-0" />
                            <span className="text-sm text-gray-300 truncate">{s.display_name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
