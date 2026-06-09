import { useState, useEffect } from 'react'

interface DictionaryEntry {
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string }>
  }>
}

export function useDefinition(word: string | null) {
  const [definition, setDefinition] = useState<string>('—')
  const [partOfSpeech, setPartOfSpeech] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!word) return
    setLoading(true)
    setDefinition('—')
    setPartOfSpeech('')
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      .then(r => (r.ok ? r.json() : null) as Promise<DictionaryEntry[] | null>)
      .then(data => {
        const meaning = data?.[0]?.meanings?.[0]
        setPartOfSpeech(meaning?.partOfSpeech ?? '')
        setDefinition(meaning?.definitions?.[0]?.definition ?? '—')
      })
      .catch(() => setDefinition('—'))
      .finally(() => setLoading(false))
  }, [word])

  return { definition, partOfSpeech, loading }
}
