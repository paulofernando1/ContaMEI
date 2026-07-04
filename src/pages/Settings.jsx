import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { Save, Trash2, Download, Upload, AlertTriangle, RefreshCw, Info } from 'lucide-react';

const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

export default function Settings() {
  const { dbData, saveDb, dbPath } = useContext(AppContext);
  const [meiLimit, setMeiLimit] = useState(String(dbData?.settings?.meiLimit ?? 81000));
  const [autoSave, setAutoSave] = useState(dbData?.settings?.autoSave ?? true);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSaveSettings = () => {
    const limit = parseFloat(meiLimit.replace(',', '.'));
    if (isNaN(limit) || limit <= 0) { alert('Limite inválido.'); return; }
    saveDb({ ...dbData, settings: { ...(dbData.settings || {}), meiLimit: limit, autoSave } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClearTransactions = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    saveDb({ ...dbData, transactions: [], das: [] });
    setConfirmClear(false);
    alert('Todos os lançamentos e registros de DAS foram removidos.');
  };

  const handleExportBackup = async () => {
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `backup_${dbData?.company?.name?.replace(/\s+/g, '_') || 'mei'}_${date}.json`;
    const path = await window.api.saveFileDialog(name);
    if (path) {
      await window.api.writeFile(path, { ...dbData, _backup: { createdAt: new Date().toISOString(), version: dbData.version } });
      alert('Backup exportado com sucesso!');
    }
  };

  const stats = {
    transactions: (dbData?.transactions || []).length,
    income: (dbData?.transactions || []).filter(t => t?.type === 'income').reduce((a, c) => a + (Number(c?.amount) || 0), 0),
    expense: (dbData?.transactions || []).filter(t => t?.type === 'expense').reduce((a, c) => a + (Number(c?.amount) || 0), 0),
    clients: (dbData?.clients || []).length,
    das: (dbData?.das || []).filter(d => d?.paid).length,
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Preferências do aplicativo e gerenciamento de dados</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* App Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>⚙️ Preferências</h2>

          <div className="form-group">
            <label className="form-label">Limite Anual MEI (R$)</label>
            <input
              type="number"
              value={meiLimit}
              onChange={e => setMeiLimit(e.target.value)}
              placeholder="81000"
              min="1"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Valor padrão: R$ 81.000,00 (limite atual do Simples Nacional MEI)
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Salvamento Automático</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Salva automaticamente ao fazer alterações</div>
            </div>
            <div
              onClick={() => setAutoSave(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: autoSave ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.3s', flexShrink: 0
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: autoSave ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%',
                background: 'white', transition: 'left 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }} />
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%' }} onClick={handleSaveSettings}>
            <Save size={15} /> {saved ? '✓ Configurações Salvas!' : 'Salvar Configurações'}
          </button>
        </div>

        {/* File info */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>📁 Arquivo Atual</h2>

          <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '16px', wordBreak: 'break-all', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {dbPath || 'Arquivo não salvo em disco'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Lançamentos', value: stats.transactions },
              { label: 'Clientes', value: stats.clients },
              { label: 'DAS Pagos', value: stats.das },
              { label: 'Versão JSON', value: `v${dbData?.version || 1}` },
            ].map(s => (
              <div key={s.label} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{s.value}</div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={handleExportBackup}>
              <Download size={15} /> Exportar Backup Completo
            </button>
          </div>
        </div>

        {/* Financeiro summary */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>📊 Resumo Financeiro</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Total de Receitas', value: fmt(stats.income), color: 'var(--success)' },
              { label: 'Total de Despesas', value: fmt(stats.expense), color: 'var(--danger)' },
              { label: 'Saldo Geral', value: fmt(stats.income - stats.expense), color: stats.income >= stats.expense ? 'var(--success)' : 'var(--danger)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(239,68,68,0.2)' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '6px', color: 'var(--danger)' }}>⚠️ Zona de Perigo</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Ações irreversíveis. Faça um backup antes de prosseguir.
          </p>

          <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '0.82rem' }}>
            <Info size={15} style={{ flexShrink: 0 }} />
            <span>Esta ação remove <strong>todos os lançamentos</strong> e registros de DAS, mas mantém os dados da empresa e clientes.</span>
          </div>

          <button
            className="btn-danger"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleClearTransactions}
          >
            <Trash2 size={15} />
            {confirmClear ? '⚠️ Clique novamente para confirmar' : 'Limpar Todos os Lançamentos'}
          </button>

          {confirmClear && (
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
              onClick={() => setConfirmClear(false)}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
