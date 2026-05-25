import { alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3', // Blue
    },
    secondary: {
      main: '#f50057', // Pink/Red for recording
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: (themeParam) => ({
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(themeParam.palette.primary.main, 0.45)} ${alpha(themeParam.palette.common.white, 0.08)}`,
        },
        '*::-webkit-scrollbar': {
          width: 8,
          height: 8,
        },
        '*::-webkit-scrollbar-track': {
          background: alpha(themeParam.palette.common.white, 0.08),
          borderRadius: 999,
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: alpha(themeParam.palette.primary.main, 0.45),
          borderRadius: 999,
          border: `2px solid ${alpha(themeParam.palette.background.default, 0.6)}`,
          minHeight: 24,
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: alpha(themeParam.palette.primary.main, 0.62),
        },
        '*::-webkit-scrollbar-thumb:active': {
          backgroundColor: alpha(themeParam.palette.primary.main, 0.78),
        },
        '*::-webkit-scrollbar-corner': {
          backgroundColor: 'transparent',
        },
      }),
    },
  },
});

export default theme;
