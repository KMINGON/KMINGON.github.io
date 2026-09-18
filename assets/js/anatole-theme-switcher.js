const getStoredThemeStyle = () => localStorage.getItem('theme');

const setThemeStyle = (style) => {
  localStorage.setItem('theme', style);
  const html = document.documentElement;
  const prevTheme = [...html.classList].find((c) => c.match(/theme--(light|dark)/));
  if (prevTheme) {
    html.classList.remove(prevTheme);
  }
  html.classList.add(`theme--${style}`);
};

const setDarkTheme = () => {
  setThemeStyle('dark');
};
const setLightTheme = () => {
  setThemeStyle('light');
};

const switchTheme = () => {
  const currThemeStyle = getStoredThemeStyle();
  switch (currThemeStyle) {
    case 'light':
      setDarkTheme();
      break;
    case 'dark':
      setLightTheme();
      break;
    default:
      setLightTheme();
      break;
  }
};

document.addEventListener(
  'DOMContentLoaded',
  () => {
    const themeSwitcher = document.querySelector('.themeswitch');
    themeSwitcher.addEventListener('click', switchTheme, false);
  },
  false,
);

// Start in light mode unless the visitor has already chosen a theme.
setThemeStyle(getStoredThemeStyle() || 'light');
