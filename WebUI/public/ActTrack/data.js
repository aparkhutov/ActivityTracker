window.mockData = {
  "2026-09-08": {
    date: "2026-09-08",
    tags: [
      { start: 0.0, end: 0.15, name: "Rest" },
      { start: 0.35, end: 0.55, name: "Project Alpha" },
      { start: 0.60, end: 0.80, name: "Meeting" },
      { start: 0.82, end: 0.95, name: "Education" }
    ],
    activity: [
      { start: 0.0, end: 0.30, name: "off" },
      { start: 0.30, end: 0.45, name: "console" },
      { start: 0.45, end: 0.50, name: "console-idle" },
      { start: 0.50, end: 0.65, name: "rdp" },
      { start: 0.65, end: 0.70, name: "rdp-idle" },
      { start: 0.70, end: 0.95, name: "console" },
      { start: 0.95, end: 1.0, name: "off" }
    ],
    apps: [
      { start: 0.30, end: 0.45, name: "vscode.exe" },
      { start: 0.45, end: 0.55, name: "chrome.exe" },
      { start: 0.55, end: 0.75, name: "mstsc.exe" },
      { start: 0.75, end: 0.95, name: "idea64.exe" }
    ],
    docs: [
      { start: 0.30, end: 0.42, name: "index.html" },
      { start: 0.42, end: 0.45, name: "script.js" },
      { start: 0.45, end: 0.55, name: "API_Documentation" },
      { start: 0.55, end: 0.65, name: "Remote_DB_Server" },
      { start: 0.65, end: 0.75, name: "index.html" },
      { start: 0.75, end: 0.95, name: "Architecture_Draft.docx" }
    ]
  }
};

const docColors = ['#fbcfe8', '#fef08a', '#bfdbfe', '#bbf7d0', '#fed7aa', '#ddd6fe', '#cffafe', '#cbd5e1'];

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

window.getDocumentColor = function(docName) {
  const colorIndex = djb2(docName) % docColors.length;
  return docColors[colorIndex];
};

window.getRowBaseColor = function(rowType, name) {
  if (rowType === 'docs')
    return window.getDocumentColor(name);
  if (rowType === 'tags')
    return 'var(--color-tag)';
  if (rowType === 'apps')
    return 'var(--color-app)';
  if (rowType === 'activity') {
    const actColors = { 
      'off': 'var(--color-act-off)', 
      'console': 'var(--color-act-console)', 
      'rdp': 'var(--color-act-rdp)', 
      'console-idle': 'var(--bg-act-console-idle)', 
      'rdp-idle': 'var(--bg-act-rdp-idle)' 
    };
    return actColors[name] || '#94a3b8';
  }
  return '#94a3b8';
};
