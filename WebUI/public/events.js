let resizingZoneIndex = -1;
let resizingEdge = null;

// Safe range merging using seconds of the day (0-86400)
function mergeSelections() {
  if (selections.length <= 1) 
    return;
  selections.sort((a, b) => Number(a.startSec) - Number(b.startSec));
  
  const merged = [];
  merged.push({ startSec: selections[0].startSec, endSec: selections[0].endSec });
  for (let i = 1; i < selections.length; i++) {
    const current = selections[i];
    const lastMerged = merged[merged.length - 1];
    if (current.startSec <= lastMerged.endSec) 
      lastMerged.endSec = Math.max(lastMerged.endSec, current.endSec);
    else 
      merged.push({ startSec: current.startSec, endSec: current.endSec });
  }
  selections = merged;
}

// Cursor hover line sync
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

// Zoom timeline via mouse wheel inside 0 - 86400 boundaries
dom.container.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = dom.tagTrack.getBoundingClientRect();
  const mousePct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
  const currentDuration = viewMaxTime - viewMinTime;
  const mouseTimestamp = viewMinTime + (mousePct * currentDuration);
  const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
  
  let newDuration = Math.max(300, currentDuration * zoomFactor); 
  if (newDuration > 86400) 
    newDuration = 86400;

  viewMinTime = mouseTimestamp - (mousePct * newDuration);
  viewMaxTime = viewMinTime + newDuration;

  if (viewMinTime < dayStartMinTime) {
    viewMinTime = dayStartMinTime;
    viewMaxTime = viewMinTime + newDuration;
  }
  if (viewMaxTime > dayMaxEndTime) {
    viewMaxTime = dayMaxEndTime;
    viewMinTime = viewMaxTime - newDuration;
  }
  
  renderView();
}, { passive: false });

dom.container.addEventListener('contextmenu', e => e.preventDefault());

dom.container.addEventListener('mousedown', (e) => {
  const trackElement = document.querySelector('.row-track');
  if (!trackElement) 
    return;
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
    if (oldMenu) 
      oldMenu.remove();
  }
  else if (e.button === 0 && e.clientX >= uiState.trackLeftOffset && e.clientX <= uiState.trackLeftOffset + uiState.trackWidth) {
    if (e.target.classList.contains('time-block') || e.target.classList.contains('drag-selection-inner')) 
      return; 
    e.preventDefault();
    uiState.isTagDragging = true;
    
    const normalizedStartPx = e.clientX - uiState.trackLeftOffset;
    uiState.tagDragStartX = normalizedStartPx;
    
    const currentDuration = viewMaxTime - viewMinTime;
    const initialClickTimeSec = Math.round(viewMinTime + ((normalizedStartPx / uiState.trackWidth) * currentDuration));
    
    activeDragSelection.startSec = initialClickTimeSec;
    activeDragSelection.endSec = initialClickTimeSec;
    activeDragSelection.active = false; 
    
    if (!e.ctrlKey) 
      selections = [];
    
    const oldMenu = document.getElementById('rbm-context-menu');
    if (oldMenu) 
      oldMenu.remove();
    renderView();
  }
  else if (e.button === 2 && (selections.length > 0 || activeDragSelection.active)) {
    createCustomContextMenu(e.clientX, e.clientY);
  }
});

window.addEventListener('mousemove', (e) => {
  const currentDuration = viewMaxTime - viewMinTime;
  const trackElement = document.querySelector('.row-track');
  if (!trackElement) 
    return;
  const rect = trackElement.getBoundingClientRect();
  const currentTrackLeftOffset = rect.left;
  const currentTrackWidth = rect.width;

  const hintBlock = document.getElementById('drag-hint-range');
  if (uiState.isTagDragging && activeDragSelection.active) {
    const duration = activeDragSelection.endSec - activeDragSelection.startSec;
    const durationText = duration >= 60 
      ? `${Math.floor(duration / 60)}m ${duration % 60}s` 
      : `${duration}s`;
    
    const textHint = `Selected Range: ${formatHourText(activeDragSelection.startSec)} - ${formatHourText(activeDragSelection.endSec)} (${durationText})`;
    
    if (hintBlock) 
      hintBlock.textContent = textHint;
    else {
      const hintDiv = document.createElement('div');
      hintDiv.id = 'drag-hint-range';
      hintDiv.textContent = textHint;
      document.querySelector('.controls-toolbar').appendChild(hintDiv);
    }
  }

  if (uiState.isScrollThumbDragging) {
    const deltaX = e.clientX - uiState.scrollStartMouseX;
    const trackRect = dom.scrollTrack.getBoundingClientRect();
    viewMinTime = uiState.scrollStartMinTime + ((deltaX / trackRect.width) * 86400);
    viewMaxTime = viewMinTime + currentDuration;
    
    if (viewMinTime < dayStartMinTime) {
      viewMinTime = dayStartMinTime;
      viewMaxTime = viewMinTime + currentDuration;
    } else if (viewMaxTime > dayMaxEndTime) {
      viewMaxTime = dayMaxEndTime;
      viewMinTime = viewMaxTime - currentDuration;
    }
    renderView();
  } 
  else if (uiState.isPanning) {
    const timeDelta = ((e.clientX - uiState.panStartMouseX) / currentTrackWidth) * currentDuration;
    viewMinTime = uiState.panStartMinTime - timeDelta;
    viewMaxTime = uiState.panStartMaxTime - timeDelta;
    
    if (viewMinTime < dayStartMinTime) {
      viewMinTime = dayStartMinTime;
      viewMaxTime = viewMinTime + currentDuration;
    } else if (viewMaxTime > dayMaxEndTime) {
      viewMaxTime = dayMaxEndTime;
      viewMinTime = viewMaxTime - currentDuration;
    }
    renderView();
  } 
  else if (resizingZoneIndex !== -1) {
    const currentX = Math.max(0, Math.min(e.clientX - currentTrackLeftOffset, currentTrackWidth));
    const targetTimeSec = Math.round(viewMinTime + ((currentX / currentTrackWidth) * currentDuration));
    const zone = selections[resizingZoneIndex];
    if (zone) {
      if (resizingEdge === 'left') 
        zone.startSec = Math.min(targetTimeSec, zone.endSec - 5);
      else 
        zone.endSec = Math.max(targetTimeSec, zone.startSec + 5);
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

// Global mouseup handler to finalize dragging and scaling processes
window.addEventListener('mouseup', async (e) => {
  uiState.isScrollThumbDragging = false;
  if (uiState.isPanning && e.button === 1) 
    uiState.isPanning = false;
  
  // Clean up experimental Selected Range text hint when selection ends
  const hintBlock = document.getElementById('drag-hint-range');
  if (hintBlock) 
    hintBlock.remove();

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

// Custom right-click context menu creation for active selections
function createCustomContextMenu(mouseX, mouseY) {
  const oldMenu = document.getElementById('rbm-context-menu');
  if (oldMenu) 
    oldMenu.remove();
    
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
    }
    selections = [];
    await initTimeline();
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

// Click on scroll track to center view window quickly
dom.scrollTrack.addEventListener('click', (e) => {
  if (e.target === dom.scrollThumb) 
    return;
  const clickPct = (e.clientX - dom.scrollTrack.getBoundingClientRect().left) / dom.scrollTrack.getBoundingClientRect().width;
  const viewDuration = viewMaxTime - viewMinTime;
  viewMinTime = (dayStartMinTime + (clickPct * 86400)) - (viewDuration / 2);
  viewMaxTime = viewMinTime + viewDuration;
  
  if (viewMinTime < dayStartMinTime) {
    viewMinTime = dayStartMinTime;
    viewMaxTime = viewMinTime + viewDuration;
  } else if (viewMaxTime > dayMaxEndTime) {
    viewMaxTime = dayMaxEndTime;
    viewMinTime = viewMaxTime - viewDuration;
  }
  renderView();
});

// Open settings modal and fill fields with active state data
dom.settingsOpenBtn.addEventListener('click', async () => {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  const is24 = localStorage.getItem('is24HourFormat') !== 'false';
  const currentFormat = is24 ? '24h' : '12h';
  const serverSettings = await ApiService.getBackendSettings();

  dom.settingsTheme.value = currentTheme;
  dom.settingsFormat.value = currentFormat;
  dom.settingsIdle.value = serverSettings.idle;

  dom.settingsOverlay.style.display = 'flex';
});

// Close settings modal immediately on cancel action
dom.settingsCancelBtn.addEventListener('click', () => {
  dom.settingsOverlay.style.display = 'none';
});

// Save settings from modal fields, apply configurations and upload to backend
dom.settingsSaveBtn.addEventListener('click', async () => {
  const chosenTheme = dom.settingsTheme.value;
  const chosenFormat = dom.settingsFormat.value;
  const chosenIdle = parseInt(dom.settingsIdle.value, 10) || 10;

  // 1. Apply and save theme via classList.toggle with boolean argument
  localStorage.setItem('theme', chosenTheme);
  document.documentElement.classList.toggle('light-theme', chosenTheme === 'light');

  // 2. Apply and save time format configuration
  is24HourFormat = chosenFormat === '24h';
  localStorage.setItem('is24HourFormat', is24HourFormat ? 'true' : 'false');

  // 3. Save idle threshold to backend profile
  await ApiService.saveBackendSettings({ idle: chosenIdle });

  // 4. Hide modal and fully refresh timeline layout
  dom.settingsOverlay.style.display = 'none';
  await initTimeline();
});

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.toggle('light-theme', savedTheme === 'light');

// Initialize application state workflow
initTimeline();
