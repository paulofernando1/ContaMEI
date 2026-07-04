import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, X, Upload, CreditCard, Building, Wallet, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const EMPTY_ACCOUNT = { name: '', type: 'checking', initialBalance: 0 };

export default function Accounts() {
  const { dbData, saveDb } = useContext(AppContext);
  const accounts = Array.isArray(dbData?.accounts) ? dbData.accounts : [];
  const transactions = Array.isArray(dbData?.transactions) ? dbData.transactions : [];
  const clients = Array.isArray(dbData?.clients) ? dbData.clients : [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_ACCOUNT);

  // OFX State
  const [ofxData, setOfxData] = useState(null);
  const [ofxTargetAccount, setOfxTargetAccount] = useState('');
  const [ofxTransactions, setOfxTransactions] = useState([]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'initialBalance' ? parseFloat(value || 0) : value }));
  };

  const openNew = () => { setForm(EMPTY_ACCOUNT); setEditingId(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ name: c.name, type: c.type || 'checking', initialBalance: c.initialBalance || 0 }); setEditingId(c.id); setShowForm(true); };

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.name.trim()) return;
    let newAccounts;
    if (editingId) {
      newAccounts = accounts.map(c => c.id === editingId ? { ...c, ...form } : c);
    } else {
      newAccounts = [...accounts, { id: uuidv4(), ...form, createdAt: new Date().toISOString() }];
    }
    saveDb({ ...dbData, accounts: newAccounts });
    setShowForm(false);
    setForm(EMPTY_ACCOUNT);
    setEditingId(null);
  };

  const handleDelete = id => {
    if (!confirm('Excluir esta conta? Lançamentos associados ficarão sem conta informada.')) return;
    saveDb({ ...dbData, accounts: accounts.filter(c => c.id !== id) });
  };

  // Import OFX
  const handleImportOFX = async () => {
    const filePath = await window.api.openOFXDialog();
    if (!filePath) return;
    try {
      const data = await window.api.readOFX(filePath);
      if (data.errors && data.errors.length > 0 && data.totalFound === 0) {
        alert('Erro ao importar OFX:\n' + data.errors.join('\n'));
        return;
      }
      if (data.transactions.length === 0) {
        alert('Nenhuma transação encontrada no arquivo OFX.');
        return;
      }
      
      // Auto-assign account if we have an exact match
      let targetAccountId = accounts.length > 0 ? accounts[0].id : '';
      if (data.accountId) {
        const match = accounts.find(a => a.name.includes(data.accountId));
        if (match) targetAccountId = match.id;
      }

      setOfxTargetAccount(targetAccountId);
      setOfxData(data);
      // Map OFX transactions to our app schema
      const mapped = data.transactions.map(t => {
        // Simple auto-categorization
        const desc = t.description.toLowerCase();
        let cat = '';
        if (t.type === 'expense') {
          if (desc.includes('tarifa') || desc.includes('taxa')) cat = 'Taxas e Tarifas';
          else if (desc.includes('imposto') || desc.includes('das')) cat = 'Impostos';
          else if (desc.includes('fornecedor') || desc.includes('compra')) cat = 'Fornecedores';
          else cat = 'Outros';
        } else {
          cat = 'Vendas / Serviços';
        }

        return {
          id: uuidv4(), // temporary
          ofxFitId: t.fitId,
          date: t.date,
          type: t.type,
          amount: t.amount,
          description: t.description,
          category: cat,
          clientId: '',
          selected: true,
          exists: transactions.some(existing => existing.ofxFitId === t.fitId || 
                                      (existing.date === t.date && existing.amount === t.amount && existing.type === t.type))
        };
      });
      setOfxTransactions(mapped);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOFXChange = (id, field, value) => {
    setOfxTransactions(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const saveOFXTransactions = () => {
    if (!ofxTargetAccount) { alert('Selecione uma conta de destino.'); return; }
    
    const toSave = ofxTransactions.filter(t => t.selected && !t.exists).map(t => ({
      id: uuidv4(),
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: t.category,
      clientId: t.clientId,
      accountId: ofxTargetAccount,
      ofxFitId: t.ofxFitId,
      createdAt: new Date().toISOString()
    }));

    if (toSave.length === 0) {
      alert('Nenhuma nova transação selecionada para salvar.');
      setOfxData(null);
      return;
    }

    saveDb({ ...dbData, transactions: [...transactions, ...toSave] });
    alert(`${toSave.length} transações importadas com sucesso!`);
    setOfxData(null);
  };

  // Calculate balances
  const balances = useMemo(() => {
    const map = {};
    accounts.forEach(a => map[a.id] = a.initialBalance || 0);
    transactions.forEach(t => {
      if (t.accountId && map[t.accountId] !== undefined) {
        if (t.type === 'income') map[t.accountId] += Number(t.amount);
        else map[t.accountId] -= Number(t.amount);
      }
    });
    return map;
  }, [accounts, transactions]);

  const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contas e Conciliação</h1>
          <p className="page-subtitle">Gerencie suas contas bancárias e importe extratos OFX</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleImportOFX}><Upload size={16} /> Importar OFX</button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nova Conta</button>
        </div>
      </div>

      {/* OFX Modal */}
      {ofxData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={20} color="var(--accent-primary)" /> Conciliação de Extrato OFX
              </h2>
              <button className="btn-icon" onClick={() => setOfxData(null)}><X size={20} /></button>
            </div>
            
            <div style={{ padding: '16px 24px', display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Banco</div>
                <div style={{ fontWeight: 600 }}>{ofxData.bankId || 'Desconhecido'}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Período</div>
                <div style={{ fontWeight: 600 }}>{ofxData.startDate} até {ofxData.endDate}</div>
              </div>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Conta de Destino no App *</div>
                <select className="form-input" style={{ padding: '6px', marginTop: '4px' }} value={ofxTargetAccount} onChange={e => setOfxTargetAccount(e.target.value)}>
                  <option value="">Selecione a conta...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
              <table className="data-table" style={{ marginTop: '16px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>✓</th>
                    <th style={{ width: '100px' }}>Data</th>
                    <th>Descrição OFX</th>
                    <th>Valor</th>
                    <th>Categoria</th>
                    <th>Cliente / Fornec.</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ofxTransactions.map((t, i) => (
                    <tr key={t.id} style={{ opacity: t.exists ? 0.6 : 1 }}>
                      <td>
                        <input type="checkbox" checked={t.selected} disabled={t.exists} onChange={e => handleOFXChange(t.id, 'selected', e.target.checked)} />
                      </td>
                      <td>{t.date ? format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy') : ''}</td>
                      <td style={{ fontSize: '0.85rem' }}>{t.description}</td>
                      <td style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                      </td>
                      <td>
                        <input className="form-input" style={{ padding: '4px', fontSize: '0.8rem', height: '28px' }} value={t.category} onChange={e => handleOFXChange(t.id, 'category', e.target.value)} disabled={t.exists} />
                      </td>
                      <td>
                        <select className="form-input" style={{ padding: '4px', fontSize: '0.8rem', height: '28px' }} value={t.clientId} onChange={e => handleOFXChange(t.id, 'clientId', e.target.value)} disabled={t.exists}>
                          <option value="">Nenhum</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td>
                        {t.exists ? (
                          <span className="badge badge-warning" style={{ display: 'flex', gap: '4px', alignItems: 'center' }} title="Já existe no banco de dados"><AlertTriangle size={12} /> Duplicado</span>
                        ) : (
                          <span className="badge badge-success" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><CheckCircle size={12} /> Novo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setOfxData(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveOFXTransactions} disabled={!ofxTargetAccount}>
                Importar Selecionados ({ofxTransactions.filter(t => t.selected && !t.exists).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Account */}
      {showForm && (
        <div className="glass-panel animate-in" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.05rem' }}>{editingId ? 'Editar Conta' : 'Nova Conta'}</h2>
            <button className="btn-icon" onClick={() => setShowForm(false)}><X size={17} /></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome da Conta *</label>
                <input required name="name" value={form.name} onChange={handleChange} placeholder="Ex: Nubank PJ" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tipo</label>
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="checking">Conta Corrente</option>
                  <option value="savings">Poupança</option>
                  <option value="cash">Caixa / Dinheiro</option>
                  <option value="credit">Cartão de Crédito</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Saldo Inicial (R$)</label>
                <input type="number" step="0.01" name="initialBalance" value={form.initialBalance} onChange={handleChange} />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">{editingId ? 'Salvar Alterações' : 'Adicionar Conta'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Cards grid */}
      {accounts.length === 0 ? (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <p>Nenhuma conta cadastrada</p>
            <small>Clique em "Nova Conta" para começar</small>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {accounts.map(c => {
            const currentBalance = balances[c.id] || 0;
            return (
              <div key={c.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'var(--transition)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                      {c.type === 'cash' ? <Wallet size={20} /> : c.type === 'checking' ? <Building size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{c.name}</div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem', marginTop: '4px' }}>
                        {c.type === 'checking' ? 'Conta Corrente' : c.type === 'savings' ? 'Poupança' : c.type === 'cash' ? 'Caixa' : 'Cartão de Crédito'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => openEdit(c)} title="Editar"><Edit2 size={14} /></button>
                    <button className="btn-icon danger" onClick={() => handleDelete(c.id)} title="Excluir"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Saldo Inicial</div>
                    <div style={{ fontSize: '0.85rem' }}>{fmt(c.initialBalance)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Saldo Atual</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: currentBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {fmt(currentBalance)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
