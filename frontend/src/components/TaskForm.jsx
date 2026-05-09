import { useState } from 'react';
import { createTask } from '../api/tasks';

const OPERATIONS = [
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'reverse', label: 'Reverse String' },
  { value: 'word_count', label: 'Word Count' },
];

export default function TaskForm({ onTaskCreated }) {
  const [form, setForm] = useState({ title: '', inputText: '', operation: 'uppercase' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await createTask(form);
      onTaskCreated(data);
      setForm({ title: '', inputText: '', operation: 'uppercase' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-4">New Task</h2>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="e.g. Process quarterly report"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Input Text</label>
          <textarea
            value={form.inputText}
            onChange={(e) => setForm({ ...form, inputText: e.target.value })}
            required
            rows={3}
            placeholder="Text to process..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Operation</label>
          <select
            value={form.operation}
            onChange={(e) => setForm({ ...form, operation: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
          >
            {OPERATIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Submitting...' : 'Run Task'}
        </button>
      </form>
    </div>
  );
}