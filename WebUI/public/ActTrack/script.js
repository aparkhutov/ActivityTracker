let activeDate = "2026-09-08";
let selectedRowType = "tags"; 
let checkedLeftIndices = new Set();
let currentSortField = null; 
let currentSortOrder = 'asc';

function renderTimeScale() {
    const scaleContainer = document.getElementById('time-scale');
    scaleContainer.innerHTML = '';
    const spacer = document.createElement('div');
    spacer.style.width = '120px';
    spacer.style.minWidth = '120px';
    scaleContainer.appendChild(spacer);

    for (let h = 0; h <= 24; h += 2) {
        const tick = document.createElement('div');
        tick.className = 'time-tick';
        tick.innerText = `${String(h).padStart(2, '0')}:00:00`;
        tick.style.left = `calc(120px + ${(h / 24) * 100}% - ${(h / 24) * 120}px)`;
        scaleContainer.appendChild(tick);
    }
}

function renderRow(rowId, blocks, typeClassPrefix) {
    const container = document.getElementById(rowId);
    container.innerHTML = '';
    if (!blocks) return;

    blocks.forEach(block => {
        const element = document.createElement('div');
        element.className = 'timeline-block';
        if (typeClassPrefix === 'bg-act') {
            element.classList.add(`bg-act-${block.name}`);
        } else if (typeClassPrefix === 'dynamic-doc') {
            element.classList.add('is-document');
            element.style.backgroundColor = window.getDocumentColor(block.name);
        } else {
            element.classList.add(typeClassPrefix);
        }
        element.style.left = `${block.start * 100}%`;
        element.style.width = `${(block.end - block.start) * 100}%`;
        element.innerText = block.name;
        container.appendChild(element);
    });
}

function updateAll() {
    const currentBlocks = window.mockData[activeDate]?.[selectedRowType] || [];
    window.renderDashboard(currentBlocks, selectedRowType, checkedLeftIndices, currentSortField, currentSortOrder, handleCheckboxChange);
    updateSortHeaders();
}

function handleCheckboxChange(side, target, isChecked, statsIndicesMap) {
    if (side === 'left') {
        if (isChecked) checkedLeftIndices.add(target);
        else checkedLeftIndices.delete(target);
    } else if (side === 'right') {
        const relatedIndices = statsIndicesMap[target] || [];
        relatedIndices.forEach(idx => {
            if (isChecked) checkedLeftIndices.add(idx);
            else checkedLeftIndices.delete(idx);
        });
    }
    updateAll();
}

function updateSortHeaders() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.getAttribute('data-sort') === currentSortField) {
            th.classList.add(currentSortOrder === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

function setupTableSorting() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (currentSortField === field) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = field;
                currentSortOrder = 'asc';
            }
            updateAll();
        });
    });
}

function setupRowSelection() {
    const rows = document.querySelectorAll('.timeline-row');
    const defaultRow = document.getElementById(`row-container-${selectedRowType}`);
    if (defaultRow) defaultRow.classList.add('is-selected');

    rows.forEach(row => {
        row.addEventListener('click', () => {
            const rowType = row.getAttribute('data-row-type');
            if (row.classList.contains('is-selected')) return;

            rows.forEach(r => r.classList.remove('is-selected'));
            row.classList.add('is-selected');
            
            selectedRowType = rowType;
            checkedLeftIndices.clear(); 
            currentSortField = null; // Сброс сортировки при смене полосы
            updateAll();
        });
    });
}

function loadTimeline(dateStr) {
    activeDate = dateStr;
    const data = window.mockData[dateStr];
    if (!data) return;

    renderRow('row-tags', data.tags, 'bg-tag');
    renderRow('row-activity', data.activity, 'bg-act');
    renderRow('row-apps', data.apps, 'bg-app');
    renderRow('row-docs', data.docs, 'dynamic-doc');
}

document.addEventListener('DOMContentLoaded', () => {
    renderTimeScale();
    loadTimeline("2026-09-08");
    setupRowSelection();
    setupTableSorting();
    
    document.getElementById('th-select-all').addEventListener('change', (e) => {
        const currentBlocks = window.mockData[activeDate]?.[selectedRowType] || [];
        currentBlocks.forEach((_, i) => {
            if (e.target.checked) checkedLeftIndices.add(i);
            else checkedLeftIndices.clear();
        });
        updateAll();
    });

    updateAll();
});
