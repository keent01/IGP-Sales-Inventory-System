// assets/js/audit-logs.js

document.addEventListener('DOMContentLoaded', () => {
    loadAuditLogs();
});

async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogBody');
    tbody.innerHTML = `<tr><td colspan="5" class="py-20 text-center text-gray-400">Loading logs...</td></tr>`;

    try {
        const response = await apiFetch('/api/v1/audit/logs/formatted');
        const logs = response.logs; //
        renderLogs(logs);
    } catch (error) {
        console.error("Error loading logs:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="py-20 text-center text-red-500">Failed to load system logs.</td></tr>`;
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('auditLogBody');

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-20 text-center text-gray-400 italic">No activity recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(log => {
    return `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-8 py-5">
                <div class="font-semibold text-gray-800">${log.timestamp}</div> 
            </td>
            <td class="px-8 py-5">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 bg-[#800000] text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        ${log.user ? log.user[0].toUpperCase() : 'S'}
                    </div>
                    <span class="font-medium text-gray-700">${log.user}</span>
                </div>
            </td>
            <td class="px-8 py-5">
                <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase ${getActionColor(log.action)}">
                    ${log.action}
                </span>
            </td>
            <td class="px-8 py-5 text-gray-500 font-medium">
                ${log.module}
            </td>
            <td class="px-8 py-5 text-gray-400 text-xs italic">
                ${log.details}
            </td>
        </tr>
    `;
        }).join('');

    if (window.lucide) lucide.createIcons();
}

function getActionColor(action) {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('Delete')) return 'bg-red-50 text-red-600';
    if (act.includes('create') || act.includes('add')) return 'bg-green-50 text-green-600';
    if (act.includes('update') || act.includes('edit')) return 'bg-blue-50 text-blue-600';
    return 'bg-gray-50 text-gray-600';
}