import { createBrowserRouter, Navigate } from 'react-router-dom'

import { BookTreePage } from '../pages/BookTreePage'
import { BooksPage } from '../pages/BooksPage'
import { LoginPage } from '../pages/LoginPage'
import { QuotesPage } from '../pages/QuotesPage'
import { ReviewsPage } from '../pages/ReviewsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ThemeLibraryPage } from '../pages/ThemeLibraryPage'
import { ThemeTreePage } from '../pages/ThemeTreePage'
import { AppShell } from './shell/AppShell'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/app/books" replace />,
  },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/app/books" replace /> },
      { path: 'books', element: <BooksPage /> },
      { path: 'theme-library', element: <ThemeLibraryPage /> },
      { path: 'quotes', element: <QuotesPage /> },
      { path: 'book-tree/:bookId', element: <BookTreePage /> },
      { path: 'theme-tree', element: <ThemeTreePage /> },
      { path: 'theme-tree/:themeId', element: <ThemeTreePage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
