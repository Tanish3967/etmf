import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const ACTIONABLE_STATUSES = [
  'Pending Review',
  'Under Review',
  'Review Complete',
  'Pending Approval',
  'Pending Signoff'
];

/**
 * Review Queue Hook (§8.10.16 & Clinevo eTMF v4.4 §8.8.4.2)
 * Manages sequential multi-document review/approval queues across workflow transitions.
 *
 * @param {Array|null} initialQueue - Optional predefined task array from parent workspace
 */
export default function useReviewQueue(initialQueue = null) {
  const [queue, setQueue] = useState(initialQueue || []);
  const [loading, setLoading] = useState(!initialQueue);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/workflow/tasks');
      const actionable = (res.data?.tasks || []).filter(t =>
        ACTIONABLE_STATUSES.includes(t.status)
      );
      setQueue(actionable);
      return actionable;
    } catch (err) {
      console.warn('Review queue task fetch fallback:', err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!initialQueue) {
      fetchQueue().then(() => {
        if (!active) return;
      });
    }
    return () => {
      active = false;
    };
  }, [initialQueue, fetchQueue]);

  const getNextDocument = useCallback((currentDocId, candidateList = null) => {
    const list = candidateList || queue;
    if (!list || list.length === 0) return null;
    const currentIndex = list.findIndex(d => d.id === currentDocId);
    if (currentIndex >= 0 && currentIndex < list.length - 1) {
      return list[currentIndex + 1];
    }
    return list.find(d => d.id !== currentDocId) || null;
  }, [queue]);

  return {
    queue,
    loading,
    refreshQueue: fetchQueue,
    getNextDocument
  };
}
