import React, { useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { format, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowRight, Target, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

const safeDate = (dateStr) => {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
};

export default function Dashboard() {
  const { dbData } = useContext(AppContext);
  const navigate = useNavigate();

  const transactions = Array.isArray(dbData?.transactions) ? dbData.transactions : [];
  const accounts = Array.isArray(dbData?.accounts) ? dbData.accounts : [];
  const das = Array.isArray(dbData?.das) ? dbData.das : [];
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const MEI_LIMIT_SETTING = dbData?.settings?.meiLimit ?? 81000;
  let activeMonths = 12;
  const startMonth = dbData?.company?.startMonth;
  if (startMonth && startMonth.startsWith(String(currentYear))) {
    activeMonths = 12 - parseInt(startMonth.substring(5, 7)) + 1;
  }
  const MEI_LIMIT = (MEI_LIMIT_SETTING / 12) * activeMonths;

  // Totals (all time)
  const initialBalances = useMemo(() => accounts.reduce((a, acc) => a + (Number(acc.initialBalance) || 0), 0), [accounts]);
  const income = useMemo(() => transactions.filter(t => t?.type === 'income').reduce((a, c) => a + (Number(c?.amount) || 0), 0), [transactions]);
  const expense = useMemo(() => transactions.filter(t => t?.type === 'expense').reduce((a, c) => a + (Number(c?.amount) || 0), 0), [transactions]);
  const currentBalance = initialBalances + income - expense;

  // Annual revenue (current year)
  const annualIncome = useMemo(() =>
    transactions
      .filter(t => t?.type === 'income' && t?.date?.startsWith(String(currentYear)))
      .reduce((a, c) => a + (Number(c?.amount) || 0), 0),
    [transactions, currentYear]
  );
  const annualPct = Math.min((annualIncome / MEI_LIMIT) * 100, 100);
  const annualRemaining = Math.max(MEI_LIMIT - annualIncome, 0);

  // Monthly income (current month)
  const monthlyLimit = MEI_LIMIT / 12;
  const monthlyIncome = useMemo(() =>
    transactions.filter(t => t?.type === 'income' && t?.date?.startsWith(currentMonthKey)).reduce((a, c) => a + (Number(c?.amount) || 0), 0),
    [transactions, currentMonthKey]
  );

  // DAS status
  const dasPago = das.some(d => d?.month === currentMonthKey && d?.paid);

  // Last 6 months chart
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, 'MMM', { locale: ptBR });
      const inc = transactions.filter(t => t?.type === 'income' && t?.date?.startsWith(key)).reduce((a, c) => a + (Number(c?.amount) || 0), 0);
      const exp = transactions.filter(t => t?.type === 'expense' && t?.date?.startsWith(key)).reduce((a, c) => a + (Number(c?.amount) || 0), 0);
      return { key, label, income: inc, expense: exp };
    });
  }, [transactions]);

  const maxBar = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1);

  // Recent transactions
  const recentTransactions = useMemo(() =>
    [...transactions].filter(t => t?.date).sort((a, b) => {
      const da = safeDate(a.date), db = safeDate(b.date);
      return (!da || !db) ? 0 : db - da;
    }).slice(0, 5),
    [transactions]
  );

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map = {};
    transactions.filter(t => t?.type === 'expense' && t?.category).forEach(t => { map[t.category] = (map[t.category] || 0) + (Number(t?.amount) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [transactions]);

  const limitColor = annualPct >= 90 ? 'var(--danger)' : annualPct >= 70 ? 'var(--warning)' : 'var(--success)';

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{dbData?.company?.name ? `Olá, ${dbData.company.name}` : 'Visão geral financeira'}</p>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </div>

      {/* Alerts */}

      {annualPct >= 90 && (
        <div className="alert alert-danger" style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}>
          <AlertTriangle size={17} style={{ flexShrink: 0 }} />
          <strong>Atenção! Você atingiu {annualPct.toFixed(1)}% do limite anual MEI.</strong> Faturamento próximo do teto de {fmt(MEI_LIMIT)}.
        </div>
      )}

      {/* KPI Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { title: 'Receitas Totais', value: income, color: 'var(--success)', icon: <TrendingUp size={17} color="var(--success)" />, bg: 'var(--success-bg)', sub: `${transactions.filter(t => t?.type === 'income').length} lançamentos` },
          { title: 'Despesas Totais', value: expense, color: 'var(--danger)', icon: <TrendingDown size={17} color="var(--danger)" />, bg: 'var(--danger-bg)', sub: `${transactions.filter(t => t?.type === 'expense').length} lançamentos` },
          { title: 'Saldo Atual', value: currentBalance, color: currentBalance >= 0 ? 'var(--success)' : 'var(--danger)', icon: <Wallet size={17} color="var(--accent-primary)" />, bg: 'rgba(99,102,241,0.1)', sub: 'Bancos + Caixa' },
        ].map(card => (
          <div key={card.title} className="stat-card glass-panel" style={{ cursor: 'default' }}>
            <div className="stat-icon" style={{ background: card.bg }}>{card.icon}</div>
            <div className="stat-title">{card.title}</div>
            <div className="stat-value" style={{ color: card.color, fontSize: '1.7rem' }}>{fmt(card.value)}</div>
            <div className="stat-change">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* MEI Limit Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Target size={18} color={limitColor} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Limite de Faturamento Anual MEI — {currentYear}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Mensal ideal: {fmt(monthlyLimit)} • Este mês: <span style={{ color: monthlyIncome > monthlyLimit ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>{fmt(monthlyIncome)}</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: limitColor }}>{fmt(annualIncome)}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>de {fmt(MEI_LIMIT)} • Resta {fmt(annualRemaining)}</div>
          </div>
        </div>
        <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${annualPct}%`, borderRadius: 5,
            background: annualPct >= 90 ? 'var(--danger)' : annualPct >= 70 ? 'var(--warning)' : 'var(--success)',
            transition: 'width 0.8s ease',
            boxShadow: `0 0 8px ${limitColor}60`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
          <span>{annualPct.toFixed(1)}% utilizado</span>
          <span>{(100 - annualPct).toFixed(1)}% disponível</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Bar chart */}
        <div className="glass-panel">
          <div className="chart-header"><h3>Receitas × Despesas — Últimos 6 meses</h3></div>
          <div style={{ padding: '12px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '150px' }}>
              {monthlyData.map(m => (
                <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: '130px' }}>
                    <div title={`Receita: ${fmt(m.income)}`} style={{ flex: 1, background: '#10b981', opacity: 0.85, borderRadius: '3px 3px 0 0', height: `${maxBar > 0 ? (m.income / maxBar) * 100 : 0}%`, minHeight: m.income > 0 ? 3 : 0, transition: 'height 0.6s ease' }} />
                    <div title={`Despesa: ${fmt(m.expense)}`} style={{ flex: 1, background: '#ef4444', opacity: 0.85, borderRadius: '3px 3px 0 0', height: `${maxBar > 0 ? (m.expense / maxBar) * 100 : 0}%`, minHeight: m.expense > 0 ? 3 : 0, transition: 'height 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{m.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
              {[['#10b981', 'Receitas'], ['#ef4444', 'Despesas']].map(([color, label]) => (
                <span key={label} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 8, height: 8, background: color, borderRadius: 2, display: 'inline-block' }} />{label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Top expenses */}
        <div className="glass-panel" style={{ padding: '20px 22px' }}>
          <h3 style={{ fontSize: '0.92rem', marginBottom: '14px' }}>Top Despesas por Categoria</h3>
          {categoryBreakdown.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma despesa registrada</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {categoryBreakdown.map(([cat, val]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(val)}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ width: `${expense > 0 ? (val / expense) * 100 : 0}%`, height: '100%', background: 'var(--danger)', borderRadius: 2, opacity: 0.8, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="chart-header" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '14px' }}>
          <h3 style={{ fontSize: '0.92rem' }}>Últimos Lançamentos</h3>
          <button onClick={() => navigate('/transactions')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ver todos <ArrowRight size={13} />
          </button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>Nenhum lançamento registrado</p>
            <small>Acesse Lançamentos no menu para começar</small>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
            <tbody>
              {recentTransactions.map(t => {
                const d = safeDate(t.date);
                return (
                  <tr key={t.id || Math.random()}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{d ? format(d, 'dd/MM/yyyy') : t.date}</td>
                    <td style={{ fontWeight: 500 }}>{t.description || '—'}</td>
                    <td><span className={`badge ${t.type === 'income' ? 'badge-success' : 'badge-danger'}`}>{t.category || t.type}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'income' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
