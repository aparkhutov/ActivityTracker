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

function formatHourText(timestampSec) {
  const formatter = new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !is24HourFormat,
    timeZone: 'UTC'
  });
  return formatter.format(new Date(timestampSec * 1000));
}
