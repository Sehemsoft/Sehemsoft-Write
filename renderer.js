const { ipcRenderer } = require('electron');

const editor = document.getElementById('editor');
const newBtn = document.getElementById('newBtn');
const openBtn = document.getElementById('openBtn');
const saveBtn = document.getElementById('saveBtn');
const saveAsBtn = document.getElementById('saveAsBtn');
const boldBtn = document.getElementById('boldBtn');
const italicBtn = document.getElementById('italicBtn');
const underlineBtn = document.getElementById('underlineBtn');
const strikeBtn = document.getElementById('strikeBtn');
const fontSize = document.getElementById('fontSize');
const customSize = document.getElementById('customSize');
const applyCustomSize = document.getElementById('applyCustomSize');
const textColor = document.getElementById('textColor');
const bgColor = document.getElementById('bgColor');
const cutBtn = document.getElementById('cutBtn');
const copyBtn = document.getElementById('copyBtn');
const pasteBtn = document.getElementById('pasteBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const statusText = document.getElementById('statusText');
const lineInfo = document.getElementById('lineInfo');

let isModified = false;

// Event listeners for toolbar buttons
newBtn.addEventListener('click', () => {
    ipcRenderer.send('new-file');
});

openBtn.addEventListener('click', () => {
    ipcRenderer.send('open-file');
});

saveBtn.addEventListener('click', () => {
    ipcRenderer.send('save-file');
});

saveAsBtn.addEventListener('click', () => {
    ipcRenderer.send('save-file-as');
});

// Formatting buttons
boldBtn.addEventListener('click', () => {
    document.execCommand('bold', false, null);
    editor.focus();
});

italicBtn.addEventListener('click', () => {
    document.execCommand('italic', false, null);
    editor.focus();
});

underlineBtn.addEventListener('click', () => {
    document.execCommand('underline', false, null);
    editor.focus();
});

strikeBtn.addEventListener('click', () => {
    document.execCommand('strikeThrough', false, null);
    editor.focus();
});

fontSize.addEventListener('change', () => {
    if (fontSize.value === 'custom') {
        customSize.style.display = 'inline-block';
        applyCustomSize.style.display = 'inline-block';
        customSize.focus();
    } else {
        customSize.style.display = 'none';
        applyCustomSize.style.display = 'none';
        document.execCommand('fontSize', false, fontSize.value);
        editor.focus();
    }
});

function applyCustomFontSize() {
    const size = parseInt(customSize.value);
    if (size >= 8 && size <= 72) {
        // Apply custom font size to current selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const contents = range.extractContents();
            
            const span = document.createElement('span');
            span.style.fontSize = size + 'px';
            span.appendChild(contents);
            
            range.insertNode(span);
            
            // Restore selection
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);
        } else {
            // For collapsed selection, create a span with the font size
            const span = document.createElement('span');
            span.style.fontSize = size + 'px';
            span.innerHTML = '&nbsp;';
            
            const range = selection.getRangeAt(0);
            range.insertNode(span);
            
            // Position cursor after the span
            range.setStartAfter(span);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        updateStatus(`Font boyutu ${size}px olarak ayarlandı`);
    } else {
        updateStatus('Font boyutu 8-72px arasında olmalı');
    }
}

customSize.addEventListener('input', () => {
    const size = parseInt(customSize.value);
    if (size >= 8 && size <= 72) {
        // Auto-apply when typing valid size
        applyCustomFontSize();
    }
});

customSize.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomFontSize();
    }
});

applyCustomSize.addEventListener('click', () => {
    applyCustomFontSize();
    editor.focus();
});

textColor.addEventListener('change', () => {
    document.execCommand('foreColor', false, textColor.value);
    editor.focus();
});

bgColor.addEventListener('change', () => {
    document.execCommand('hiliteColor', false, bgColor.value);
    editor.focus();
});

// Edit operations
cutBtn.addEventListener('click', () => {
    document.execCommand('cut');
    editor.focus();
});

copyBtn.addEventListener('click', () => {
    document.execCommand('copy');
    editor.focus();
});

pasteBtn.addEventListener('click', () => {
    document.execCommand('paste');
    editor.focus();
});

undoBtn.addEventListener('click', () => {
    document.execCommand('undo');
    editor.focus();
});

redoBtn.addEventListener('click', () => {
    document.execCommand('redo');
    editor.focus();
});

// Editor event listeners
editor.addEventListener('input', () => {
    if (!isModified) {
        isModified = true;
        ipcRenderer.send('content-changed');
    }
    updateLineInfo();
    updateFormattingButtons();
});

editor.addEventListener('keydown', (e) => {
    // Handle Ctrl+B for bold
    if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
    }
    
    // Handle Ctrl+I for italic
    if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
    }
    
    // Handle Ctrl+U for underline
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false, null);
    }
    
    // Handle Ctrl+S for save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        ipcRenderer.send('save-file');
    }
    
    // Handle Ctrl+O for open
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        ipcRenderer.send('open-file');
    }
    
    // Handle Ctrl+N for new
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        ipcRenderer.send('new-file');
    }
});

editor.addEventListener('keyup', () => {
    updateLineInfo();
    updateFormattingButtons();
});

editor.addEventListener('click', () => {
    updateLineInfo();
    updateFormattingButtons();
});

editor.addEventListener('scroll', updateLineInfo);

// Update formatting buttons based on current selection
function updateFormattingButtons() {
    boldBtn.classList.toggle('active', document.queryCommandState('bold'));
    italicBtn.classList.toggle('active', document.queryCommandState('italic'));
    underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
    strikeBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));
}

// IPC communication
ipcRenderer.on('clear-editor', () => {
    editor.innerHTML = '';
    isModified = false;
    updateStatus('Yeni dosya');
    updateLineInfo();
    updateFormattingButtons();
});

ipcRenderer.on('load-content', (event, content) => {
    editor.innerHTML = content;
    isModified = false;
    updateStatus('Dosya yüklendi');
    updateLineInfo();
    updateFormattingButtons();
});

ipcRenderer.on('get-content', () => {
    ipcRenderer.send('editor-content', editor.innerHTML);
});

ipcRenderer.on('file-saved', () => {
    isModified = false;
    updateStatus('Dosya kaydedildi');
    showSaveNotification();
});

ipcRenderer.on('status-update', (event, message) => {
    updateStatus(message);
});

// Helper functions
function updateLineInfo() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        
        const text = preCaretRange.toString();
        const lines = text.split('\n');
        const currentLine = lines.length;
        const currentColumn = lines[lines.length - 1].length + 1;
        
        lineInfo.textContent = `Satır: ${currentLine}, Sütun: ${currentColumn}`;
    } else {
        lineInfo.textContent = 'Satır: 1, Sütun: 1';
    }
}

function updateStatus(message) {
    statusText.textContent = message;
    setTimeout(() => {
        statusText.textContent = 'Hazır';
    }, 2000);
}

function showSaveNotification() {
    const notification = document.createElement('div');
    notification.className = 'save-notification';
    notification.textContent = 'Dosya başarıyla kaydedildi';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 2000);
}

// Initialize
updateLineInfo();
updateStatus('Hazır');

// Focus on editor
editor.focus();

// Handle window resize
window.addEventListener('resize', () => {
    updateLineInfo();
});

// Prevent drag and drop files
editor.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

editor.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        // Handle file drop - you could implement file opening here
        updateStatus('Dosya sürükle-bırak desteklenmiyor. Menüyü kullanın.');
    }
});

// Auto-save functionality (optional - every 30 seconds if modified)
setInterval(() => {
    if (isModified) {
        // You could implement auto-save here
        // ipcRenderer.send('auto-save');
    }
}, 30000);

// Word wrap toggle (you could add a button for this)
function toggleWordWrap() {
    if (editor.style.whiteSpace === 'pre-wrap') {
        editor.style.whiteSpace = 'pre';
        updateStatus('Sözcük kaydırma kapalı');
    } else {
        editor.style.whiteSpace = 'pre-wrap';
        updateStatus('Sözcük kaydırma açık');
    }
}

// Font size controls
function increaseFontSize() {
    const currentSize = parseInt(window.getComputedStyle(editor).fontSize);
    if (currentSize < 24) {
        editor.style.fontSize = (currentSize + 2) + 'px';
        updateStatus('Yazı tipi boyutu arttırıldı');
    }
}

function decreaseFontSize() {
    const currentSize = parseInt(window.getComputedStyle(editor).fontSize);
    if (currentSize > 10) {
        editor.style.fontSize = (currentSize - 2) + 'px';
        updateStatus('Yazı tipi boyutu azaltıldı');
    }
}

// Keyboard shortcuts help
function showKeyboardShortcuts() {
    const shortcuts = `
Klavye Kısayolları:
Ctrl+N - Yeni dosya
Ctrl+O - Dosya aç
Ctrl+S - Kaydet
Ctrl+Shift+S - Farklı kaydet
Ctrl+Z - Geri al
Ctrl+Y - İleri al
Ctrl+X - Kes
Ctrl+C - Kopyala
Ctrl+V - Yapıştır
Ctrl+A - Tümünü seç
Tab - 4 boşluk ekle
    `;
    alert(shortcuts);
}

// Add context menu
editor.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    
    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.style.cssText = `
        position: fixed;
        background: #2d2d30;
        border: 1px solid #3e3e42;
        border-radius: 4px;
        padding: 4px 0;
        z-index: 1000;
        min-width: 150px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    const menuItems = [
        { label: 'Geri Al', action: () => document.execCommand('undo') },
        { label: 'İleri Al', action: () => document.execCommand('redo') },
        { separator: true },
        { label: 'Kes', action: () => document.execCommand('cut') },
        { label: 'Kopyala', action: () => document.execCommand('copy') },
        { label: 'Yapıştır', action: () => document.execCommand('paste') },
        { separator: true },
        { label: 'Tümünü Seç', action: () => document.execCommand('selectall') }
    ];
    
    menuItems.forEach(item => {
        if (item.separator) {
            const separator = document.createElement('div');
            separator.style.cssText = `
                height: 1px;
                background: #3e3e42;
                margin: 4px 8px;
            `;
            contextMenu.appendChild(separator);
        } else {
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 8px 16px;
                color: #ffffff;
                cursor: pointer;
                font-size: 13px;
            `;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = '#094771';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            
            menuItem.addEventListener('click', () => {
                item.action();
                document.body.removeChild(contextMenu);
                editor.focus();
            });
            
            contextMenu.appendChild(menuItem);
        }
    });
    
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    
    document.body.appendChild(contextMenu);
    
    // Remove context menu when clicking elsewhere
    const removeMenu = (e) => {
        if (!contextMenu.contains(e.target)) {
            document.body.removeChild(contextMenu);
            document.removeEventListener('click', removeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', removeMenu);
    }, 100);
});
