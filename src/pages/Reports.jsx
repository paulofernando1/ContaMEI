import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, ChevronLeft, FileText, BarChart, DollarSign, Wallet } from 'lucide-react';

const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val ?? 0);

export default function Reports() {
  const { dbData } = useContext(AppContext);
  const transactions = Array.isArray(dbData?.transactions) ? dbData.transactions : [];
  const accounts = Array.isArray(dbData?.accounts) ? dbData.accounts : [];
  
  const [activeReport, setActiveReport] = useState('overview'); // overview, cashflow, yearly, dre
  
  const [cfFilterType, setCfFilterType] = useState('month'); // 'month' or 'year'
  const [cfMonth, setCfMonth] = useState('');
  const [cfYear, setCfYear] = useState('');

  const today = new Date();
  const currentYear = today.getFullYear();
  const [dreYear, setDreYear] = useState(String(currentYear));
  const [yrYear, setYrYear] = useState('');

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    transactions.forEach(t => {
      if (t.date) years.add(parseInt(String(t.date).substring(0, 4)));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  // Overview Data (Last 12 months)
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, "MMM'/'yy", { locale: ptBR });
      const income = transactions.filter(t => t?.type === 'income' && t?.date && String(t.date).startsWith(key)).reduce((a, c) => a + (Number(c?.amount) || 0), 0);
      const expense = transactions.filter(t => t?.type === 'expense' && t?.date && String(t.date).startsWith(key)).reduce((a, c) => a + (Number(c?.amount) || 0), 0);
      months.push({ key, label, income, expense, balance: income - expense });
    }
    return months;
  }, [transactions]);

  const maxVal = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1);
  const maxBalance = Math.max(...monthlyData.map(m => Math.abs(m.balance)), 1);

  const totalIncome = transactions.filter(t => t?.type === 'income').reduce((a, c) => a + (Number(c?.amount) || 0), 0);
  const totalExpense = transactions.filter(t => t?.type === 'expense').reduce((a, c) => a + (Number(c?.amount) || 0), 0);

  // Breakdown Data
  const getCategoryBreakdown = (type) => {
    const map = {};
    transactions.filter(t => t?.type === type).forEach(t => { if (t?.category) map[t.category] = (map[t.category] || 0) + (Number(t?.amount) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };
  const incomeByCategory = useMemo(() => getCategoryBreakdown('income'), [transactions]);
  const expenseByCategory = useMemo(() => getCategoryBreakdown('expense'), [transactions]);

  // Report: Cash Flow per Account
  const cashFlowByAccount = useMemo(() => {
    let filteredTransactions = transactions;
    if (cfMonth) {
      filteredTransactions = filteredTransactions.filter(t => t.date && t.date.startsWith(cfMonth));
    } else if (cfYear) {
      filteredTransactions = filteredTransactions.filter(t => t.date && t.date.startsWith(cfYear));
    }

    const res = [];
    // General / Unassigned
    const unassigned = filteredTransactions.filter(t => !t.accountId);
    let generalInitial = 0;
    if (cfMonth || cfYear) {
      const prefix = cfMonth || cfYear;
      const pastTrans = transactions.filter(t => !t.accountId && t.date && t.date < prefix);
      const pastInc = pastTrans.filter(t => t.type === 'income').reduce((a, c) => a + Number(c.amount), 0);
      const pastExp = pastTrans.filter(t => t.type === 'expense').reduce((a, c) => a + Number(c.amount), 0);
      generalInitial += pastInc - pastExp;
    }
    const generalInc = unassigned.filter(t => t.type === 'income').reduce((a, c) => a + Number(c.amount), 0);
    const generalExp = unassigned.filter(t => t.type === 'expense').reduce((a, c) => a + Number(c.amount), 0);
    
    if (generalInitial !== 0 || generalInc !== 0 || generalExp !== 0) {
      res.push({ name: 'Caixa Geral / Não Atribuída', initial: generalInitial, income: generalInc, expense: generalExp, current: generalInitial + generalInc - generalExp });
    }

    accounts.forEach(acc => {
      const accTrans = filteredTransactions.filter(t => t.accountId === acc.id);
      const inc = accTrans.filter(t => t.type === 'income').reduce((a, c) => a + Number(c.amount), 0);
      const exp = accTrans.filter(t => t.type === 'expense').reduce((a, c) => a + Number(c.amount), 0);
      
      let periodInitial = acc.initialBalance || 0;
      if (cfMonth || cfYear) {
        const prefix = cfMonth || cfYear;
        const pastTrans = transactions.filter(t => t.accountId === acc.id && t.date && t.date < prefix);
        const pastInc = pastTrans.filter(t => t.type === 'income').reduce((a, c) => a + Number(c.amount), 0);
        const pastExp = pastTrans.filter(t => t.type === 'expense').reduce((a, c) => a + Number(c.amount), 0);
        periodInitial += pastInc - pastExp;
      }

      res.push({ name: acc.name, initial: periodInitial, income: inc, expense: exp, current: periodInitial + inc - exp });
    });
    return res;
  }, [accounts, transactions, cfMonth, cfYear]);

  // Report: Yearly Results
  const yearlyResults = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const year = String(t.date).substring(0, 4);
      if (!map[year]) map[year] = { year, income: 0, expense: 0 };
      if (t.type === 'income') map[year].income += Number(t.amount);
      if (t.type === 'expense') map[year].expense += Number(t.amount);
    });
    let res = Object.values(map).sort((a, b) => b.year.localeCompare(a.year));
    if (yrYear) res = res.filter(r => r.year === yrYear);
    return res;
  }, [transactions, yrYear]);

  // Report: DRE (Matrix Format)
  const dre = useMemo(() => {
    const yearTrans = transactions.filter(t => t.date && String(t.date).startsWith(dreYear));
    const initArray = () => Array(13).fill(0); // 0-11: Jan-Dec, 12: Total
    
    const receitasMap = {};
    const custosMap = {};
    const despesasMap = {};
    
    yearTrans.forEach(t => {
      const monthIndex = parseInt(String(t.date).substring(5, 7)) - 1;
      if (isNaN(monthIndex)) return;
      
      const amt = Number(t.amount) || 0;
      const cat = t.category || 'Sem categoria';
      
      if (t.type === 'income') {
        if (!receitasMap[cat]) receitasMap[cat] = initArray();
        receitasMap[cat][monthIndex] += amt;
        receitasMap[cat][12] += amt;
      } else if (t.type === 'expense') {
        const catLower = cat.toLowerCase();
        const isCost = catLower.includes('custo') || catLower.includes('compra') || catLower.includes('mercadoria') || catLower.includes('fornecedor');
        if (isCost) {
          if (!custosMap[cat]) custosMap[cat] = initArray();
          custosMap[cat][monthIndex] += amt;
          custosMap[cat][12] += amt;
        } else {
          if (!despesasMap[cat]) despesasMap[cat] = initArray();
          despesasMap[cat][monthIndex] += amt;
          despesasMap[cat][12] += amt;
        }
      }
    });

    const sumArrays = (maps) => {
      const total = initArray();
      Object.values(maps).forEach(arr => { for(let i=0; i<13; i++) total[i] += arr[i]; });
      return total;
    };

    const totalReceitas = sumArrays(receitasMap);
    const totalCustos = sumArrays(custosMap);
    const lucroBruto = initArray();
    for(let i=0; i<13; i++) lucroBruto[i] = totalReceitas[i] - totalCustos[i];
    
    const totalDespesas = sumArrays(despesasMap);
    const lucroLiquido = initArray();
    for(let i=0; i<13; i++) lucroLiquido[i] = lucroBruto[i] - totalDespesas[i];

    return { 
      year: dreYear, receitas: receitasMap, totalReceitas, custos: custosMap, 
      totalCustos, lucroBruto, despesas: despesasMap, totalDespesas, lucroLiquido
    };
  }, [transactions, dreYear]);

  const handlePrint = () => { window.print(); };

  if (activeReport === 'cashflow') {
    return (
      <div className="animate-in print-container">
        <div className="page-header no-print">
          <div><button className="btn-secondary" onClick={() => setActiveReport('overview')}><ChevronLeft size={16}/> Voltar</button></div>
          <button className="btn-primary" onClick={handlePrint}><Printer size={16}/> Imprimir PDF</button>
        </div>
        <div className="print-content" style={{ background: 'white', color: 'black', padding: '40px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '10px', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Fluxo de Caixa por Conta</h1>
            <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
              <select value={cfFilterType} onChange={e => { setCfFilterType(e.target.value); setCfMonth(''); setCfYear(''); }} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', color: 'black' }}>
                <option value="month">Por Mês</option>
                <option value="year">Por Ano</option>
              </select>
              {cfFilterType === 'month' ? (
                <input type="month" value={cfMonth} onChange={e => setCfMonth(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', color: 'black' }} />
              ) : (
                <select value={cfYear} onChange={e => setCfYear(e.target.value)} style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', color: 'black' }}>
                  <option value="">Ano (Todos)</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          </div>
          <p style={{ marginBottom: '20px', color: '#555' }}>Posição consolidada de todas as contas cadastradas.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Conta</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Saldo Inicial</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>Entradas</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>Saídas</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {cashFlowByAccount.map((acc, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{acc.name}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{fmt(acc.initial)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>{fmt(acc.income)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>{fmt(acc.expense)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(acc.current)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f5f5f5', fontWeight: 'bold' }}>
                <td style={{ padding: '12px' }}>TOTAL</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{fmt(cashFlowByAccount.reduce((a,c)=>a+c.initial,0))}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>{fmt(cashFlowByAccount.reduce((a,c)=>a+c.income,0))}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>{fmt(cashFlowByAccount.reduce((a,c)=>a+c.expense,0))}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{fmt(cashFlowByAccount.reduce((a,c)=>a+c.current,0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  if (activeReport === 'yearly') {
    return (
      <div className="animate-in print-container">
        <div className="page-header no-print">
          <div><button className="btn-secondary" onClick={() => setActiveReport('overview')}><ChevronLeft size={16}/> Voltar</button></div>
          <button className="btn-primary" onClick={handlePrint}><Printer size={16}/> Imprimir PDF</button>
        </div>
        <div className="print-content" style={{ background: 'white', color: 'black', padding: '40px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '10px', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Resultados Anuais Consolidados</h1>
            <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
              <select value={yrYear} onChange={e => setYrYear(e.target.value)} style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', color: 'black' }}>
                <option value="">Ano (Todos)</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <p style={{ marginBottom: '20px', color: '#555' }}>Comparativo histórico de faturamento e despesas por ano.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Ano</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>Receita Total</th>
                <th style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>Despesa Total</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Resultado (Lucro)</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Margem</th>
              </tr>
            </thead>
            <tbody>
              {yearlyResults.map((yr, i) => {
                const profit = yr.income - yr.expense;
                const margin = yr.income > 0 ? (profit / yr.income) * 100 : 0;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '1.1rem' }}>{yr.year}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#10b981' }}>{fmt(yr.income)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>{fmt(yr.expense)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(profit)}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{margin.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeReport === 'dre') {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    return (
      <div className="animate-in print-container">
        <style>{`@media print { @page { size: landscape; margin: 10mm; } }`}</style>
        <div className="page-header no-print">
          <div><button className="btn-secondary" onClick={() => setActiveReport('overview')}><ChevronLeft size={16}/> Voltar</button></div>
          <button className="btn-primary" onClick={handlePrint}><Printer size={16}/> Imprimir PDF</button>
        </div>
        <div className="print-content" style={{ background: 'white', color: 'black', padding: '20px', borderRadius: '8px', overflowX: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Relatório de Demonstrativo de Resultados (DRE)</h1>
            <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
              <select value={dreYear} onChange={e => setDreYear(e.target.value)} style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', color: 'black' }}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
            <div>Razão Social: {dbData?.company?.name || 'MEI'} | CNPJ: {dbData?.company?.cnpj || 'Não informado'}</div>
            <div style={{ fontWeight: 'bold', marginTop: '4px' }}>Ano {dre.year}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '1000px', border: '1px solid #000' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #000', width: '16%' }}>R$ (Reais)</th>
                {months.map(m => <th key={m} style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #000' }}>{m}</th>)}
                <th style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>Total {dre.year}</th>
              </tr>
            </thead>
            <tbody>
              
              {/* RECEITAS */}
              <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Receitas (Vendas)</td>
                {dre.totalReceitas.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
              </tr>
              {Object.entries(dre.receitas).map(([cat, vals]) => (
                <tr key={cat} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px 6px 6px 16px', borderRight: '1px solid #000' }}>{cat}</td>
                  {vals.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
                </tr>
              ))}

              {/* CUSTOS */}
              <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Custos</td>
                {dre.totalCustos.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
              </tr>
              {Object.entries(dre.custos).map(([cat, vals]) => (
                <tr key={cat} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px 6px 6px 16px', borderRight: '1px solid #000' }}>{cat}</td>
                  {vals.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
                </tr>
              ))}

              {/* LUCRO BRUTO */}
              <tr style={{ background: '#eaeaea', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Lucro Bruto</td>
                {dre.lucroBruto.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
              </tr>

              {/* DESPESAS */}
              <tr style={{ background: '#f8f8f8', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Despesas</td>
                {dre.totalDespesas.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
              </tr>
              {Object.entries(dre.despesas).map(([cat, vals]) => (
                <tr key={cat} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px 6px 6px 16px', borderRight: '1px solid #000' }}>{cat}</td>
                  {vals.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', borderRight: i < 12 ? '1px solid #000' : 'none' }}>{v === 0 ? '-' : fmt(v)}</td>)}
                </tr>
              ))}

              {/* LUCRO LIQUIDO */}
              <tr style={{ background: '#e0f2fe', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
                <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Lucro Líquido</td>
                {dre.lucroLiquido.map((v, i) => <td key={i} style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: i < 12 ? '1px solid #000' : 'none', color: v < 0 ? 'red' : 'inherit' }}>{v === 0 ? '-' : fmt(v)}</td>)}
              </tr>
            </tbody>
          </table>
          
          <div style={{ marginTop: '20px', fontSize: '0.75rem', color: '#555' }}>
            Emitido em {format(new Date(), 'dd/MM/yyyy, \'às\' HH:mm:ss')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Análise financeira e emissão de demonstrativos</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)' }} onClick={() => setActiveReport('cashflow')}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}><Wallet size={20} /></div>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Fluxo de Caixa por Conta</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Posição consolidada das contas bancárias</p>
          </div>
        </button>
        <button className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)' }} onClick={() => setActiveReport('dre')}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}><FileText size={20} /></div>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>DRE — Resultado do Exercício</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Demonstração contábil de {currentYear}</p>
          </div>
        </button>
        <button className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)' }} onClick={() => setActiveReport('yearly')}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}><BarChart size={20} /></div>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Resultados Anuais</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Comparativo histórico por ano</p>
          </div>
        </button>
      </div>

      <div className="glass-panel" style={{ marginBottom: '20px' }}>
        <div className="chart-header"><h3>Receitas × Despesas — Últimos 12 meses</h3></div>
        <div style={{ padding: '8px 20px 20px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: `164px`, minWidth: '600px' }}>
            {monthlyData.map(m => (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: `140px` }}>
                  <div title={`Receita: ${fmt(m.income)}`} style={{ flex: 1, background: '#10b981', opacity: 0.85, borderRadius: '3px 3px 0 0', height: `${maxVal > 0 ? (m.income / maxVal) * 100 : 0}%`, minHeight: m.income > 0 ? 3 : 0, transition: 'height 0.5s ease' }} />
                  <div title={`Despesa: ${fmt(m.expense)}`} style={{ flex: 1, background: '#ef4444', opacity: 0.85, borderRadius: '3px 3px 0 0', height: `${maxVal > 0 ? (m.expense / maxVal) * 100 : 0}%`, minHeight: m.expense > 0 ? 3 : 0, transition: 'height 0.5s ease' }} />
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {[
          { title: 'Receitas por Categoria', data: incomeByCategory, total: totalIncome, color: 'var(--success)' },
          { title: 'Despesas por Categoria', data: expenseByCategory, total: totalExpense, color: 'var(--danger)' },
        ].map(section => (
          <div key={section.title} className="glass-panel" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '16px' }}>{section.title}</h3>
            {section.data.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum dado</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {section.data.map(([cat, val]) => (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', marginBottom: '5px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {section.total > 0 ? `${((val / section.total) * 100).toFixed(1)}%` : '—'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{fmt(val)}</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ width: `${section.total > 0 ? (val / section.total) * 100 : 0}%`, height: '100%', background: section.color, borderRadius: 2, opacity: 0.85 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
