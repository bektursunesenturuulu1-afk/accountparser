document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('themeToggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        sunIcon.style.display = isDark ? 'none' : 'block';
        moonIcon.style.display = isDark ? 'block' : 'none';
    });

    // --- File Upload Logic ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const resultsSection = document.getElementById('resultsSection');
    
    // Store global data for exports
    let globalDataRecords = [];
    let filteredRecords = [];
    let currentFileName = "";
    let debitChartInstance = null;

    // Highlight drop zone on drag
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-active');
        }, false);
    });

    // Handle Drop
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) {
            fileInput.files = files; // update input files
            handleFileUpload(files[0]);
        }
    });

    // Handle Click/Select
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
            // Reset input so the same file can be selected again
            e.target.value = ''; 
        }
    });

    function handleFileUpload(file) {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showError("Please upload a CSV file.");
            return;
        }

        currentFileName = file.name.replace('.csv', '');
        
        // UI State Update
        resultsSection.classList.add('hidden');
        errorMessage.style.display = 'none';
        dropZone.style.display = 'none';
        loadingIndicator.style.display = 'block';

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/upload", {
            method: "POST",
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || "Upload failed") });
            }
            return response.json();
        })
        .then(data => {
            globalDataRecords = data.records;
            filteredRecords = data.records;
            
            // Populate UI
            populateTable(filteredRecords, data.count);
            updateDashboard(filteredRecords);
            
            // UI State Update
            loadingIndicator.style.display = 'none';
            dropZone.style.display = 'block';
            resultsSection.classList.remove('hidden');
            
            showToast("Successfully parsed " + data.count + " transactions!", "success");
        })
        .catch(err => {
            loadingIndicator.style.display = 'none';
            dropZone.style.display = 'block';
            showError(err.message || "An error occurred during processing.");
        });
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'flex';
        showToast(message, "error");
    }

    // --- Toasts ---
    function showToast(message, type = "success") {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' 
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            toast.addEventListener('animationend', () => toast.remove());
        }, 4000);
    }

    // --- Dashboard & Analytics ---
    function updateDashboard(records) {
        // Update total transactions
        document.getElementById('dashCount').textContent = records.length;

        // Calculate Net Sum (ignoring non-numeric or empty)
        let totalSum = 0;
        const debitAggregates = {};

        records.forEach(row => {
            const amount = parseFloat(String(row['Сумма']).replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(amount)) {
                totalSum += amount;
                
                // Aggregate for chart by Debit Account (Дт)
                const debitAccount = row['Дт'] || 'Unknown';
                debitAggregates[debitAccount] = (debitAggregates[debitAccount] || 0) + amount;
            }
        });

        // Format Sum
        document.getElementById('dashSum').textContent = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalSum);

        // Render Chart
        renderChart(debitAggregates);
    }

    function renderChart(aggregates) {
        // Sort by amount descending and take top 10
        const sortedAccounts = Object.entries(aggregates)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const labels = sortedAccounts.map(item => 'Acc: ' + item[0]);
        const data = sortedAccounts.map(item => item[1]);

        const ctx = document.getElementById('debitChart').getContext('2d');
        
        if (debitChartInstance) {
            debitChartInstance.destroy();
        }

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        debitChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Debit Amount',
                    data: data,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 14 },
                        bodyFont: { size: 14 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                let value = context.raw;
                                return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(value) + ' Som';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // --- Search Filtering ---
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        if (!query) {
            filteredRecords = globalDataRecords;
        } else {
            filteredRecords = globalDataRecords.filter(row => {
                return (
                    String(row['Документ'] || '').toLowerCase().includes(query) ||
                    String(row['Содержание'] || '').toLowerCase().includes(query) ||
                    String(row['Дт'] || '').toLowerCase().includes(query) ||
                    String(row['Кт'] || '').toLowerCase().includes(query)
                );
            });
        }
        
        populateTable(filteredRecords, filteredRecords.length);
    });

    // --- Table Rendering ---
    const tableBody = document.getElementById('tableBody');

    function populateTable(records, count) {
        tableBody.innerHTML = '';

        // Display up to 100 rows to prevent DOM lagging, rest are in export
        const displayLimit = Math.min(records.length, 100);
        
        for (let i = 0; i < displayLimit; i++) {
            const row = records[i];
            const tr = document.createElement('tr');
            
            // Format number gracefully
            const formattedAmount = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(row['Сумма']);

            tr.innerHTML = `
                <td>${row['Дата']}</td>
                <td title="${row['Документ']}">${row['Документ'].substring(0, 30)}${row['Документ'].length > 30 ? '...' : ''}</td>
                <td title="${row['Содержание']}">${row['Содержание'].substring(0, 30)}${row['Содержание'].length > 30 ? '...' : ''}</td>
                <td>${row['Дт']}</td>
                <td>${row['Кт']}</td>
                <td class="amount-cell">${formattedAmount}</td>
                <td>${row['Субконто_Дт'] || ''}</td>
                <td>${row['Субконто_Кт'] || ''}</td>
                <td>${row['Валюта']}</td>
            `;
            tableBody.appendChild(tr);
        }
        
        if (records.length > 100) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="9" style="text-align: center; color: var(--text-secondary); py-4">Showing first 100 preview rows. Export to see all ${count} records.</td>`;
            tableBody.appendChild(tr);
        }
    }

    // --- Export Logic ---
    document.getElementById('btnExportCsv').addEventListener('click', () => {
        if (!filteredRecords.length) {
            showToast("No data to export", "error");
            return;
        }
        
        // Define columns
        const cols = ["Дата", "Документ", "Содержание", "Дт", "Кт", "Сумма", "Субконто_Дт", "Субконто_Кт", "Валюта", "Договор", "Журнал"];
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM for UTF-8 Excel compatibility
        csvContent += cols.join(";") + "\r\n";
        
        filteredRecords.forEach(row => {
            const rowArr = cols.map(col => {
                let cellData = row[col] === null || row[col] === undefined ? "" : String(row[col]);
                // Escape quotes and wrap in quotes if contains separator
                if (cellData.includes(';') || cellData.includes('"') || cellData.includes('\n')) {
                    cellData = '"' + cellData.replace(/"/g, '""') + '"';
                }
                return cellData;
            });
            csvContent += rowArr.join(";") + "\r\n";
        });
        
        triggerDownload(encodeURI(csvContent), `${currentFileName}_cleaned.csv`);
    });

    document.getElementById('btnExportExcel').addEventListener('click', () => {
        if (!filteredRecords.length || typeof XLSX === 'undefined') {
            showToast("No data available or Excel library not loaded", "error");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        
        XLSX.writeFile(workbook, `${currentFileName}_cleaned.xlsx`);
    });

    function triggerDownload(url, filename) {
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
