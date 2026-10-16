import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { TASKS_COLLECTION } from '@/config/collections.js'
import { TASKS_READ } from '@/config/tasks.js'

/**
 * The admins' tasks (_tasks), the latest {@link TASKS_READ}, newest first,
 * live: loading until the first answer, failed when they couldn't be read
 * (admins only, firestore.rules).
 *
 * @returns {{tasks: MapTask[], loading: boolean, failed: boolean}}
 */
export function useTasks() {
  const [state, setState] = useState({ tasks: [], loading: true, failed: false })
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'), limit(TASKS_READ)),
        (snapshot) => setState({ tasks: snapshot.docs.map((task) => /** @type {MapTask} */ ({ id: task.id, ...task.data({ serverTimestamps: 'estimate' }) })), loading: false, failed: false }),
        (error) => {
          console.error(error)
          setState((current) => ({ ...current, loading: false, failed: true }))
        },
      ),
    [],
  )
  return state
}

/**
 * How many tasks are open - the dashboard's Tasks entry shows it. Admins
 * only: 0 for anyone else (`enabled` false: nothing is read).
 *
 * @param {boolean} enabled
 * @returns {number}
 */
export function useOpenTaskCount(enabled) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    return onSnapshot(
      query(collection(db, TASKS_COLLECTION), where('status', '==', 'open')),
      (snapshot) => setCount(snapshot.size),
      () => setCount(0),
    )
  }, [enabled])
  return enabled ? count : 0
}
