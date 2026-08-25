let resizingZoneIndex = -1;
let resizingEdge = null; 

// Безопасная функция слияния диапазонов
function mergeSelections() {
  if (selections.length <= 1) return;

  selections.sort((a, b) => Number(a.startSec) - Number(b.startSec));
  
  const merged = [];
  // FIX: Push element safely as an object initialization map reference point
  merged.push({ startSec: selections[0].startSec, endSec: selections[0].endSec });

  for (let i = 1; i < selections.length; i++) {
    const current = selections[i];
    const lastMerged = merged[merged.length - 1];

    if (current.startSec <= lastMerged.endSec) {
      lastMerged.endSec = Math.max(lastMerged.endSec, current.endSec);
    } else {
      merged.push({ startSec: current.startSec, endSec: current.endSec });
    }
  }
  selections = merged;
}
dom.container.addEventListener('mousemove', (e) => {
 const bodyRect = document.querySelector('.timeline-body').getBoundingClientRect();
 const mouseX = e.clientX - bodyRect.left;

 if (mouseX >= 120 && mouseX <= bodyRect.width) {
 dom.hoverLine.style.left = `${mouseX}px`;
 dom.hoverLine.style.display = 'block';
 } else { 
 dom.hoverLine.style.display = 'none'; 
 }
});

dom.container.addEventListener('mouseleave', () => { 
  dom.hoverLine.style.display = 'none'; 
});

dom.container.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = dom.tagTrack.getBoundingClientRect();
  const mousePct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
  const currentDuration = viewMaxTime - viewMinTime;
  const mouseTimestamp = viewMinTime + (mousePct * currentDuration);
  const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
  let newDuration = Math.max(300, currentDuration * zoomFactor); 
  if (newDuration > 86400) newDuration = 86400;
  viewMinTime = mouseTimestamp - (mousePct * newDuration);
  viewMaxTime = viewMinTime + newDuration;
  if (viewMinTime < dayStartMinTime) { viewMinTime = dayStartMinTime; viewMaxTime = viewMinTime + newDuration; }
  if (viewMaxTime > dayMaxEndTime) { viewMaxTime = dayMaxEndTime; viewMinTime = viewMaxTime - newDuration; }
  renderView();
}, { passive: false });

dom.container.addEventListener('contextmenu', e => e.preventDefault());

dom.container.addEventListener('mousedown', (e) => {
  const trackElement = document.querySelector('.row-track');
  const rect = trackElement.getBoundingClientRect();
  uiState.trackLeftOffset = rect.left;
  uiState.trackWidth = rect.width;

  if (e.target === dom.scrollThumb) {
    uiState.isScrollThumbDragging = true;
    uiState.scrollStartMouseX = e.clientX;
    uiState.scrollStartMinTime = viewMinTime;
  } 
  else if (e.button === 1) { 
    e.preventDefault();
    uiState.isPanning = true;
    uiState.panStartMouseX = e.clientX;
    uiState.panStartMinTime = viewMinTime;
    uiState.panStartMaxTime = viewMaxTime;
  } 
  else if (e.button === 0 && e.target.classList.contains('resize-handle')) {
    e.stopPropagation();
    resizingZoneIndex = parseInt(e.target.dataset.index, 10);
    resizingEdge = e.target.classList.contains('left') ? 'left' : 'right';
    
    const oldMenu = document.getElementById('rbm-context-menu');
    if (oldMenu) oldMenu.remove();
  }
  else if (e.button === 0 && e.clientX >= uiState.trackLeftOffset && e.clientX <= uiState.trackLeftOffset + uiState.trackWidth) {
    if (e.target.classList.contains('time-block') || e.target.classList.contains('drag-selection-inner')) return; 
    
    uiState.isTagDragging = true;
    
    // FIX: Normalize coordinate strictly relative to track content space (0 to trackWidth)
    const normalizedStartPx = e.clientX - uiState.trackLeftOffset;
    uiState.tagDragStartX = normalizedStartPx;
    
    const currentDuration = viewMaxTime - viewMinTime;
    const initialClickTimeSec = Math.round(viewMinTime + ((normalizedStartPx / uiState.trackWidth) * currentDuration));
    
    activeDragSelection.startSec = initialClickTimeSec;
    activeDragSelection.endSec = initialClickTimeSec;
    activeDragSelection.active = false; 

    if (!e.ctrlKey) {
      selections = [];
    }
    
    const oldMenu = document.getElementById('rbm-context-menu');
    if (oldMenu) oldMenu.remove();
    renderView();
  }

  else if (e.button === 2 && (selections.length > 0 || activeDragSelection.active)) {
    createCustomContextMenu(e.clientX, e.clientY);
  }
});

window.addEventListener('mousemove', (e) => {
  const currentDuration = viewMaxTime - viewMinTime;
  
  const trackElement = document.querySelector('.row-track');
  if (!trackElement) return;
  const rect = trackElement.getBoundingClientRect();
  const currentTrackLeftOffset = rect.left;
  const currentTrackWidth = rect.width;

  if (uiState.isScrollThumbDragging) {
    const deltaX = e.clientX - uiState.scrollStartMouseX;
    const trackRect = dom.scrollTrack.getBoundingClientRect();
    viewMinTime = uiState.scrollStartMinTime + ((deltaX / trackRect.width) * 86400);
    viewMaxTime = viewMinTime + currentDuration;
    if (viewMinTime < dayStartMinTime) { viewMinTime = dayStartMinTime; viewMaxTime = viewMinTime + currentDuration; }
    if (viewMaxTime > dayMaxEndTime) { viewMaxTime = dayMaxEndTime; viewMinTime = viewMaxTime - currentDuration; }
    renderView();
  } 
  else if (uiState.isPanning) {
    const timeDelta = ((e.clientX - uiState.panStartMouseX) / currentTrackWidth) * currentDuration;
    viewMinTime = uiState.panStartMinTime - timeDelta;
    viewMaxTime = uiState.panStartMaxTime - timeDelta;
    if (viewMinTime < dayStartMinTime) { viewMinTime = dayStartMinTime; viewMaxTime = viewMinTime + currentDuration; }
    if (viewMaxTime > dayMaxEndTime) { viewMaxTime = dayMaxEndTime; viewMinTime = viewMaxTime - currentDuration; }
    renderView();
  } 
  else if (resizingZoneIndex !== -1) {
    const currentX = Math.max(0, Math.min(e.clientX - currentTrackLeftOffset, currentTrackWidth));
    const targetTimeSec = Math.round(viewMinTime + ((currentX / currentTrackWidth) * currentDuration));
    const zone = selections[resizingZoneIndex];

    if (zone) {
      if (resizingEdge === 'left') {
        zone.startSec = Math.min(targetTimeSec, zone.endSec - 5);
      } else {
        zone.endSec = Math.max(targetTimeSec, zone.startSec + 5);
      }
      renderView();
    }
  }
  else if (uiState.isTagDragging) {
    const currentX = Math.max(0, Math.min(e.clientX - currentTrackLeftOffset, currentTrackWidth));
    const leftPx = Math.min(uiState.tagDragStartX, currentX);
    const rightPx = Math.max(uiState.tagDragStartX, currentX);
    
    activeDragSelection.startSec = Math.round(viewMinTime + ((leftPx / currentTrackWidth) * currentDuration));
    activeDragSelection.endSec = Math.round(viewMinTime + ((rightPx / currentTrackWidth) * currentDuration));
    activeDragSelection.active = Math.abs(rightPx - uiState.tagDragStartX) >= 5;
    
    renderView();
  }
});

window.addEventListener('mouseup', async (e) => {
  uiState.isScrollThumbDragging = false;
  if (uiState.isPanning && e.button === 1) uiState.isPanning = false;
  
  if (resizingZoneIndex !== -1 && e.button === 0) {
    resizingZoneIndex = -1;
    resizingEdge = null;
    mergeSelections(); 
    renderView();
  }
  
  if (uiState.isTagDragging && e.button === 0) {
    uiState.isTagDragging = false;
    if (activeDragSelection.active) {
      selections.push({ startSec: activeDragSelection.startSec, endSec: activeDragSelection.endSec });
      activeDragSelection.active = false;
      mergeSelections(); 
    }
    renderView();
  }
});

function createCustomContextMenu(mouseX, mouseY) {
  const oldMenu = document.getElementById('rbm-context-menu');
  if (oldMenu) oldMenu.remove();

  const menu = document.createElement('div');
  menu.id = 'rbm-context-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${mouseX}px`;
  menu.style.top = `${mouseY}px`;
  menu.style.zIndex = '1000';

  const timeInfo = document.createElement('div');
  timeInfo.className = 'menu-info';
  timeInfo.textContent = `Selected: ${selections.length} zone(s)`;
  menu.appendChild(timeInfo);

  const createOption = document.createElement('div');
  createOption.className = 'menu-item';
  createOption.textContent = '➕ Create Tags Here';
  createOption.addEventListener('click', async () => {
    menu.remove();
    const label = prompt(`Enter label for all ${selections.length} tags:`);
    if (label) {
      for (const zone of selections) {
        await ApiService.createTag(zone.startSec, zone.endSec, label);
      }
      await ApiService.getTimeline();
    }
    selections = [];
    renderView();
  });
  menu.appendChild(createOption);

  const cancelOption = document.createElement('div');
  cancelOption.className = 'menu-item cancel';
  cancelOption.textContent = '❌ Clear All Selections';
  cancelOption.addEventListener('click', () => {
    menu.remove();
    selections = [];
    renderView();
  });
  menu.appendChild(cancelOption);

  document.body.appendChild(menu);

  const dismissMenuHandler = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener('mousedown', dismissMenuHandler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', dismissMenuHandler), 10);
}

dom.scrollTrack.addEventListener('click', (e) => {
  if (e.target === dom.scrollThumb) return;
  const clickPct = (e.clientX - dom.scrollTrack.getBoundingClientRect().left) / dom.scrollTrack.getBoundingClientRect().width;
  const viewDuration = viewMaxTime - viewMinTime;
  viewMinTime = (dayStartMinTime + (clickPct * 86400)) - (viewDuration / 2);
  viewMaxTime = viewMinTime + viewDuration;
  if (viewMinTime < dayStartMinTime) { viewMinTime = dayStartMinTime; viewMaxTime = viewMinTime + viewDuration; }
  if (viewMaxTime > dayMaxEndTime) { viewMaxTime = dayMaxEndTime; viewMinTime = viewMaxTime - viewDuration; }
  renderView();
});

dom.formatToggle.addEventListener('click', () => {
  is24HourFormat = !is24HourFormat;
  dom.formatToggle.textContent = is24HourFormat ? "Switch to 12h" : "Switch to 24h";
  
  localStorage.setItem('is24HourFormat', is24HourFormat);
  renderView();
});

dom.themeToggle.addEventListener('click', () => {
  const isLight = document.documentElement.classList.toggle('light-theme');
  dom.themeToggle.textContent = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";
  
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  renderView();
});

(function applySavedTheme() {
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-theme');
    dom.themeToggle.textContent = "🌙 Dark Mode";
  } else {
    document.documentElement.classList.remove('light-theme');
    dom.themeToggle.textContent = "☀️ Light Mode";
  }
})();

initTimeline();