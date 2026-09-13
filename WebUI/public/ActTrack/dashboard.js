window.getRowIconHTML = function(rowType, blockName) {
    let char = rowType.charAt(0).toUpperCase();
    let bgClass = `icon-${rowType}`;
    let inlineStyle = '';
    if (rowType === 'docs') {
        inlineStyle = `style="background-color: ${window.getDocumentColor(blockName)}; color: #1e293b;"`;
    }
    return `<span class="row-icon ${bgClass}" ${inlineStyle}>${char}</span>`;
};

window.renderDashboard = function(blocks, selectedRowType, checkedLeftIndices, currentSortField, currentSortOrder, onCheckboxChange) {
    const tableBodyLeft = document.getElementById('blocks-table-body');
    const tableBodyRight = document.getElementById('stats-table-body');

    if (!selectedRowType || !blocks) {
        tableBodyLeft.innerHTML = '<tr><td colspan="6">Нет данных</td></tr>';
        tableBodyRight.innerHTML = '<tr><td>Нет данных</td></tr>';
        return;
    }

    // --- ЛЕВАЯ ЧАСТЬ (Хронология) ---
    let sortedBlocks = blocks.map((b, i) => ({ ...b, originalIndex: i }));

    if (currentSortField) {
        sortedBlocks.sort((a, b) => {
            let valA = currentSortField === 'duration' ? (a.end - a.start) : a[currentSortField];
            let valB = currentSortField === 'duration' ? (b.end - b.start) : b[currentSortField];

            if (typeof valA === 'string') {
                return currentSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return currentSortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });
    }

    tableBodyLeft.innerHTML = '';
    sortedBlocks.forEach((block) => {
        const duration = block.end - block.start;
        const isChecked = checkedLeftIndices.has(block.originalIndex);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="width: 40px; text-align: center;"><input type="checkbox" class="left-cb" data-index="${block.originalIndex}" ${isChecked ? 'checked' : ''}></td>
            <td style="width: 40px;">${window.getRowIconHTML(selectedRowType, block.name)}</td>
            <td><strong>${block.name}</strong></td>
            <td class="time-badge">${window.formatTime(block.start)}</td>
            <td class="time-badge">${window.formatTime(block.end)}</td>
            <td class="time-badge" style="text-align: right;">${window.formatDuration(duration)}</td>
        `;
        tableBodyLeft.appendChild(tr);
    });

    // --- ПРАВАЯ ЧАСТЬ (Статистика: Колонки разделены) ---
    tableBodyRight.innerHTML = '';
    const statsMap = {};
    const statsIndicesMap = {};

    blocks.forEach((block, index) => {
        statsMap[block.name] = (statsMap[block.name] || 0) + (block.end - block.start);
        if (!statsIndicesMap[block.name]) statsIndicesMap[block.name] = [];
        statsIndicesMap[block.name].push(index);
    });

    const anyCheckboxCheckedGlobal = checkedLeftIndices.size > 0;
    const sortedStats = Object.entries(statsMap).sort((a, b) => b - a);
    const indeterminateCheckboxes = [];

    sortedStats.forEach(([name, totalDuration]) => {
        const percentOf24h = (totalDuration * 100).toFixed(1);
        const baseColor = window.getRowBaseColor(selectedRowType, name); // Получаем основной цвет (например, #3b82f6)
        const relatedIndices = statsIndicesMap[name];
        
        const allRelatedChecked = relatedIndices.every(idx => checkedLeftIndices.has(idx));
        const anyRelatedChecked = relatedIndices.some(idx => checkedLeftIndices.has(idx));
        const isIndeterminate = !allRelatedChecked && anyRelatedChecked;

        let groupSelectedDuration = 0;
        relatedIndices.forEach(idx => {
            if (checkedLeftIndices.has(idx)) {
                groupSelectedDuration += (blocks[idx].end - blocks[idx].start);
            }
        });

        let selectedDurationStr = '';
        if (anyCheckboxCheckedGlobal) {
            selectedDurationStr = ` (${window.formatDuration(groupSelectedDuration)})`;
        }

        // Генерируем бледный полупрозрачный фон для самой капсулы (12% непрозрачности от оригинального цвета)
        const capsuleBgColor = `${baseColor}1f`; 

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-cb">
                <input type="checkbox" class="right-cb" data-name="${name}" ${allRelatedChecked ? 'checked' : ''}>
            </td>
            <td class="col-name-progress">
                <!-- Внутренний контейнер-капсула, который держит рамку 100% и форму -->
                <div class="capsule-container" style="border-color: ${baseColor}; background-color: ${capsuleBgColor};">
                    <div class="progress-bg-overlay" style="width: ${percentOf24h}%; background-color: ${baseColor}; opacity: 0.35;"></div>
                    <span class="col-name-text">${name}</span>
                </div>
            </td>
            <td class="col-percent">
                ${percentOf24h}%
            </td>
            <td class="col-time">
                ${window.formatDuration(totalDuration)}<span class="selected-duration">${selectedDurationStr}</span>
            </td>
        `;
        
        
        tableBodyRight.appendChild(tr);

        if (isIndeterminate) {
            indeterminateCheckboxes.push(name);
        }
    });


    // Установка состояния indeterminate для частичного выбора
    indeterminateCheckboxes.forEach(name => {
        const cb = tableBodyRight.querySelector(`.right-cb[data-name="${name}"]`);
        if (cb) cb.indeterminate = true;
    });

    // Навешивание событий чекбоксов
    document.querySelectorAll('.left-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            onCheckboxChange('left', index, e.target.checked, statsIndicesMap);
        });
    });

    document.querySelectorAll('.right-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const name = e.target.getAttribute('data-name');
            const relatedIndices = statsIndicesMap[name] || [];
            relatedIndices.forEach(idx => {
                if (e.target.checked) checkedLeftIndices.add(idx);
                else checkedLeftIndices.delete(idx);
            });
            window.updateAll();
        });
    });
};
