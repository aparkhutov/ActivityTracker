const dom = {
  tagTrack: document.getElementById('track-tags'),
  gridOverlay: document.getElementById('grid-overlay'),
  hoverLine: document.getElementById('hover-line'),
  container: document.getElementById('timeline-container'),
  scrollTrack: document.getElementById('scrollbar-track'),
  scrollThumb: document.getElementById('scrollbar-thumb'),
  header: document.getElementById('timeline-header'),
  dragSelectionContainer: document.getElementById('drag-selection-container'),
  settingsOpenBtn: document.getElementById('settings-open-btn'),
  settingsOverlay: document.getElementById('settings-modal-overlay'),
  settingsCancelBtn: document.getElementById('settings-cancel-btn'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsTheme: document.getElementById('settings-theme'),
  settingsFormat: document.getElementById('settings-time-format'),
  settingsIdle: document.getElementById('settings-idle-threshold')
};

async function initTimeline() {
  await ApiService.checkServerStatus();
  
  const settings = await ApiService.getBackendSettings();
  const currentIdle = settings.idle;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const currentDateStr = `${yyyy}-${mm}-${dd}`;
  
  await ApiService.getTimeline(currentDateStr, currentIdle, 0); 
  
  const lines = window.timelineData.data;
  const timestamps = [];
  
  if (lines) {
    ['tags', 'activity', 'process', 'documents'].forEach(key => {
      if (lines[key]) {
        lines[key].forEach(item => {
          timestamps.push(item.start);
          if (item.end)
            timestamps.push(item.end);
        });
      }
    });
  }
  
  if (timestamps.length === 0) {
    viewMinTime = 0;
    viewMaxTime = 86400;
  } else {
    const absoluteFirstSec = Math.min(...timestamps);
    const absoluteLastSec = Math.max(...timestamps);
    
    viewMinTime = Math.max(dayStartMinTime, absoluteFirstSec - 3600);
    viewMaxTime = Math.min(dayMaxEndTime, absoluteLastSec + 3600);
    
    if (viewMaxTime - viewMinTime < 28800)
      viewMaxTime = Math.min(dayMaxEndTime, viewMinTime + 28800);
  }
  
  if (lines && lines.date) {
    const baseDate = new Date(lines.date);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dom.header.textContent = `Activity Tracker Timeline — ${baseDate.toLocaleDateString('en-US', options)}`;
  }
  
  renderView();
}

function renderView() {
  const lines = window.timelineData.data;
  if (!lines)
    return;

  const tracks = ['tags', 'activity', 'process', 'documents'];
  for (let i = 0; i < tracks.length; i++) {
    const track = document.getElementById(`track-${tracks[i]}`);
    if (track) 
      track.innerHTML = '';
  }
  
  buildVerticalGrid();
  updateScrollbarThumb();
  updateDragSelectionPosition();
  
  if (lines.tags) 
    lines.tags.forEach(t => createBlock('tags', t.start, t.end, t.label, 'tag', t.id));
    
  if (lines.activity) 
    lines.activity.forEach(a => createBlock('activity', a.start, a.end, a.status, a.status, a.start));
    
  if (lines.process) 
    lines.process.forEach(p => createBlock('process', p.start, p.end, p.name, 'process', p.start));
    
  if (lines.documents) 
    lines.documents.forEach(d => createBlock('documents', d.start, d.end, d.doc || '[No Document]', 'documents', d.start));
}

function buildVerticalGrid() {
  dom.gridOverlay.innerHTML = '';
  const currentDuration = viewMaxTime - viewMinTime;
 
  let interval = 3600; 
  if (currentDuration < 7200) interval = 600; 
  else if (currentDuration < 18000) interval = 1800; 
 
  const firstMarkerSec = Math.ceil(viewMinTime / interval) * interval; 
 
  for (let markerSec = firstMarkerSec; markerSec <= viewMaxTime; markerSec += interval) {
    const leftPct = ((markerSec - viewMinTime) / currentDuration) * 100;
    if (leftPct < 0 || leftPct > 100) continue;
    const marker = document.createElement('div');
    marker.className = 'grid-marker';
    marker.style.left = `${leftPct}%`;
    const timeLabel = document.createElement('div');
    timeLabel.className = 'grid-label';
    timeLabel.textContent = formatHourText(markerSec);
 
    marker.appendChild(timeLabel);
    dom.gridOverlay.appendChild(marker);
  }
}

function createBlock(trackKey, start, end, label, className, nativeId) {
  const currentDuration = viewMaxTime - viewMinTime;
  if (end < viewMinTime || start > viewMaxTime)
    return;
  const visibleStart = Math.max(start, viewMinTime);
  const visibleEnd = Math.min(end, viewMaxTime);
  const leftPct = ((visibleStart - viewMinTime) / currentDuration) * 100;
  const widthPct = ((visibleEnd - visibleStart) / currentDuration) * 100;
  const track = document.getElementById(`track-${trackKey}`);
  if (!track)
    return;
  const block = document.createElement('div');
  block.className = `time-block ${className}`;
  block.style.left = `${leftPct}%`;
  block.style.width = `calc(${widthPct}% - 2px)`; 
  block.textContent = label;
  
  // Dynamic tracking with global body-level mounting strategy
  block.addEventListener('mousemove', (e) => {
    let tooltip = document.body.querySelector('.custom-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip';
      document.body.appendChild(tooltip);
    }
    
    // 1. Calculate exact time under cursor inside track bounds
    const trackElement = document.querySelector('.row-track');
    if (!trackElement)
      return;
    
    const trackRect = trackElement.getBoundingClientRect();
    const mouseXPct = (e.clientX - trackRect.left) / trackRect.width;
    const currentMouseSec = Math.max(0, Math.min(86400, Math.round(viewMinTime + (mouseXPct * currentDuration))));
    
    // 2. Format international text blocks for standard tracking items
    const timeCursorText = formatHourText(currentMouseSec);
    const blockRangeText = `${formatHourText(start)} - ${formatHourText(end)}`;
    
    let displayLabel = label;
    if (trackKey === 'activity') {
      if (label === 'console') displayLabel = 'Local Activity (Active input)';
      else if (label === 'console-idle') displayLabel = 'Local Idle (No input detected)';
      else if (label === 'rdp') displayLabel = 'Remote RDP Session (Active input)';
      else if (label === 'rdp-idle') displayLabel = 'Remote Idle (Session suspended)';
      else if (label === 'off') displayLabel = 'Session Locked (PC asleep / Off)';
    }
    
    let htmlContent = `
      <div class="tooltip-time-cursor">${timeCursorText}</div>
      <div class="tooltip-time-range">${blockRangeText}</div>
      <div class="tooltip-label-name">${displayLabel}</div>
    `;
    
    // 3. Process track exclusive logic: look up active document under cursor
    if (trackKey === 'process' && window.timelineData && window.timelineData.data && window.timelineData.data.documents) {
      const activeDoc = window.timelineData.data.documents.find(d => 
        currentMouseSec >= d.start && currentMouseSec <= d.end
      );
      if (activeDoc) {
        const docRangeText = `${formatHourText(activeDoc.start)} - ${formatHourText(activeDoc.end)}`;
        htmlContent += `
          <div class="tooltip-time-range doc-split">${docRangeText}</div>
          <div class="tooltip-label-name">${activeDoc.doc || '[No Document]'}</div>
        `;
      }
    }
    
    tooltip.innerHTML = htmlContent;
    
    // 4. Absolute position assignment relative to document viewport bounds
    const targetLeft = e.clientX + window.scrollX;
    const targetTop = e.clientY + window.scrollY;
    
    tooltip.style.left = `${targetLeft}px`;
    tooltip.style.top = `${targetTop}px`;
  });
  
  block.addEventListener('mouseleave', () => {
    const tooltip = document.body.querySelector('.custom-tooltip');
    if (tooltip)
      tooltip.remove();
  });
  
  if (trackKey === 'tags') {
    block.addEventListener('dblclick', async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this tag?"))
        return;
      
      await ApiService.deleteTag(nativeId);
      await initTimeline();
    });
  }
  track.appendChild(block);
}

function updateScrollbarThumb() {
  const totalDayRange = dayMaxEndTime - dayStartMinTime;
  if (totalDayRange <= 0) return;
  
  const currentViewRange = viewMaxTime - viewMinTime;
  const widthPct = (currentViewRange / totalDayRange) * 100;
  const leftPct = ((viewMinTime - dayStartMinTime) / totalDayRange) * 100;
  
  if (dom.scrollThumb) {
    dom.scrollThumb.style.width = `${Math.max(2, Math.min(widthPct, 100))}%`;
    dom.scrollThumb.style.left = `${Math.max(0, Math.min(leftPct, 100))}%`;
  }
  
  const oldBars = dom.scrollTrack.querySelectorAll('.scroller-activity-bar');
  oldBars.forEach(bar => bar.remove());
  
  const lines = window.timelineData.data;
  if (lines && lines.activity) {
    lines.activity.forEach(act => {
      if (act.status === 'worked') {
        const bar = document.createElement('div');
        bar.className = 'scroller-activity-bar';
        const barLeftPct = ((act.start - dayStartMinTime) / totalDayRange) * 100;
        const barWidthPct = ((act.end - act.start) / totalDayRange) * 100;
        bar.style.left = `${Math.max(0, Math.min(barLeftPct, 100))}%`;
        bar.style.width = `${Math.max(0.5, Math.min(barWidthPct, 100))}%`; 
        dom.scrollTrack.appendChild(bar);
      }
    });
  }
}

// FIX: Resetting positioning mapping calculation arrays to clean percentage layout logic
function updateDragSelectionPosition() {
  if (!dom.dragSelectionContainer) return;
  dom.dragSelectionContainer.innerHTML = '';
  const currentDuration = viewMaxTime - viewMinTime;

  selections.forEach((zone, index) => {
    if (zone.endSec < viewMinTime || zone.startSec > viewMaxTime) return;

    const visibleStart = Math.max(zone.startSec, viewMinTime);
    const visibleEnd = Math.min(zone.endSec, viewMaxTime);
    
    const leftPct = ((visibleStart - viewMinTime) / currentDuration) * 100;
    const widthPct = ((visibleEnd - visibleStart) / currentDuration) * 100;

    const block = document.createElement('div');
    block.className = 'drag-selection-inner';
    
    // Clean pure percentages assignment relative to container width box bounds
    block.style.left = `${leftPct}%`;
    block.style.width = `${widthPct}%`;

    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle left';
    leftHandle.dataset.index = index;

    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle right';
    rightHandle.dataset.index = index;

    block.appendChild(leftHandle);
    block.appendChild(rightHandle);
    dom.dragSelectionContainer.appendChild(block);
  });

  if (activeDragSelection.active) {
    if (activeDragSelection.endSec < viewMinTime || activeDragSelection.startSec > viewMaxTime) return;

    const visibleStart = Math.max(activeDragSelection.startSec, viewMinTime);
    const visibleEnd = Math.min(activeDragSelection.endSec, viewMaxTime);
    
    const leftPct = ((visibleStart - viewMinTime) / currentDuration) * 100;
    const widthPct = ((visibleEnd - visibleStart) / currentDuration) * 100;

    const block = document.createElement('div');
    block.className = 'drag-selection-inner';
    block.style.left = `${leftPct}%`;
    block.style.width = `${widthPct}%`;

    dom.dragSelectionContainer.appendChild(block);
  }
}
