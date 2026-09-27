import { useTheme } from '../../context/ThemeContext'

export default function ThemeSwitcher() {
  const { theme, setLight, setDark } = useTheme()
  return (
    <div className="theme-switcher" role="group" aria-label="Theme switcher">
      <button
        id="theme-light-btn"
        className={`theme-switcher__btn ${theme === 'light' ? 'active' : ''}`}
        onClick={setLight}
        aria-label="Light mode"
        title="Light mode"
      >
        ☀️
      </button>
      <button
        id="theme-dark-btn"
        className={`theme-switcher__btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={setDark}
        aria-label="Dark mode"
        title="Dark mode"
      >
        🌙
      </button>
    </div>
  )
}
