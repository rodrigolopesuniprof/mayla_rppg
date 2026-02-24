import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScreenAutodeclaracao from './pages/ScreenAutodeclaracao';
import ScreenConsentimento from './pages/ScreenConsentimento';
import ScreenCamera from './pages/ScreenCamera';
import ScreenRelatorio from './pages/ScreenRelatorio';
import ScreenLogin from './pages/ScreenLogin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScreenAutodeclaracao />} />
        <Route path="/login" element={<ScreenLogin />} />
        <Route path="/consentimento" element={<ScreenConsentimento />} />
        <Route path="/camera" element={<ScreenCamera />} />
        <Route path="/relatorio" element={<ScreenRelatorio />} />
      </Routes>
    </BrowserRouter>
  );
}