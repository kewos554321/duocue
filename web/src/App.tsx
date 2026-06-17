import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import StatsPage from './pages/StatsPage'
import SentenceAISheet from './components/SentenceAISheet'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import {
  fetchSentences, fetchVideos, fetchWords,
  fetchPracticeQueue, fetchPracticeStats,
  patchWordStatus, deleteSentence, removeWord, postPracticeReview, deleteNote,
} from './api'
import { getToken } from './auth'
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
    if (!getToken()) {
      setLoading(false)
      return
    }
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

  const [aiSheetSentence, setAiSheetSentence] = useState<ApiSentence | null>(null)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)

  const openAiSheet = (sentence: ApiSentence) => {
    setAiSheetSentence(sentence)
    setAiSheetOpen(true)
  }
  const closeAiSheet = () => setAiSheetOpen(false)

  const handleNoteSaved = (id: number, note: string, updatedAt: number) => {
    setSentences(prev => prev.map(s => (s.id === id ? { ...s, aiNote: note, aiNoteUpdatedAt: updatedAt } : s)))
  }
  const handleNoteDeleted = (id: number) => {
    setSentences(prev => prev.map(s => (s.id === id ? { ...s, aiNote: null, aiNoteUpdatedAt: null } : s)))
  }
  const handleDeleteNoteDirect = async (id: number) => {
    await deleteNote(id)
    handleNoteDeleted(id)
  }

  const wordMap = new Map(words.map(w => [w.word, w.status]))

  if (!getToken()) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

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
    onOpenAI: openAiSheet,
    onRefreshSentences: refreshSentences,
  }

  return (
    <>
      <Layout sentences={sentences} words={words} practiceQueueCount={practiceQueue.length} dimmed={aiSheetOpen}>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Navigate to="/sentences/recent" replace />} />
          <Route path="/sentences/recent" element={<SentencesPage tab="recent" {...sentenceProps} />} />
          <Route path="/sentences/all" element={<SentencesPage tab="all" {...sentenceProps} />} />
          <Route path="/words" element={<WordBookPage words={words} sentences={sentences} onUpdateWordStatus={updateWordStatus} onRemoveWord={handleRemoveWord} />} />
          <Route path="/practice" element={<PracticePage queue={practiceQueue} onReview={handleReview} />} />
          <Route path="/stats" element={<StatsPage stats={stats} loading={false} />} />
          <Route path="/notes" element={<NotesPage sentences={sentences} onOpenAI={openAiSheet} onDeleteNote={handleDeleteNoteDirect} />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
      <SentenceAISheet
        sentence={aiSheetSentence}
        isOpen={aiSheetOpen}
        onClose={closeAiSheet}
        onNoteSaved={handleNoteSaved}
        onNoteDeleted={handleNoteDeleted}
      />
    </>
  )
}
