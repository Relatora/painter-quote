import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import QuoteList from './screens/QuoteList'
import QuoteEditor from './screens/QuoteEditor'
import PublicQuoteView from './screens/PublicQuoteView'
import Settings from './screens/Settings'
import SignIn from './screens/SignIn'
import { RequireAuth } from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<SignIn />} />

        {/* Short public path: this is what gets pasted into a text message. It sits
            outside RequireAuth because a homeowner must never hit a sign-in wall. */}
        <Route path="/q/:token" element={<PublicQuoteView />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <QuoteList />
            </RequireAuth>
          }
        />
        <Route
          path="/quote/:id"
          element={
            <RequireAuth>
              <QuoteEditor />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
