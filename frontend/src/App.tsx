import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScreenAutodeclaracao from './pages/ScreenAutodeclaracao';
import ScreenConsentimento from './pages/ScreenConsentimento';
import ScreenCamera from './pages/ScreenCamera';
import ScreenRelatorio from './pages/ScreenRelatorio';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScreenAutodeclaracao />} />
        <Route path="/consentimento" element={<ScreenConsentimento />} />
        <Route path="/camera" element={<ScreenCamera />} />
        <Route path="/relatorio" element={<ScreenRelatorio />} />
      </Routes>
    </BrowserRouter>
  );
}
