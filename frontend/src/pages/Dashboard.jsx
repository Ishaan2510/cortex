import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">AI Task Platform</h1>
            <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            Log out
          </button>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <p className="text-gray-400">Task management coming in Phase 2.</p>
        </div>
      </div>
    </div>
  );
}