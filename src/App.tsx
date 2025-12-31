import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import TripPlanner from './components/TripPlanner';

function AppContent() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="text-center relative z-10 space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-r-2 border-neon-blue border-transparent"></div>
          <p className="text-color-text-secondary font-medium tracking-wide animate-pulse">Initializing Interface...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <TripPlanner onSignOut={signOut} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
