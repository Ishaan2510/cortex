import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { getTasks } from '../api/tasks';
import TaskForm from '../components/TaskForm';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const { data } = await getTasks();
      setTasks(data);
    } catch {
      // silently fail — auth middleware handles 401
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleTaskCreated = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    setSelectedTask(newTask);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">AI Task Platform</h1>
            <p className="text-gray-400 text-sm mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            Log out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <TaskForm onTaskCreated={handleTaskCreated} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Your Tasks</h2>
            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : tasks.length === 0 ? (
              <p className="text-gray-500 text-sm">No tasks yet. Create one on the left.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <TaskCard key={task._id} task={task} onClick={setSelectedTask} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}