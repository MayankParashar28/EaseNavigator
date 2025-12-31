import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Brain, Loader2, AlertTriangle } from 'lucide-react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    if (authError) {
      setError(authError.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-purple/20 rounded-full blur-[100px] animate-pulse-glow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-green/10 rounded-full blur-[100px] animate-float animation-delay-400"></div>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">

        {/* Left Side: Hero Content */}
        <div className="space-y-8 animate-enter-up">
          <div className="space-y-2">
            <h1 className="text-6xl md:text-7xl font-bold leading-none tracking-tighter">
              <span className="text-white">Neural</span>
              <br />
              <span className="text-gradient">Navigator</span>
            </h1>
            <p className="text-xl text-color-text-secondary max-w-lg leading-relaxed">
              Experience the next generation of EV route planning using advanced AI to predict energy usage and optimize your journey.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4 group p-4 rounded-xl hover:bg-white/5 transition-colors duration-300 border border-transparent hover:border-white/5">
              <div className="p-3 bg-surface-highlight rounded-xl group-hover:bg-neon-purple/20 group-hover:text-neon-purple transition-all duration-300 text-white">
                <Brain className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">AI-Core Optimization</h3>
                <p className="text-color-text-tertiary">Real-time learning algorithms adapt to your driving style.</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 group p-4 rounded-xl hover:bg-white/5 transition-colors duration-300 border border-transparent hover:border-white/5">
              <div className="p-3 bg-surface-highlight rounded-xl group-hover:bg-neon-green/20 group-hover:text-neon-green transition-all duration-300 text-white">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Smart Charging Network</h3>
                <p className="text-color-text-tertiary">Seamless integration with global charging infrastructure.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full max-w-md mx-auto animate-enter-up animation-delay-200">
          <div className="glass-card p-8 md:p-10 relative overflow-hidden">
            {/* Decorative shine effect */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

            <div className="relative z-10">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white mb-2">
                  {isSignUp ? 'Join the Future' : 'Welcome Back'}
                </h2>
                <p className="text-color-text-secondary">
                  {isSignUp ? 'Create your neural profile' : 'Access your dashboard'}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                  <label htmlFor="email" className="text-sm font-medium text-color-text-secondary ml-1 block">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-modern"
                    placeholder="name@example.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="password" className="text-sm font-medium text-color-text-secondary ml-1 block">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-modern"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary mt-4"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing
                    </span>
                  ) : (
                    isSignUp ? 'Initialize Account' : 'Connect Interface'
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-color-text-secondary text-sm mb-4">
                  {isSignUp ? 'Already have access?' : 'New to Neural Navigator?'}
                </p>
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                  }}
                  className="text-neon-blue hover:text-white font-medium transition-all duration-200 hover:underline decoration-neon-blue/50 underline-offset-4"
                >
                  {isSignUp ? 'Sign in to existing account' : 'Create new account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
