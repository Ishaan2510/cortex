import { useEffect, useState } from 'react';
import { getTask } from '../api/tasks';

const STATUS_STYLES = {
  pending: 'text-yellow-400',
  running: 'text-blue-400',
  success: 'text-green-400',
  failed: 'text-red-400',
};

export default function TaskModal({ task, onClose }) {
  const [detail, setDetail] = useState(task);

  useEffect(() => {
    if (!task) return;
    setDetail(task);

    // Poll until terminal state
    if (task.status === 'pending' || task.status === 'running') {
      const interval = setInterval(async () => {
        try {
          const { data } = await getTask(task._id);
          setDetail(data);
          if (data.status === 'success' || data.status === 'failed') {
            clearInterval(interval);
          }
        } catch {
          clearInterval(interval);
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [task]);

  if (!task || !detail) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold">{detail.title}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{detail.operation}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">x</button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <p className={`text-sm font-medium capitalize ${STATUS_STYLES[detail.status]}`}>
              {detail.status}
              {(detail.status === 'pending' || detail.status === 'running') && (
                <span className="ml-1 animate-pulse">...</span>
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Input</p>
            <p className="text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2 break-all">{detail.inputText}</p>
          </div>

          {detail.result && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Result</p>
              <p className="text-sm text-green-300 bg-gray-800 rounded-lg px-3 py-2 break-all">{detail.result}</p>
            </div>
          )}

          {detail.logs?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Logs</p>
              <div className="bg-gray-950 rounded-lg px-3 py-2 space-y-1">
                {detail.logs.map((log, i) => (
                  <p key={i} className="text-xs text-gray-400 font-mono">{log}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}