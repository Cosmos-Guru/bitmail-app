import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },   // A strong blue for primary actions
    secondary: { main: '#dc004e' }, // A contrasting secondary color
    background: {
      default: '#f5f5f5',           // Light gray background
      paper: '#ffffff',             // White for cards/paper
    },
    text: {
      primary: '#333333',           // Dark text for readability
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
