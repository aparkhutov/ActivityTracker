// Конвертация коэффициента в формат ЧЧ:ММ:СС
window.formatTime = function(ratio) {
    const totalSeconds = Math.floor(ratio * 24 * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Конвертация интервальной длительности в формат ЧЧ:ММ:СС
window.formatDuration = function(ratio) {
    return window.formatTime(ratio);
};
