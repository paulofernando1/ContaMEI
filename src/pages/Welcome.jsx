import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App';
import { FolderOpen, Plus, File, Search, X, Minus, Square } from 'lucide-react';

export default function Welcome() {
  const { createNewFile, openExistingFile, loadFile } = useContext(AppContext);
  const [recentFiles, setRecentFiles] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(null);

  useEffect(() => {
    window.api?.getRecentFiles().then(setRecentFiles).catch(() => setRecentFiles([]));
  }, []);

  const getFileName = (p) => p.split(/[\/\\]/).pop();

  const handleCreateWithCnpj = async (e) => {
    e.preventDefault();
    const cnpjNum = cnpj.replace(/\D/g, '');
    if (cnpjNum.length !== 14) { alert('CNPJ deve ter 14 dígitos.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNum}`);
      if (!res.ok) throw new Error('CNPJ não encontrado na Receita Federal.');
      const data = await res.json();
      await createNewFile({
        cnpj: data.cnpj,
        name: data.razao_social || data.nome_fantasia || '',
        email: data.email || '',
        phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1})` : '',
        address: data.logradouro
          ? `${data.logradouro}, ${data.numero} — ${data.bairro}, ${data.municipio}/${data.uf}`
          : '',
      });
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (path, idx) => {
    setLoadingIdx(idx);
    await loadFile(path);
    setLoadingIdx(null);
  };

  const handleClearRecents = async () => {
    await window.api?.clearRecentFiles();
    setRecentFiles([]);
  };

  return (
    <div className="app-root">
      <div className="title-bar-custom">
        <span className="title-bar-title">APP MEI</span>
        <div className="title-bar-controls">
          <button onClick={() => window.api?.minimize()}><Minus size={13} /></button>
          <button onClick={() => window.api?.maximize()}><Square size={11} /></button>
          <button className="close-btn" onClick={() => window.api?.close()}><X size={13} /></button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', top: '5%', left: '15%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', bottom: '10%', right: '10%', pointerEvents: 'none' }} />

        <div className="glass-panel animate-in" style={{ width: '100%', maxWidth: '500px', padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>💼</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '6px' }}>
              APP MEI
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Gestão financeira simples para o seu negócio
            </p>
          </div>

          {!isCreating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px 20px' }} onClick={() => setIsCreating(true)}>
                <Plus size={18} /> Criar Nova Empresa
              </button>
              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '13px 20px' }} onClick={openExistingFile}>
                <FolderOpen size={18} /> Abrir Arquivo Existente (.json)
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateWithCnpj} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Informe o CNPJ para buscar os dados automaticamente na Receita Federal
              </p>
              <input
                autoFocus
                value={cnpj}
                onChange={e => setCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '3px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setIsCreating(false); setCnpj(''); }}>
                  <X size={14} /> Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={loading}>
                  <Search size={14} /> {loading ? 'Buscando...' : 'Buscar e Criar'}
                </button>
              </div>
            </form>
          )}

          {recentFiles.length > 0 && !isCreating && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Arquivos Recentes
                </span>
                <button onClick={handleClearRecents} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>
                  Limpar lista
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {recentFiles.map((path, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenRecent(path, idx)}
                    disabled={loadingIdx !== null}
                    style={{
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                      borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '10px',
                      textAlign: 'left', width: '100%', color: 'var(--text-primary)',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                  >
                    <File size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{getFileName(path)}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</div>
                    </div>
                    {loadingIdx === idx && <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', flexShrink: 0 }}>Abrindo...</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
