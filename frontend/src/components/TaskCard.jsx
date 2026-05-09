const STATUS_STYLES = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  running:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  success:  'bg-green-500/10 text-green-400 border-green-500/30',
  failed:   'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function TaskCard({ task, onClick }) {
  return (
    <div
      onClick={() => onClick(task)}
      className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{task.title}</p>
          <p className="text-gray-500 text-xs mt-0.5">{task.operation}</p>
        </div>
        <span className={`text-xs border px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[task.status]}`}>
          {task.status}
        </span>
      </div>
      {task.result && (
        <p className="text-gray-400 text-xs mt-3 truncate">Result: {task.result}</p>
      )}
    </div>
  );
}