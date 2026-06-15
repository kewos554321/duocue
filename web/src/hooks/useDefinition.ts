import { useState, useEffect } from 'react'

interface DictionaryEntry {
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string }>
  }>
}

const cache = new Map<string, { definition: string; partOfSpeech: string }>()

export function useDefinition(word: string | null) {
  const hit = word ? cache.get(word) : undefined
  const [definition, setDefinition] = useState<string>(hit?.definition ?? '—')
  const [partOfSpeech, setPartOfSpeech] = useState<string>(hit?.partOfSpeech ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!word) return
    const cached = cache.get(word)
    if (cached) {
      setDefinition(cached.definition)
      setPartOfSpeech(cached.partOfSpeech)
      return
    }
    setLoading(true)
    setDefinition('—')
    setPartOfSpeech('')
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      .then(r => (r.ok ? r.json() : null) as Promise<DictionaryEntry[] | null>)
      .then(data => {
        const meaning = data?.[0]?.meanings?.[0]
        const pos = meaning?.partOfSpeech ?? ''
        const def = meaning?.definitions?.[0]?.definition ?? '—'
        cache.set(word, { definition: def, partOfSpeech: pos })
        setPartOfSpeech(pos)
        setDefinition(def)
      })
      .catch(() => setDefinition('—'))
      .finally(() => setLoading(false))
  }, [word])

  return { definition, partOfSpeech, loading }
}
