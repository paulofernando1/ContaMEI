import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Building2, LogOut,
  Upload, Download, BarChart2, Minus, Square, X,
  Users, Settings as SettingsIcon, Save, CheckCircle, FileText
} from 'lucide-react';
import './styles/index.css';

export const AppContext = React.createContext();

import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Company from './pages/Company';
import Reports from './pages/Reports';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Accounts from './pages/Accounts';
import Taxes from './pages/Taxes';
import { ErrorBoundary } from './components/ErrorBoundary';

// Custom titlebar
const TitleBar = ({ title, saved }) => (
  <div className="title-bar-custom">
    <span className="title-bar-title">{title}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {saved === 'saving' && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={11} /> Salvando...</span>}
      {saved === 'saved' && <span style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={11} /> Salvo</span>}
      <div className="title-bar-controls">
        <button onClick={() => window.api?.minimize()} title="Minimizar"><Minus size={13} /></button>
        <button onClick={() => window.api?.maximize()} title="Maximizar"><Square size={11} /></button>
        <button className="close-btn" onClick={() => window.api?.close()} title="Fechar"><X size={13} /></button>
      </div>
    </div>
  </div>
);

const Layout = ({ children, saveIndicator }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setDbData, setDbPath, dbData, saveDb } = React.useContext(AppContext);

  const handleLogout = () => { setDbData(null); setDbPath(null); navigate('/'); };

  const handleExport = async () => {
    const name = `${(dbData?.company?.name || 'mei').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    const path = await window.api.saveFileDialog(name);
    if (path) { await window.api.writeFile(path, dbData); alert('Exportação concluída!'); }
  };

  const handleImport = async () => {
    const path = await window.api.openFileDialog();
    if (!path) return;
    try {
      const data = await window.api.readFile(path);
      if (!data.company || !data.transactions) throw new Error('Arquivo inválido.');
      await saveDb(data);
      alert('Dados importados com sucesso!');
    } catch (err) { alert('Erro: ' + err.message); }
  };

  const navMain = [
    { path: '/dashboard',    icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { path: '/transactions', icon: <Receipt size={16} />,         label: 'Lançamentos' },
    { path: '/reports',      icon: <BarChart2 size={16} />,       label: 'Relatórios' },
    { path: '/taxes',        icon: <FileText size={16} />,        label: 'Imposto de Renda' },
  ];

  const navCad = [
    { path: '/clients', icon: <Users size={16} />,    label: 'Clientes / Fornec.', badge: null },
    { path: '/accounts', icon: <Building2 size={16} />, label: 'Contas / OFX', badge: null },
    { path: '/company', icon: <Building2 size={16} />, label: 'Empresa',            badge: null },
  ];

  const isActive = (path) => location.pathname === path || (path === '/dashboard' && location.pathname === '/');

  return (
    <div className="app-root">
      <TitleBar
        title={dbData?.company?.name ? `APP MEI — ${dbData.company.name}` : 'APP MEI'}
        saved={saveIndicator}
      />
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h2>APP MEI</h2>
            <p style={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dbData?.company?.name || 'Gestão Financeira'}
            </p>
          </div>

          <span className="sidebar-section">Principal</span>
          {navMain.map(item => (
            <button key={item.path} className={`nav-btn ${isActive(item.path) ? 'active' : ''}`} onClick={() => navigate(item.path)}>
              {item.icon} {item.label}
            </button>
          ))}

          <span className="sidebar-section">Cadastros</span>
          {navCad.map(item => (
            <button key={item.path} className={`nav-btn ${isActive(item.path) ? 'active' : ''}`} onClick={() => navigate(item.path)}>
              {item.icon} {item.label}
              {item.badge && <span className="badge">{item.badge}</span>}
            </button>
          ))}

          <div className="sidebar-bottom">
            <span className="sidebar-section" style={{ padding: '0 0 4px' }}>Dados</span>
            <button className="nav-btn" onClick={handleImport}><Upload size={14} /> Importar JSON</button>
            <button className="nav-btn" onClick={handleExport}><Download size={14} /> Exportar JSON</button>
            <hr className="sidebar-divider" />
            <button className={`nav-btn ${isActive('/settings') ? 'active' : ''}`} onClick={() => navigate('/settings')}>
              <SettingsIcon size={14} /> Configurações
            </button>
            <button className="nav-btn" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              <LogOut size={14} /> Fechar Arquivo
            </button>
          </div>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const [dbPath, setDbPath] = useState(null);
  const [dbData, setDbData] = useState(null);
  const [saveIndicator, setSaveIndicator] = useState(null);
  const saveTimerRef = useRef(null);
  const pendingDataRef = useRef(null);

  const initialDbSchema = {
    version: 2,
    company: { cnpj: '', name: '', email: '', phone: '', address: '', cnaes: [], activityType: 'services', startMonth: '' },
    transactions: [],
    das: [],
    clients: [],
    accounts: [],
    settings: { meiLimit: 81000, autoSave: true },
  };

  const migrateSchema = (data) => ({
    ...initialDbSchema,
    ...data,
    company: { ...initialDbSchema.company, ...(data.company || {}) },
    das: data.das || [],
    clients: data.clients || [],
    accounts: data.accounts || [],
    settings: { meiLimit: 81000, autoSave: true, ...(data.settings || {}) },
    version: 2
  });

  const loadFile = async (path) => {
    try {
      const raw = await window.api.readFile(path);
      if (!raw.company || !raw.transactions) throw new Error('Arquivo JSON inválido.');
      setDbPath(path);
      setDbData(migrateSchema(raw));
      await window.api.addRecentFile(path);
    } catch (e) { alert('Erro ao abrir: ' + e.message); }
  };

  const createNewFile = async (initialCompany = {}) => {
    const path = await window.api.saveFileDialog('meu_mei.json');
    if (path) {
      const schema = { ...initialDbSchema, company: { ...initialDbSchema.company, ...initialCompany } };
      await window.api.writeFile(path, schema);
      setDbPath(path);
      setDbData(schema);
      await window.api.addRecentFile(path);
    }
  };

  const openExistingFile = async () => {
    const path = await window.api.openFileDialog();
    if (path) await loadFile(path);
  };

  // Auto-save with debounce
  const saveDb = async (newData) => {
    setDbData(newData);
    const autoSave = newData?.settings?.autoSave ?? true;

    if (dbPath && autoSave) {
      pendingDataRef.current = newData;
      setSaveIndicator('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await window.api.writeFile(dbPath, pendingDataRef.current);
          setSaveIndicator('saved');
          setTimeout(() => setSaveIndicator(null), 2000);
        } catch (e) {
          console.error('Auto-save failed:', e);
          setSaveIndicator(null);
        }
      }, 800);
    } else if (dbPath) {
      await window.api.writeFile(dbPath, newData);
    }
  };

  return (
    <AppContext.Provider value={{ dbPath, dbData, setDbData, setDbPath, saveDb, loadFile, createNewFile, openExistingFile }}>
      <Router>
        {!dbData ? (
          <Welcome />
        ) : (
          <Layout saveIndicator={saveIndicator}>
            <Routes>
              <Route path="/"             element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/dashboard"    element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/transactions" element={<ErrorBoundary><Transactions /></ErrorBoundary>} />
              <Route path="/company"      element={<ErrorBoundary><Company /></ErrorBoundary>} />
              <Route path="/reports"      element={<ErrorBoundary><Reports /></ErrorBoundary>} />
              <Route path="/clients"      element={<ErrorBoundary><Clients /></ErrorBoundary>} />
              <Route path="/accounts"     element={<ErrorBoundary><Accounts /></ErrorBoundary>} />
              <Route path="/settings"     element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              <Route path="/taxes"        element={<ErrorBoundary><Taxes /></ErrorBoundary>} />
            </Routes>
          </Layout>
        )}
      </Router>
    </AppContext.Provider>
  );
}
