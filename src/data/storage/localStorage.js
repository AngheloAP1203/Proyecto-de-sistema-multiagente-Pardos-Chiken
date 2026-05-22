export const readJSON = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

export const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error saving to localStorage for ${key}`, error)
  }
}

export const remove = (key) => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error(`Error removing from localStorage for ${key}`, error)
  }
}
