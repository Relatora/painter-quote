import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import QuoteList from './screens/QuoteList'
import QuoteEditor from './screens/QuoteEditor'
import PublicQuoteView from './screens/PublicQuoteView'
import Settings from './screens/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QuoteList />} />
        <Route path="/quote/:id" element={<QuoteEditor />} />
        <Route path="/settings" element={<Settings />} />
        {/* Short public path: this is what gets pasted into a text message. */}
        <Route path="/q/:token" element={<PublicQuoteView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
