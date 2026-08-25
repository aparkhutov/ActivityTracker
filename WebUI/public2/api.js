let mockDataStorage = {
  "data": {
    "date": "2026-08-26",
    "tags": [
      { "id": 1, "start": 28800, "end": 36000, "label": "morning sync" },
      { "id": 2, "start": 43200, "end": 54600, "label": "rdp development" }
    ],
    "activity": [
      { "start": 28800, "end": 36000, "status": "console" },
      { "start": 36000, "end": 38280, "status": "console-idle" },
      { "start": 38280, "end": 38700, "status": "console" },
      { "start": 38700, "end": 43200, "status": "off" },
      { "start": 43200, "end": 54600, "status": "rdp" },
      { "start": 54600, "end": 56220, "status": "rdp-idle" },
      { "start": 56220, "end": 60000, "status": "rdp" },
      { "start": 60000, "end": 86400, "status": "off" }
    ],
    "process": [
      { "start": 28800, "end": 36000, "name": "slack.exe" },
      { "start": 38280, "end": 38700, "name": "cmd.exe" },
      { "start": 43200, "end": 54600, "name": "code.exe" },
      { "start": 56220, "end": 60000, "name": "chrome.exe" }
    ],
    "documents": [
      { "start": 28800, "end": 36000, "doc": "Workspace Chat" },
      { "start": 38280, "end": 38700, "doc": "Build Script" },
      { "start": 43200, "end": 54600, "doc": "index.html" },
      { "start": 56220, "end": 60000, "doc": "StackOverflow Thread" }
    ]
  }
};

let localMockTagIdCounter = Math.max(...mockDataStorage.data.tags.map(t => t.id), 0) + 1;
let isServerOnline = false;

window.timelineData = {
  data: { date: "", tags: [], activity: [], process: [], documents: [] }
};

const ApiService = {
  async checkServerStatus() {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch('/api/timeline', { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);
      isServerOnline = res.ok;
    } catch (err) {
      isServerOnline = false;
    }
  },

  async getTimeline(date, idle, from = 0) {
    if (isServerOnline) {
      try {
        const url = `/api/timeline?date=${date}&idle=${idle}&from=${from}`;
        const response = await fetch(url);
        const json = await response.json();
        window.timelineData.data = json.data;
      } catch (err) {
        this.getMockTimeline(date, from);
      }
    } else {
      this.getMockTimeline(date, from);
    }
  },

  getMockTimeline(date, from) {
    if (date !== mockDataStorage.data.date) {
      window.timelineData.data = { date: date, tags: [], activity: [], process: [], documents: [] };
      return;
    }

    const src = mockDataStorage.data;
    const filterFn = (item) => item.end > from;

    window.timelineData.data = {
      date: src.date,
      tags: src.tags.filter(filterFn),
      activity: src.activity.filter(filterFn),
      process: src.process.filter(filterFn),
      documents: src.documents.filter(filterFn)
    };
  },

  async createTag(startSec, endSec, label) {
    if (isServerOnline) {
      try {
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_in_seconds: startSec, end_in_seconds: endSec, label: label })
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      mockDataStorage.data.tags.push({
        id: localMockTagIdCounter++,
        start: startSec,
        end: endSec,
        label: label
      });
    }
  },

  async deleteTag(id) {
    if (isServerOnline) {
      try {
        await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error(err);
      }
    } else {
      mockDataStorage.data.tags = mockDataStorage.data.tags.filter(t => t.id !== id);
    }
  }
};
