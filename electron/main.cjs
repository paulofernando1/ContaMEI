const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const isDev = process.env.NODE_ENV === 'development';
let recentsPath = null;

async function getRecentFiles() {
  try {
    if (!recentsPath) return [];
    const data = await fs.readFile(recentsPath, 'utf8');
    const list = JSON.parse(data);
    const valid = [];
    for (const p of list) {
      try { await fs.access(p); valid.push(p); } catch {}
    }
    return valid;
  } catch { return []; }
}

async function addRecentFile(filePath) {
  let recents = await getRecentFiles();
  recents = recents.filter(p => p !== filePath);
  recents.unshift(filePath);
  if (recents.length > 10) recents = recents.slice(0, 10);
  try { await fs.writeFile(recentsPath, JSON.stringify(recents, null, 2)); } catch {}
  return recents;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    frame: false,
    backgroundColor: '#0a0c14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.handle('window:close', () => win.close());
}

app.whenReady().then(async () => {
  recentsPath = path.join(app.getPath('userData'), 'recents.json');

  // File dialogs
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Arquivos MEI', extensions: ['json'] }]
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName || 'dados_mei.json',
      filters: [{ name: 'Arquivos MEI', extensions: ['json'] }]
    });
    return canceled ? null : filePath;
  });

  ipcMain.handle('dialog:saveCSV', async (event, defaultName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName || 'exportacao_mei.csv',
      filters: [{ name: 'Arquivos CSV', extensions: ['csv'] }]
    });
    return canceled ? null : filePath;
  });

  // Open dialog for invoice files (jpg, pdf)
  ipcMain.handle('dialog:openInvoice', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Notas Fiscais', extensions: ['pdf', 'jpg', 'jpeg', 'png'] }
      ]
    });
    return canceled ? null : filePaths[0];
  });

  // Open dialog for OFX files
  ipcMain.handle('dialog:openOFX', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Extratos Bancários', extensions: ['ofx', 'ofc'] }
      ]
    });
    return canceled ? null : filePaths[0];
  });

  // Copy invoice file to data folder (alongside the JSON file)
  ipcMain.handle('file:copyInvoice', async (event, sourcePath, dbFilePath) => {
    try {
      const dbDir = path.dirname(dbFilePath);
      const invoicesDir = path.join(dbDir, 'notas_fiscais');
      await fs.mkdir(invoicesDir, { recursive: true });

      const ext = path.extname(sourcePath);
      const timestamp = Date.now();
      const fileName = `nf_${timestamp}${ext}`;
      const destPath = path.join(invoicesDir, fileName);

      await fs.copyFile(sourcePath, destPath);
      return { fileName, fullPath: destPath, relativePath: `notas_fiscais/${fileName}` };
    } catch (err) {
      throw new Error(`Erro ao copiar nota fiscal: ${err.message}`);
    }
  });

  // Open file with system default app
  ipcMain.handle('file:openExternal', async (event, filePath) => {
    try {
      await shell.openPath(filePath);
      return true;
    } catch { return false; }
  });

  // Read OFX file and parse it
  ipcMain.handle('file:readOFX', async (event, filePath) => {
    try {
      const raw = await fs.readFile(filePath, 'latin1');
      return parseOFX(raw);
    } catch (err) {
      throw new Error(`Erro ao ler OFX: ${err.message}`);
    }
  });

  // File read/write
  ipcMain.handle('file:read', async (event, filePath) => {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  });
  ipcMain.handle('file:write', async (event, filePath, data) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  });
  ipcMain.handle('file:writeText', async (event, filePath, text) => {
    await fs.writeFile(filePath, text, 'utf8');
    return true;
  });

  // Recents
  ipcMain.handle('store:getRecentFiles', () => getRecentFiles());
  ipcMain.handle('store:addRecentFile', (event, fp) => addRecentFile(fp));
  ipcMain.handle('store:clearRecentFiles', async () => {
    await fs.writeFile(recentsPath, JSON.stringify([], null, 2));
    return [];
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ==========================================
// OFX Parser — simple, robust, no dependencies
// ==========================================
function parseOFX(raw) {
  const errors = [];
  const transactions = [];
  let bankId = '', accountId = '', accountType = '', currency = '';
  let startDate = '', endDate = '';

  try {
    // Remove SGML header, keep only XML-like body
    let xml = raw;
    const ofxStart = raw.indexOf('<OFX>');
    if (ofxStart === -1) {
      const ofxStart2 = raw.indexOf('<ofx>');
      if (ofxStart2 === -1) throw new Error('Arquivo não contém dados OFX válidos.');
      xml = raw.substring(ofxStart2);
    } else {
      xml = raw.substring(ofxStart);
    }

    // Self-closing tags fix (OFX SGML doesn't close tags)
    xml = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Extract values using regex (works with both SGML and XML OFX)
    const getVal = (tag, src) => {
      const re = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
      const m = src.match(re);
      return m ? m[1].trim() : '';
    };

    bankId = getVal('BANKID', xml);
    accountId = getVal('ACCTID', xml);
    accountType = getVal('ACCTTYPE', xml);
    currency = getVal('CURDEF', xml) || 'BRL';

    // Date range
    const rawStart = getVal('DTSTART', xml);
    const rawEnd = getVal('DTEND', xml);
    if (rawStart) startDate = parseOFXDate(rawStart);
    if (rawEnd) endDate = parseOFXDate(rawEnd);

    // Extract STMTTRN blocks
    const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST))/gi;
    let match;
    let idx = 0;
    while ((match = trnRegex.exec(xml)) !== null) {
      idx++;
      try {
        const block = match[1];
        const trnType = getVal('TRNTYPE', block);
        const dtPosted = getVal('DTPOSTED', block);
        const amount = getVal('TRNAMT', block);
        const fitId = getVal('FITID', block);
        const memo = getVal('MEMO', block) || getVal('NAME', block) || 'Transação sem descrição';
        const checkNum = getVal('CHECKNUM', block);

        // Remove points and then replace comma with point for BRL formatting if needed
        let cleanAmt = amount.replace(/\./g, '');
        if (cleanAmt.includes(',')) {
          cleanAmt = cleanAmt.replace(',', '.');
        } else if (amount.includes('.')) {
           // It's probably an english format OFX already e.g. -1000.50
           cleanAmt = amount;
        }

        const parsedAmt = parseFloat(cleanAmt);
        if (isNaN(parsedAmt)) {
          errors.push(`Transação #${idx}: valor inválido "${amount}"`);
          continue;
        }

        transactions.push({
          fitId: fitId || `ofx_${idx}_${Date.now()}`,
          type: parsedAmt >= 0 ? 'income' : 'expense',
          amount: Math.abs(parsedAmt),
          description: memo.substring(0, 200),
          date: dtPosted ? parseOFXDate(dtPosted) : '',
          ofxType: trnType,
          checkNum,
        });
      } catch (e) {
        errors.push(`Transação #${idx}: ${e.message}`);
      }
    }

    if (transactions.length === 0 && errors.length === 0) {
      errors.push('Nenhuma transação encontrada no arquivo OFX.');
    }
  } catch (e) {
    errors.push(e.message);
  }

  return {
    bankId, accountId, accountType, currency,
    startDate, endDate,
    transactions,
    errors,
    totalFound: transactions.length,
  };
}

function parseOFXDate(str) {
  // OFX dates: YYYYMMDDHHMMSS or YYYYMMDD
  if (!str || str.length < 8) return '';
  const y = str.substring(0, 4);
  const m = str.substring(4, 6);
  const d = str.substring(6, 8);
  return `${y}-${m}-${d}`;
}
