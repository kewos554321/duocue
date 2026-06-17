import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import StatsPage from './pages/StatsPage'
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview,
} from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord, PracticeStats } from './types'

export default function App() {
  const [sentences, setSentences] = useState<ApiSentence[]>([])
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [words, setWords] = useState<ApiWord[]>([])
  const [practiceQueue, setPracticeQueue] = useState<PracticeWord[]>([])
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords(), fetchPracticeQueue(), fetchPracticeStats()])
      .then(([s, v, w, q, st]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
        setPracticeQueue(q)
        setStats(st)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const refreshSentences = async () => {
    const s = await fetchSentences()
    setSentences(s)
  }

  const handleDeleteSentence = async (id: number) => {
    await deleteSentence(id)
    setSentences(prev => prev.filter(s => s.id !== id))
  }

  const handleRemoveWord = async (word: string) => {
    await removeWord(word)
    setWords(prev => prev.filter(w => w.word !== word))
  }

  const updateWordStatus = async (word: string, status: WordStatus) => {
    await patchWordStatus(word, status)
    setWords(prev =>
      prev.some(w => w.word === word)
        ? prev.map(w => (w.word === word ? { ...w, status } : w))
        : [...prev, { word, status }]
    )
  }

  const handleReview = async (word: string, rating: 1 | 2 | 3 | 4) => {
    await postPracticeReview(word, rating)
    setPracticeQueue(prev => prev.filter(w => w.word !== word))
    fetchPracticeStats().then(setStats).catch(() => {})
  }

  const wordMap = new Map(words.map(w => [w.word, w.status]))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white/40 text-sm">
        載入中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const sentenceProps = {
    sentences,
    videos,
    wordMap,
    onUpdateWordStatus: updateWordStatus,
    onRemoveWordStatus: handleRemoveWord,
    onDeleteSentence: handleDeleteSentence,
    onRefreshSentences: refreshSentences,
  }

  return (
    <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length}>
      <Routes>
        <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
        <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
        <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
        <Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
        <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
        <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
      </Routes>
    </Layout>
  )
}
