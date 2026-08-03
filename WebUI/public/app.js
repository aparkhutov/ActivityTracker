// Status Chart Application
class StatusChart {
  constructor() {
    this.data = null;
    this.stats = null;
    this.tags = [];
    this.totalP = 0;
    this.totalD = 0;
    this.init();
    this.setupEventListeners();
  }

  async init() {
    try {
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showError();
    }
  }

  async loadData() {
    const response = await fetch('/data.json');
    if (!response.ok) {
      throw new Error('HTTP error! status: ' + response.status);
    }
    const json = await response.json();
    this.data = json.data;
    this.stats = json.stats;
    this.total = json.total;
    this.totalP = json.totalP || 0;
    this.totalD = json.totalD || 0;
    this.tags = json.tags || [];
  }

  setupEventListeners() {
    document.getElementById('tagForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveTag();
    });

    document.getElementById('clearTagBtn').addEventListener('click', () => {
      this.clearForm();
    });

    document.getElementById('deleteTagBtn').addEventListener('click', async () => {
      await this.deleteTag();
    });

    // Click on tag item to fill form
    document.addEventListener('click', (e) => {
      const tagItem = e.target.closest('.tag-item');
      if (tagItem && tagItem.dataset.start) {
        const start = parseInt(tagItem.dataset.start);
        this.fillFormFromTag(start);
      }
    });
  }

  fillFormFromTag(start) {
    const tag = this.tags.find(function (t) { return t.start === start; });
    if (!tag) return;

    document.getElementById('tagStart').value = tag.start;
    document.getElementById('tagDuration').value = tag.duration;
    document.getElementById('tagName').value = tag.name;
  }

  clearForm() {
    document.getElementById('tagForm').reset();
    document.getElementById('tagMessage').style.display = 'none';
    document.getElementById('tagMessage').className = 'tag-message';
  }

  async saveTag() {
    const start = parseInt(document.getElementById('tagStart').value);
    const duration = parseInt(document.getElementById('tagDuration').value);
    const name = document.getElementById('tagName').value.trim();

    if (isNaN(start) || start < 0) {
      this.showMessage('Please enter a valid start position', 'error');
      return;
    }

    if (isNaN(duration) || duration < 1) {
      this.showMessage('Please enter a valid duration (min 1)', 'error');
      return;
    }

    const tagData = {
      start: start,
      duration: duration,
      name: name || 'Tag'
    };

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagData)
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage('Tag saved successfully!', 'success');
        await this.loadData();
        this.render();
        setTimeout(function () { this.clearForm(); }.bind(this), 2000);
      } else {
        this.showMessage('Error: ' + result.message, 'error');
      }
    } catch (error) {
      this.showMessage('Error saving tag: ' + error.message, 'error');
    }
  }

  async deleteTag() {
    const start = parseInt(document.getElementById('tagStart').value);
    if (isNaN(start)) {
      this.showMessage('Please select a tag to delete', 'error');
      return;
    }

    if (!confirm('Delete tag at position ' + start + '?')) return;

    try {
      const response = await fetch('/api/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: start })
      });

      const result = await response.json();

      if (result.success) {
        this.showMessage('Tag deleted successfully!', 'success');
        await this.loadData();
        this.render();
        setTimeout(function () { this.clearForm(); }.bind(this), 2000);
      } else {
        this.showMessage('Error: ' + result.message, 'error');
      }
    } catch (error) {
      this.showMessage('Error deleting tag: ' + error.message, 'error');
    }
  }

  showMessage(text, type) {
    const msg = document.getElementById('tagMessage');
    msg.textContent = text;
    msg.className = 'tag-message ' + type;
    msg.style.display = 'block';
  }

  render() {
    this.renderLegend();
    this.renderTagRow();
    this.renderChart();
    this.renderStats();
    this.renderTable();
    this.renderTagsTable();
  }

  renderLegend() {
    document.getElementById('totalSegments').textContent = 'Total: ' + this.total;
  }

  renderTagRow() {
    const tagRow = document.getElementById('tagRow');
    tagRow.innerHTML = '';

    if (this.tags.length === 0) {
      tagRow.innerHTML = '<div class="tag-placeholder">No tags - add a tag using the form below</div>';
      return;
    }

    const totalP = this.totalP || this.totalD;
    if (totalP === 0) {
      tagRow.innerHTML = '<div class="tag-placeholder">No data loaded</div>';
      return;
    }

    // Create tag items based on position
    this.tags.forEach(function (tag) {
      const startPercent = (tag.start / totalP) * 100;
      const durationPercent = (tag.duration / totalP) * 100;

      const tagItem = document.createElement('div');
      tagItem.className = 'tag-item';
      tagItem.style.flex = durationPercent;
      tagItem.style.marginLeft = startPercent + '%';
      tagItem.style.position = 'relative';
      tagItem.dataset.start = tag.start;

      tagItem.innerHTML =
        '<span class="tag-name">' + tag.name + '</span>' +
        '<span class="tag-range">' + tag.start + '-' + (tag.start + tag.duration) + '</span>' +
        '<div class="tag-tooltip">' +
        'Start: ' + tag.start + ' | Duration: ' + tag.duration + ' | Name: ' + tag.name +
        '</div>';

      tagRow.appendChild(tagItem);
    }.bind(this));
  }

  renderChart() {
    const chartElement = document.getElementById('chart');
    chartElement.innerHTML = '';

    const totalD = this.data.reduce(function (sum, item) { return sum + item.d; }, 0);

    this.data.forEach(function (item) {
      const segment = document.createElement('div');
      const percent = totalD > 0 ? (item.d * 100 / totalD) : 0;
      const flexValue = Math.max(percent, 1);

      segment.className = 'segment ' + (item.status === 1 ? 'green' : 'red');
      segment.style.flex = flexValue;

      segment.innerHTML =
        '<span>' + item.d + '</span>' +
        '<div class="tooltip">' +
        'p=' + item.p + ' | d=' + item.d + ' | ' + (item.status === 1 ? 'Active' : 'Inactive') +
        '</div>';

      chartElement.appendChild(segment);
    });
  }

  renderStats() {
    const statsElement = document.getElementById('stats');
    const taggedCount = this.tags.length;

    statsElement.innerHTML =
      '<div>' +
      '<div class="number green">' + this.stats.active + '</div>' +
      '<div class="label">Active</div>' +
      '</div>' +
      '<div>' +
      '<div class="number red">' + this.stats.inactive + '</div>' +
      '<div class="label">Inactive</div>' +
      '</div>' +
      '<div>' +
      '<div class="number">' + this.total + '</div>' +
      '<div class="label">Segments</div>' +
      '</div>' +
      '<div>' +
      '<div class="number orange">' + taggedCount + '</div>' +
      '<div class="label">Tags</div>' +
      '</div>';
  }

  renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    this.data.forEach(function (item) {
      const row = document.createElement('tr');
      const statusText = item.status === 1 ? 'Active' : 'Inactive';
      const statusClass = item.status === 1 ? 'status-active' : 'status-inactive';

      row.innerHTML =
        '<td>' + item.index + '</td>' +
        '<td>' + item.p + '</td>' +
        '<td>' + item.d + '</td>' +
        '<td class="' + statusClass + '">' + statusText + '</td>';

      tbody.appendChild(row);
    }.bind(this));
  }

  renderTagsTable() {
    const tbody = document.getElementById('tagsTableBody');
    tbody.innerHTML = '';

    if (this.tags.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">No tags defined</td></tr>';
      return;
    }

    this.tags.forEach(function (tag) {
      const row = document.createElement('tr');

      row.innerHTML =
        '<td>' + tag.start + '</td>' +
        '<td>' + tag.duration + '</td>' +
        '<td class="tag-name-cell">' + tag.name + '</td>' +
        '<td><button class="delete-tag-btn" data-start="' + tag.start + '">Delete</button></td>';

      // Click on row to edit
      row.style.cursor = 'pointer';
      row.addEventListener('click', function (e) {
        if (e.target.tagName !== 'BUTTON') {
          this.fillFormFromTag(tag.start);
        }
      }.bind(this));

      // Delete button
      const deleteBtn = row.querySelector('.delete-tag-btn');
      deleteBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        if (confirm('Delete tag "' + tag.name + '" at position ' + tag.start + '?')) {
          document.getElementById('tagStart').value = tag.start;
          await this.deleteTag();
        }
      }.bind(this));

      tbody.appendChild(row);
    }.bind(this));
  }

  showError() {
    document.getElementById('chart').innerHTML =
      '<div class="loading" style="color: #e53935;">' +
      '<p>Failed to load data</p>' +
      '<p style="font-size: 12px;">Please check if the server is running</p>' +
      '</div>';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  new StatusChart();
});