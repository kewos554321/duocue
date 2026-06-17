import { useEffect, useRef, useState } from 'react'
import { fetchLatestSentenceId } from '../api'

export function useNewSentencePoll(baselineId: number, intervalMs = 8000): boolean {
  const [hasNew, setHasNew] = useState(false)
  const seenIdRef = useRef(baselineId)

  useEffect(() => {
    seenIdRef.current = baselineId
    setHasNew(false)
  }, [baselineId])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      if (document.hidden) return
      try {
        const latestId = await fetchLatestSentenceId()
        if (!cancelled && latestId !== null && latestId > seenIdRef.current) {
          setHasNew(true)
        }
      } catch {
        // 背景輕量檢查，忽略錯誤、等下一次 interval 重試
      }
    }

    const id = setInterval(poll, intervalMs)
    document.addEventListener('visibilitychange', poll)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [intervalMs])

  return hasNew
}
