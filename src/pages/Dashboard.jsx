import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Task Manager</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {user?.name}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
        <p className="text-gray-600">Task list coming soon...</p>
      </div>
    </div>
  );
}

export default Dashboard;
