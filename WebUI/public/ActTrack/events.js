let selections = [];
let activeDragSelection = { start: 0, end: 0, active: false };

const uiState = {
  isDragging: false,
  dragStartX: 0,
  resizingIndex: -1,
  resizingEdge: null,
  trackLeftOffset: 0,
  trackWidth: 0
};

function mergeSelections() {
  if (selections.length <= 1)
    return;
    
  selections.sort((a, b) => a.start - b.start);
  
  const merged = [];
  merged.push({ start: selections[0].start, end: selections[0].end });
  
  for (let i = 1; i < selections.length; i++) {
    const current = selections[i];
    const lastMerged = merged[merged.length - 1];
    
    if (current.start <= lastMerged.end) {
      lastMerged.end = Math.max(lastMerged.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  selections = merged;
}

function updateDragSelectionPosition() {
  const container = document.getElementById('drag-selection-container');
  if (!container)
    return;
    
  container.innerHTML = '';

  selections.forEach((zone, index) => {
    const block = document.createElement('div');
    block.className = 'drag-selection-inner';
    block.style.left = `${zone.start * 100}%`;
    block.style.width = `${(zone.end - zone.start) * 100}%`;

    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle left';
    leftHandle.dataset.index = index;

    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle right';
    rightHandle.dataset.index = index;

    block.appendChild(leftHandle);
    block.appendChild(rightHandle);
    container.appendChild(block);
  });

  if (activeDragSelection.active) {
    const block = document.createElement('div');
    block.className = 'drag-selection-inner';
    block.style.left = `${activeDragSelection.start * 100}%`;
    block.style.width = `${(activeDragSelection.end - activeDragSelection.start) * 100}%`;
    container.appendChild(block);
  }
}

function createCustomContextMenu(mouseX, mouseY) {
  const oldMenu = document.getElementById('rbm-context-menu');
  if (oldMenu)
    oldMenu.remove();
    
  if (selections.length === 0)
    return;

  const menu = document.createElement('div');
  menu.id = 'rbm-context-menu';
  menu.style.left = `${mouseX}px`;
  menu.style.top = `${mouseY}px`;
  
  const timeInfo = document.createElement('div');
  timeInfo.className = 'menu-info';
  timeInfo.textContent = `Selected: ${selections.length} zone(s)`;
  menu.appendChild(timeInfo);
  
  const createOption = document.createElement('div');
  createOption.className = 'menu-item';
  createOption.textContent = '➕ Create Tags Here';
  createOption.addEventListener('click', () => {
    menu.remove();
    const label = prompt(`Enter label for all ${selections.length} tags:`);
    if (label) {
      if (!window.mockData[activeDate]) {
        window.mockData[activeDate] = { date: activeDate, tags: [], activity: [], apps: [], docs: [] };
      }
      selections.forEach(zone => {
        window.mockData[activeDate].tags.push({
          start: zone.start,
          end: zone.end,
          name: label
        });
      });
      selections = [];
      window.loadTimeline(activeDate);
      window.updateAll();
    }
  });
  menu.appendChild(createOption);
  
  const cancelOption = document.createElement('div');
  cancelOption.className = 'menu-item cancel';
  cancelOption.textContent = '❌ Clear Selections';
  cancelOption.addEventListener('click', () => {
    menu.remove();
    selections = [];
    updateDragSelectionPosition();
  });
  menu.appendChild(cancelOption);
  
  document.body.appendChild(menu);
  
  const dismissHandler = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener('mousedown', dismissHandler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', dismissHandler), 10);
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('timeline-container');
  
  container.addEventListener('contextmenu', e => e.preventDefault());
  
  container.addEventListener('mousedown', (e) => {
    const rect = container.getBoundingClientRect();
    uiState.trackLeftOffset = rect.left + 120; 
    uiState.trackWidth = rect.width - 120;

    if (e.button === 0 && e.target.classList.contains('resize-handle')) {
      e.stopPropagation();
      uiState.resizingIndex = parseInt(e.target.dataset.index, 10);
      uiState.resizingEdge = e.target.classList.contains('left') ? 'left' : 'right';
      return;
    }

    if (e.button === 0 && e.clientX >= uiState.trackLeftOffset) {
      e.preventDefault();
      uiState.isDragging = true;
      const mouseX = e.clientX - uiState.trackLeftOffset;
      const ratio = Math.max(0, Math.min(mouseX / uiState.trackWidth, 1));
      
      uiState.dragStartX = ratio;
      activeDragSelection.start = ratio;
      activeDragSelection.end = ratio;
      activeDragSelection.active = false;
      
      if (!e.ctrlKey)
        selections = [];
        
      const oldMenu = document.getElementById('rbm-context-menu');
      if (oldMenu)
        oldMenu.remove();
        
      updateDragSelectionPosition();
    }
    
    if (e.button === 2 && selections.length > 0) {
      createCustomContextMenu(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (uiState.resizingIndex !== -1) {
      const currentX = Math.max(0, Math.min(e.clientX - uiState.trackLeftOffset, uiState.trackWidth));
      const ratio = currentX / uiState.trackWidth;
      const zone = selections[uiState.resizingIndex];
      
      if (zone) {
        if (uiState.resizingEdge === 'left') {
          zone.start = Math.min(ratio, zone.end - 0.005);
        } else {
          zone.end = Math.max(ratio, zone.start + 0.005);
        }
        updateDragSelectionPosition();
      }
      return;
    }

    if (uiState.isDragging) {
      const currentX = Math.max(0, Math.min(e.clientX - uiState.trackLeftOffset, uiState.trackWidth));
      const ratio = currentX / uiState.trackWidth;
      
      activeDragSelection.start = Math.min(uiState.dragStartX, ratio);
      activeDragSelection.end = Math.max(uiState.dragStartX, ratio);
      activeDragSelection.active = Math.abs(ratio - uiState.dragStartX) >= 0.002;
      
      updateDragSelectionPosition();
    }
  });

  window.addEventListener('mouseup', () => {
    if (uiState.resizingIndex !== -1) {
      uiState.resizingIndex = -1;
      uiState.resizingEdge = null;
      mergeSelections();
      updateDragSelectionPosition();
    }
    
    if (uiState.isDragging) {
      uiState.isDragging = false;
      if (activeDragSelection.active) {
        selections.push({ start: activeDragSelection.start, end: activeDragSelection.end });
        activeDragSelection.active = false;
        mergeSelections();
      }
      updateDragSelectionPosition();
    }
  });

  // --- SETTINGS PROTOCOL INITIALIZATION ---
  const modal = document.getElementById('settings-modal-overlay');
  const openBtn = document.getElementById('settings-open-btn');
  const cancelBtn = document.getElementById('settings-cancel-btn');
  const saveBtn = document.getElementById('settings-save-btn');

  openBtn.addEventListener('click', () => {
    modal.classList.add('is-active');
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('is-active');
  });

  saveBtn.addEventListener('click', () => {
    const theme = document.getElementById('settings-theme').value;
    document.documentElement.className = theme === 'light' ? 'light-theme' : '';
    modal.classList.remove('is-active');
  });
});
