import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import PracticePage from './pages/PracticePage'
import { fetchSentences, fetchVideos, fetchWords, fetchPracticeQueue, patchWordStatus, deleteSentence, removeWord, postPracticeReview } from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus, PracticeWord } from './types'

export default function App() {
  const [sentences, setSentences] = useState<ApiSentence[]>([])
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [words, setWords] = useState<ApiWord[]>([])
  const [practiceQueue, setPracticeQueue] = useState<PracticeWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState<'sentences' | 'words' | 'practice'>('sentences')
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords(), fetchPracticeQueue()])
      .then(([s, v, w, q]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
        setPracticeQueue(q)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

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

  const handleReview = async (word: string, result: 'know' | 'unknown') => {
    await postPracticeReview(word, result)
    setPracticeQueue(prev => prev.filter(w => w.word !== word))
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

  return (
    <Layout
      sentences={sentences}
      videos={videos}
      words={words}
      practiceQueueCount={practiceQueue.length}
      page={page}
      selectedVideoUrl={selectedVideoUrl}
      onSelectPage={setPage}
      onSelectVideo={setSelectedVideoUrl}
    >
      {page === 'sentences' ? (
        <SentencesPage
          sentences={sentences}
          wordMap={wordMap}
          selectedVideoUrl={selectedVideoUrl}
          onUpdateWordStatus={updateWordStatus}
          onRemoveWordStatus={handleRemoveWord}
          onDeleteSentence={handleDeleteSentence}
        />
      ) : page === 'words' ? (
        <WordBookPage
          words={words}
          sentences={sentences}
        />
      ) : (
        <PracticePage
          queue={practiceQueue}
          onReview={handleReview}
        />
      )}
    </Layout>
  )
}
