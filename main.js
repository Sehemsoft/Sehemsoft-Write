const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Packer, Document, Paragraph, TextRun, HeadingLevel } = require('docx');
const { JSDOM } = require('jsdom');

let mainWindow;
let currentFile = null;
let isModified = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key === 's') {
      event.preventDefault();
      saveFile();
    }
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Dosya',
      submenu: [
        {
          label: 'Yeni',
          accelerator: 'CmdOrCtrl+N',
          click: () => newFile()
        },
        {
          label: 'Aç',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile()
        },
        {
          label: 'Kaydet',
          accelerator: 'CmdOrCtrl+S',
          click: () => saveFile()
        },
        {
          label: 'Farklı Kaydet',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => saveFileAs()
        },
        { type: 'separator' },
        {
          label: 'Çıkış',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { role: 'undo', label: 'Geri Al' },
        { role: 'redo', label: 'İleri Al' },
        { type: 'separator' },
        { role: 'cut', label: 'Kes' },
        { role: 'copy', label: 'Kopyala' },
        { role: 'paste', label: 'Yapıştır' },
        { role: 'selectall', label: 'Tümünü Seç' }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'reload', label: 'Yeniden Yükle' },
        { role: 'forceReload', label: 'Zorla Yeniden Yükle' },
        { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Yakınlaştırmayı Sıfırla' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam Ekran' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function newFile() {
  if (isModified) {
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Kaydet', 'Kaydetme', 'İptal'],
      defaultId: 0,
      message: 'Değişiklikler kaydedilsin mi?'
    }).then((result) => {
      if (result.response === 0) {
        saveFile().then(() => {
          clearEditor();
        });
      } else if (result.response === 1) {
        clearEditor();
      }
    });
  } else {
    clearEditor();
  }
}

function clearEditor() {
  currentFile = null;
  isModified = false;
  mainWindow.webContents.send('clear-editor');
  updateWindowTitle();
}

function openFile() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Metin Dosyaları', extensions: ['txt', 'md', 'js', 'html', 'css', 'json', 'xml'] },
      { name: 'Tüm Dosyalar', extensions: ['*'] }
    ]
  }).then((result) => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        currentFile = filePath;
        isModified = false;
        mainWindow.webContents.send('load-content', content);
        updateWindowTitle();
      } catch (error) {
        dialog.showErrorBox('Hata', 'Dosya okunamadı: ' + error.message);
      }
    }
  });
}

function saveFile() {
  return new Promise((resolve, reject) => {
    if (currentFile) {
      saveContentToFile(currentFile);
      resolve();
    } else {
      saveFileAs().then(resolve).catch(reject);
    }
  });
}

function saveFileAs() {
  return new Promise((resolve, reject) => {
    dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'Metin Dosyası', extensions: ['txt'] },
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'HTML Document', extensions: ['html'] },
        { name: 'Tüm Dosyalar', extensions: ['*'] }
      ]
    }).then(async (result) => {
      if (!result.canceled && result.filePath) {
        const extension = path.extname(result.filePath).toLowerCase();
        
        // Check if saving as .txt with formatting
        if (extension === '.txt') {
          mainWindow.webContents.send('get-content');
          
          const handleContent = (event, content) => {
            if (hasFormatting(content)) {
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['Devam Et', 'İptal'],
                defaultId: 1,
                message: 'Uyarı',
                detail: 'Bu belge metin biçimlendirmesi (kalın, italik, vb.) içeriyor. TXT formatı bu biçimlendirmeyi korumaz. Devam etmek istiyor musunuz?'
              }).then((warningResult) => {
                if (warningResult.response === 0) {
                  // User chose to continue
                  currentFile = result.filePath;
                  saveContentToFile(result.filePath);
                  resolve();
                } else {
                  reject(new Error('Kaydetme iptal edildi'));
                }
              });
            } else {
              currentFile = result.filePath;
              saveContentToFile(result.filePath);
              resolve();
            }
            
            ipcMain.removeListener('editor-content', handleContent);
          };
          
          ipcMain.once('editor-content', handleContent);
        } else {
          currentFile = result.filePath;
          saveContentToFile(result.filePath);
          resolve();
        }
      } else {
        reject(new Error('Kaydetme iptal edildi'));
      }
    });
  });
}

function saveContentToFile(filePath) {
  mainWindow.webContents.send('get-content');
  
  const handleContent = (event, content) => {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      isModified = false;
      updateWindowTitle();
      mainWindow.webContents.send('file-saved');
      ipcMain.removeListener('editor-content', handleContent);
    } catch (error) {
      dialog.showErrorBox('Hata', 'Dosya kaydedilemedi: ' + error.message);
      ipcMain.removeListener('editor-content', handleContent);
    }
  };
  
  ipcMain.once('editor-content', handleContent);
}

function updateWindowTitle() {
  let title = 'Sehemsoft Notepad';
  if (currentFile) {
    const fileName = path.basename(currentFile);
    title = `${fileName} - ${title}`;
  }
  if (isModified) {
    title = `*${title}`;
  }
  mainWindow.setTitle(title);
}

// Export functions
async function exportToDocx(content) {
  try {
    const dom = new JSDOM(content);
    const document = dom.window.document;
    const paragraphs = [];
    
    const elements = document.body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li');
    
    elements.forEach(element => {
      const textRuns = [];
      
      function processNode(node) {
        if (node.nodeType === 3) { // Text node
          textRuns.push(new TextRun({ text: node.textContent }));
        } else if (node.nodeType === 1) { // Element node
          const text = node.textContent;
          if (text) {
            let run = new TextRun({ text });
            
            if (node.tagName === 'STRONG' || node.tagName === 'B') {
              run = new TextRun({ text, bold: true });
            } else if (node.tagName === 'EM' || node.tagName === 'I') {
              run = new TextRun({ text, italics: true });
            } else if (node.tagName === 'U') {
              run = new TextRun({ text, underline: {} });
            } else if (node.tagName === 'STRIKE' || node.tagName === 'S') {
              run = new TextRun({ text, strike: true });
            }
            
            textRuns.push(run);
          }
          
          // Process child nodes
          node.childNodes.forEach(processNode);
        }
      }
      
      processNode(element);
      
      let paragraph;
      if (element.tagName.startsWith('H')) {
        const level = parseInt(element.tagName.charAt(1));
        paragraph = new Paragraph({
          children: textRuns,
          headingLevel: level <= 6 ? HeadingLevel[`HEADING_${level}`] : HeadingLevel.HEADING_1
        });
      } else {
        paragraph = new Paragraph({
          children: textRuns
        });
      }
      
      paragraphs.push(paragraph);
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    const buffer = await Packer.toBuffer(doc);
    return buffer;
    
  } catch (error) {
    throw new Error('DOCX dışa aktarma hatası: ' + error.message);
  }
}

function exportToHtml(content) {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sehemsoft Notepad - Dışa Aktarılan Belge</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          font-size: 14px; 
          line-height: 1.6; 
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #fff;
        }
        h1, h2, h3, h4, h5, h6 { margin-top: 20px; margin-bottom: 10px; color: #2c3e50; }
        p { margin-bottom: 10px; }
        strong, b { font-weight: bold; }
        em, i { font-style: italic; }
        u { text-decoration: underline; }
        strike, s { text-decoration: line-through; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
  
  return Buffer.from(htmlContent, 'utf8');
}

function hasFormatting(content) {
  const dom = new JSDOM(content);
  const document = dom.window.document;
  
  const formattedElements = document.querySelectorAll('strong, b, em, i, u, strike, s, h1, h2, h3, h4, h5, h6, font, span[style]');
  return formattedElements.length > 0;
}

app.whenReady().then(() => {
  createWindow();
  
  // Set up IPC handlers after window is created
  ipcMain.on('new-file', () => {
    newFile();
  });

  ipcMain.on('open-file', () => {
    openFile();
  });

  ipcMain.on('save-file', () => {
    saveFile();
  });

  ipcMain.on('save-file-as', () => {
    saveFileAs();
  });

  ipcMain.on('content-changed', () => {
    isModified = true;
    updateWindowTitle();
  });

  // Export handlers
  ipcMain.on('export-docx', async () => {
    try {
      mainWindow.webContents.send('get-content');
      
      const handleContent = async (event, content) => {
        try {
          const buffer = await exportToDocx(content);
          
          const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'belge.docx',
            filters: [
              { name: 'Word Document', extensions: ['docx'] }
            ]
          });
          
          if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, buffer);
            updateStatus('DOCX dosyası başarıyla kaydedildi');
          }
          
          ipcMain.removeListener('editor-content', handleContent);
        } catch (error) {
          dialog.showErrorBox('Hata', 'DOCX dışa aktarma başarısız: ' + error.message);
          ipcMain.removeListener('editor-content', handleContent);
        }
      };
      
      ipcMain.once('editor-content', handleContent);
    } catch (error) {
      dialog.showErrorBox('Hata', 'DOCX dışa aktarma başarısız: ' + error.message);
    }
  });

  ipcMain.on('export-html', async () => {
    try {
      mainWindow.webContents.send('get-content');
      
      const handleContent = async (event, content) => {
        try {
          const buffer = exportToHtml(content);
          
          const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'belge.html',
            filters: [
              { name: 'HTML Document', extensions: ['html'] }
            ]
          });
          
          if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, buffer);
            updateStatus('HTML dosyası başarıyla kaydedildi');
          }
          
          ipcMain.removeListener('editor-content', handleContent);
        } catch (error) {
          dialog.showErrorBox('Hata', 'HTML dışa aktarma başarısız: ' + error.message);
          ipcMain.removeListener('editor-content', handleContent);
        }
      };
      
      ipcMain.once('editor-content', handleContent);
    } catch (error) {
      dialog.showErrorBox('Hata', 'HTML dışa aktarma başarısız: ' + error.message);
    }
  });

  function updateStatus(message) {
    mainWindow.webContents.send('status-update', message);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
