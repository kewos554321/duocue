import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import SentencesPage from './pages/SentencesPage'
import WordBookPage from './pages/WordBookPage'
import { fetchSentences, fetchVideos, fetchWords, patchWordStatus } from './api'
import type { ApiSentence, ApiVideo, ApiWord, WordStatus } from './types'

export default function App() {
  const [sentences, setSentences] = useState<ApiSentence[]>([])
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [words, setWords] = useState<ApiWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState<'sentences' | 'words'>('sentences')
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchSentences(), fetchVideos(), fetchWords()])
      .then(([s, v, w]) => {
        setSentences(s)
        setVideos(v)
        setWords(w)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const updateWordStatus = async (word: string, status: WordStatus) => {
    await patchWordStatus(word, status)
    setWords(prev =>
      prev.some(w => w.word === word)
        ? prev.map(w => (w.word === word ? { ...w, status } : w))
        : [...prev, { word, status }]
    )
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
        />
      ) : (
        <WordBookPage
          words={words}
          sentences={sentences}
        />
      )}
    </Layout>
  )
}
