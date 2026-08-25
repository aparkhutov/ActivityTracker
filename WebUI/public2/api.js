let mockDataStorage = {
  "day": {
    "tags": [
      { "id": 1, "start": 1711871500, "end": 1711872900, "label": "aa" },
      { "id": 2, "start": 1711873000, "end": 1711875100, "label": "break" },
      { "id": 3, "start": 1711875000, "end": 1711879600, "label": "lunch" }
    ],
    "activity": [
      { "start": 1711872000, "end": 1711878000, "status": "worked" },
      { "start": 1711878000, "end": 1711879200, "status": "idle" },
      { "start": 1711879200, "end": 1711881000, "status": "worked" },
      { "start": 1711881000, "end": 1711882200, "status": "off" },
      { "start": 1711882800, "end": 1711890000, "status": "worked" },
      { "start": 1711890000, "end": 1711891800, "status": "worked" }
    ],
    "process": [
      { "start": 1711872000, "end": 1711875600, "name": "slack.exe" },
      { "start": 1711875600, "end": 1711881000, "name": "vs_code.exe" },
      { "start": 1711882800, "end": 1711890000, "name": "chrome.exe" },
      { "start": 1711890000, "end": 1711891800, "name": "zoom.exe" }
    ],
    "documents": [
      { "start": 1711872000, "end": 1711875600, "doc": "Workspace Chat" },
      { "start": 1711875600, "end": 1711881000, "doc": "index.html" },
      { "start": 1711882800, "end": 1711890000, "doc": "StackOverflow" },
      { "start": 1711890000, "end": 1711891800, "doc": "Daily Standup Meeting" }
    ]
  }
};

let localMockTagIdCounter = 4;
let isServerOnline = false;

window.timelineData = { day: { tags: [], activity: [], process: [], documents: [] } };

const ApiService = {
  async checkServerStatus() {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000); // Быстрый таймаут 1 сек
      const res = await fetch('/api/timeline', { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);
      isServerOnline = res.ok;
    } catch (err) {
      isServerOnline = false;
    }
  },
  async getTimeline() {
    if (isServerOnline) {
      try {
        const response = await fetch('/api/timeline');
        const data = await response.json();
        window.timelineData.day = data.day;
      } catch (err) {
        window.timelineData.day = mockDataStorage.day;
      }
    } else {
      window.timelineData.day = mockDataStorage.day;
    }
  },
  async createTag(startSec, endSec, label) {
    if (isServerOnline) {
      try {
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_in_seconds: startSec, end_in_seconds: endSec, label: label })
        });
      } catch (err) { console.error(err); }
    } else {
      mockDataStorage.day.tags.push({ id: localMockTagIdCounter++, start: startSec, end: endSec, label: label });
    }
  },
  async deleteTag(id) {
    if (isServerOnline) {
      try {
        await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      } catch (err) { console.error(err); }
    } else {
      mockDataStorage.day.tags = mockDataStorage.day.tags.filter(t => t.id !== id);
    }
  }
};
