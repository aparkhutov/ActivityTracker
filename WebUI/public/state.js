let is24HourFormat = localStorage.getItem('is24HourFormat') !== 'false';
const dayStartMinTime = 0;
const dayMaxEndTime = 86400;
let viewMinTime = 0;
let viewMaxTime = 86400;
let selections = []; 
let activeDragSelection = { startSec: 0, endSec: 0, active: false };

const uiState = {
  isTagDragging: false,
  tagDragStartX: 0,
  isPanning: false,
  panStartMouseX: 0,
  panStartMinTime: 0,
  panStartMaxTime: 0,
  isScrollThumbDragging: false,
  scrollStartMouseX: 0,
  scrollStartMinTime: 0,
  trackLeftOffset: 0,
  trackWidth: 0
};

const formatter12 = new Intl.DateTimeFormat([], {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC'
});

const formatter24 = new Intl.DateTimeFormat([], {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC'
});

function formatHourText(timestampSec) {
  if (is24HourFormat)
    return formatter24.format(new Date(timestampSec * 1000));
  else 
    return formatter12.format(new Date(timestampSec * 1000));
}
