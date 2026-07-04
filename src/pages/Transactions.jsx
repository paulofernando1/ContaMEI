import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../App';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { Trash2, Plus, Search, Filter, X, Upload, FileText, Paperclip } from 'lucide-react';

const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const CATEGORIES = {
  income: ['Vendas', 'Serviços', 'Comissões', 'Aluguéis Recebidos', 'Outros Recebimentos'],
  expense: ['Fornecedores', 'Impostos / DAS', 'Marketing', 'Água / Luz / Telefone', 'Aluguel', 'Equipamentos', 'Salários / Pró-labore', 'Taxas e Tarifas', 'Outras Despesas'],
};

const EMPTY_FORM = {
  type: 'income',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  category: 'Vendas',
  notes: '',
  accountId: '',
  clientId: '',
  invoiceFile: '',
  hasNF: false,
  nfNumber: '',
  nfDate: '',
  isRecurring: false,
};

export default function Transactions() {
  const { dbData, saveDb, dbPath } = useContext(AppContext);
  const transactions = Array.isArray(dbData?.transactions) ? dbData.transactions : [];
  const accounts = Array.isArray(dbData?.accounts) ? dbData.accounts : [];
  const clients = Array.isArray(dbData?.clients) ? dbData.clients : [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeSwitch = (type) => {
    setForm(prev => ({ ...prev, type, category: CATEGORIES[type][0] }));
  };

  const openNewForm = () => {
    setForm({ ...EMPTY_FORM, accountId: accounts.length > 0 ? accounts[0].id : '' });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (t) => {
    setForm({
      type: t.type,
      amount: String(t.amount),
      description: t.description,
      date: t.date,
      category: t.category,
      notes: t.notes || '',
      accountId: t.accountId || '',
      clientId: t.clientId || '',
      invoiceFile: t.invoiceFile || '',
      hasNF: t.hasNF || false,
      nfNumber: t.nfNumber || '',
      nfDate: t.nfDate || '',
      isRecurring: t.isRecurring || false,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleUploadInvoice = async () => {
    if (!dbPath) { alert('Salve o arquivo principal do banco de dados (Ctrl+S) antes de anexar notas fiscais.'); return; }
    const file = await window.api.openInvoiceDialog();
    if (file) {
      try {
        const copied = await window.api.copyInvoice(file, dbPath);
        setForm(prev => ({ ...prev, invoiceFile: copied.relativePath }));
      } catch (e) {
        alert(e.message);
      }
    }
  };

  const handleOpenInvoice = (e, invoiceFile) => {
    e.stopPropagation(); // prevent edit
    if (!dbPath) return;
    const basePath = dbPath.substring(0, Math.max(dbPath.lastIndexOf('\\'), dbPath.lastIndexOf('/')));
    const fullPath = basePath + '/' + invoiceFile;
    window.api.openExternal(fullPath);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    const amount = parseFloat(String(form.amount).replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { alert('Valor inválido.'); return; }

    let newTransactions;
    if (editingId) {
      newTransactions = transactions.map(t =>
        t.id === editingId ? { ...t, ...form, amount } : t
      );
    } else {
      newTransactions = [...transactions, { id: uuidv4(), createdAt: new Date().toISOString(), ...form, amount }];
    }
    saveDb({ ...dbData, transactions: newTransactions });
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir este lançamento?')) return;
    saveDb({ ...dbData, transactions: transactions.filter(t => t.id !== id) });
  };

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter(t => filterType === 'all' || t.type === filterType)
      .filter(t => !filterMonth || t.date?.startsWith(filterMonth))
      .filter(t => filterAccount === 'all' || t.accountId === filterAccount)
      .filter(t => !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, filterType, filterMonth, filterAccount, search]);

  const totals = useMemo(() => ({
    income: filteredTransactions.filter(t => t.type === 'income').reduce((a, c) => a + Number(c.amount || 0), 0),
    expense: filteredTransactions.filter(t => t.type === 'expense').reduce((a, c) => a + Number(c.amount || 0), 0),
  }), [filteredTransactions]);

  const hasFilters = search || filterType !== 'all' || filterMonth || filterAccount !== 'all';

  const exportToCSV = async () => {
    if (filteredTransactions.length === 0) return alert('Nenhum dado para exportar.');
    const header = ['Data', 'Descricao', 'Tipo', 'Categoria', 'Conta', 'Valor', 'Cliente', 'NF', 'Obs'];
    const rows = filteredTransactions.map(t => {
      const acc = accounts.find(a => a.id === t.accountId)?.name || 'Caixa Geral';
      const cli = clients.find(c => c.id === t.clientId)?.name || '';
      return [
        t.date ? format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy') : '',
        `"${t.description.replace(/"/g, '""')}"`,
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.category,
        `"${acc}"`,
        t.amount.toString().replace('.', ','),
        `"${cli}"`,
        t.hasNF ? (t.nfNumber || 'Sim') : 'Nao',
        `"${t.notes ? t.notes.replace(/"/g, '""') : ''}"`
      ].join(';');
    });
    const csvContent = [header.join(';'), ...rows].join('\n');
    const path = await window.api.saveCSVDialog('exportacao_lancamentos.csv');
    if (path) {
      await window.api.writeText(path, csvContent);
      alert('CSV exportado com sucesso!');
    }
  };

  const handleDuplicateNextMonth = (e, t) => {
    e.stopPropagation();
    if (!confirm('Gerar mesma parcela para o mês atual?')) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const newT = { ...t, id: uuidv4(), date: todayStr, createdAt: new Date().toISOString() };
    saveDb({ ...dbData, transactions: [...transactions, newT] });
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lançamentos</h1>
          <p className="page-subtitle">{filteredTransactions.length} registros encontrados</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={exportToCSV}>
            <Upload size={16} /> Exportar CSV
          </button>
          <button className="btn-primary" onClick={openNewForm}>
            <Plus size={16} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* New / Edit Form */}
      {showForm && (
        <div className="glass-panel animate-in" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.1rem' }}>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
            <button className="btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
          </div>

          <div className="type-switcher" style={{ marginBottom: '20px' }}>
            <button className={`income ${form.type === 'income' ? 'active' : ''}`} type="button" onClick={() => handleTypeSwitch('income')}>
              ↑ Receita
            </button>
            <button className={`expense ${form.type === 'expense' ? 'active' : ''}`} type="button" onClick={() => handleTypeSwitch('expense')}>
              ↓ Despesa
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Descrição *</label>
                <input required name="description" value={form.description} onChange={handleChange} placeholder="Ex: Venda de produto" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Valor (R$) *</label>
                <input required type="number" step="0.01" min="0.01" name="amount" value={form.amount} onChange={handleChange} placeholder="0,00" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Data *</label>
                <input required type="date" name="date" value={form.date} onChange={handleChange} />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Conta Bancária</label>
                <select name="accountId" value={form.accountId} onChange={handleChange}>
                  <option value="">Nenhuma / Caixa Geral</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Cliente / Fornecedor</label>
                <select name="clientId" value={form.clientId} onChange={handleChange}>
                  <option value="">Nenhum</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Categoria</label>
                <select name="category" value={form.category} onChange={handleChange}>
                  {CATEGORIES[form.type].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nota Fiscal / Comprovante</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="checkbox" name="hasNF" checked={form.hasNF} onChange={e => setForm(p => ({...p, hasNF: e.target.checked}))} />
                    Possui NF Emitida
                  </label>
                </div>
                {form.hasNF && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input name="nfNumber" value={form.nfNumber} onChange={handleChange} placeholder="Número da NF" style={{ padding: '6px' }} />
                    <input type="date" name="nfDate" value={form.nfDate} onChange={handleChange} style={{ padding: '6px' }} title="Data de Emissão" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={handleUploadInvoice}>
                    <Paperclip size={15} /> {form.invoiceFile ? 'Anexar Outro' : 'Anexar Arquivo'}
                  </button>
                </div>
                {form.invoiceFile && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} /> {form.invoiceFile.split('/').pop()}
                    <button type="button" onClick={() => setForm(p => ({ ...p, invoiceFile: '' }))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: '4px' }}><X size={12} /></button>
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Observações</label>
                <input name="notes" value={form.notes} onChange={handleChange} placeholder="Opcional..." style={{ marginBottom: '12px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input type="checkbox" name="isRecurring" checked={form.isRecurring} onChange={e => setForm(p => ({...p, isRecurring: e.target.checked}))} />
                  É uma transação recorrente (Fixa/Assinatura)
                </label>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">{editingId ? 'Salvar Alterações' : 'Adicionar Lançamento'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ paddingLeft: '36px' }} />
        </div>
        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Todas as Contas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Todos os Tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 'auto' }} />
        {hasFilters && (
          <button className="btn-secondary" onClick={() => { setSearch(''); setFilterType('all'); setFilterMonth(''); setFilterAccount('all'); }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Totals Summary */}
      {(filteredTransactions.length > 0) && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Receitas:</span>
            <strong style={{ color: 'var(--success)' }}>{fmt(totals.income)}</strong>
          </div>
          <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Despesas:</span>
            <strong style={{ color: 'var(--danger)' }}>{fmt(totals.expense)}</strong>
          </div>
          <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Saldo:</span>
            <strong style={{ color: (totals.income - totals.expense) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {fmt(totals.income - totals.expense)}
            </strong>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria / Conta</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <p>Nenhum lançamento encontrado</p>
                    <small>Tente ajustar os filtros ou adicione novos lançamentos</small>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map(t => {
                const acc = accounts.find(a => a.id === t.accountId);
                const cli = clients.find(c => c.id === t.clientId);
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(t)}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {t.date ? format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy') : ''}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {t.description}
                        {t.isRecurring && <span className="badge badge-neutral" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>Recorrente</span>}
                        {t.hasNF && (
                          <span className="badge badge-success" style={{ padding: '2px 6px', fontSize: '0.65rem' }} title={t.nfNumber ? `NF: ${t.nfNumber}` : ''}>NF {t.nfNumber}</span>
                        )}
                        {t.invoiceFile && (
                          <button 
                            className="badge badge-neutral" 
                            style={{ cursor: 'pointer', border: 'none', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px' }}
                            onClick={(e) => handleOpenInvoice(e, t.invoiceFile)}
                            title="Ver Nota Fiscal / Comprovante"
                          >
                            <FileText size={10} /> NF
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {cli ? `👤 ${cli.name}` : ''} {t.notes ? `• ${t.notes}` : ''}
                      </div>
                    </td>
                    <td>
                      <div>{t.category}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {acc ? `🏦 ${acc.name}` : 'Caixa Geral'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${t.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                        {t.type === 'income' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'income' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                      {t.isRecurring && (
                         <button className="btn-icon" onClick={(e) => handleDuplicateNextMonth(e, t)} title="Gerar parcela para mês atual">
                           <Plus size={15} />
                         </button>
                      )}
                      <button className="btn-icon danger" onClick={(e) => handleDelete(e, t.id)} title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
