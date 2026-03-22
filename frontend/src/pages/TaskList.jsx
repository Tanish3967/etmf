import { useState, useEffect } from 'react';
import api from '../api';
import { AlertCircle, Clock, CheckCircle } from 'lucide-react';

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await api.get('/workflow/tasks');
        setTasks(res.data.tasks || []);
      } catch (err) {
        console.error('Failed to fetch tasks', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, []);

  const getSlaBadge = (sla) => {
    if (sla === 'red') return <span className="sla-badge sla-red"><AlertCircle size={14} style={{ marginRight: '4px' }}/> Overdue</span>;
    if (sla === 'amber') return <span className="sla-badge sla-amber"><Clock size={14} style={{ marginRight: '4px' }}/> Due Soon</span>;
    return <span className="sla-badge sla-green"><CheckCircle size={14} style={{ marginRight: '4px' }}/> On Track</span>;
  };

  return (
    <div className="animate-in">
      <h1>My Tasks (SLA Priority)</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Review and approve clinical documents in your queue.
      </p>

      <div className="glass-panel" style={{ padding: '0' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Document Code</th>
              <th>Task Action</th>
              <th>Assigned To</th>
              <th>Due Date</th>
              <th>SLA Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading tasks...</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>No tasks assigned to you.</td></tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} style={{ transition: 'background 0.2s', cursor: 'pointer' }} onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ fontWeight: 500, color: 'var(--accent-blue)' }}>{task.documentId}</td>
                  <td>{task.actionNeeded}</td>
                  <td>{task.assignedUser}</td>
                  <td>{new Date(task.dueDate).toLocaleDateString()}</td>
                  <td>{getSlaBadge(task.slaStatus)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
