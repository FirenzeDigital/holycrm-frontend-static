// js/finance.js

class FinanceManager {
    constructor() {
        this.currentChurch = localStorage.getItem('currentChurch');
        this.pb = window.pocketbase;
        this.initializeEventListeners();
        this.loadFinanceData();
    }

    initializeEventListeners() {
        // Category tab
        document.getElementById('btnCategories')?.addEventListener('click', () => this.showCategories());
        document.getElementById('btnNewCategory')?.addEventListener('click', () => this.showCategoryForm());
        document.getElementById('btnSaveCategory')?.addEventListener('click', () => this.saveCategory());
        document.getElementById('btnCancelCategory')?.addEventListener('click', () => this.showCategories());
        
        // Transactions tab
        document.getElementById('btnTransactions')?.addEventListener('click', () => this.showTransactions());
        document.getElementById('btnNewTransaction')?.addEventListener('click', () => this.showTransactionForm());
        document.getElementById('btnSaveTransaction')?.addEventListener('click', () => this.saveTransaction());
        document.getElementById('btnCancelTransaction')?.addEventListener('click', () => this.showTransactions());
        
        // Reports tab
        document.getElementById('btnReports')?.addEventListener('click', () => this.showReports());
        document.getElementById('btnGenerateReport')?.addEventListener('click', () => this.generateReport());
        document.getElementById('btnExportCSV')?.addEventListener('click', () => this.exportToCSV());
        
        // Search and filter
        document.getElementById('searchTransactions')?.addEventListener('input', (e) => this.filterTransactions(e.target.value));
        document.getElementById('filterDateFrom')?.addEventListener('change', () => this.filterTransactionsByDate());
        document.getElementById('filterDateTo')?.addEventListener('change', () => this.filterTransactionsByDate());
        document.getElementById('filterCategory')?.addEventListener('change', () => this.filterTransactionsByCategory());
        document.getElementById('filterType')?.addEventListener('change', () => this.filterTransactionsByType());
        
        // Delete handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-category')) {
                const categoryId = e.target.dataset.id;
                this.deleteCategory(categoryId);
            }
            if (e.target.classList.contains('delete-transaction')) {
                const transactionId = e.target.dataset.id;
                this.deleteTransaction(transactionId);
            }
            if (e.target.classList.contains('edit-category')) {
                const categoryId = e.target.dataset.id;
                this.editCategory(categoryId);
            }
            if (e.target.classList.contains('edit-transaction')) {
                const transactionId = e.target.dataset.id;
                this.editTransaction(transactionId);
            }
        });
    }

    async loadFinanceData() {
        await this.loadCategories();
        await this.loadTransactions();
        await this.updateDashboardSummary();
    }

    // ==================== CATEGORY MANAGEMENT ====================
    
    async loadCategories() {
        try {
            const categories = await this.pb.collection('finance_categories').getFullList({
                filter: `church = "${this.currentChurch}"`,
                sort: 'name'
            });
            
            this.categories = categories;
            this.populateCategoryFilters();
            this.showCategories();
            
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showNotification('Error loading categories', 'error');
        }
    }

    showCategories() {
        document.getElementById('categoriesTab').style.display = 'block';
        document.getElementById('transactionsTab').style.display = 'none';
        document.getElementById('reportsTab').style.display = 'none';
        document.getElementById('categoryForm').style.display = 'none';
        document.getElementById('transactionForm').style.display = 'none';
        
        this.renderCategoriesTable();
    }

    renderCategoriesTable() {
        const tbody = document.getElementById('categoriesTable');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.categories.forEach(category => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.escapeHtml(category.name)}</td>
                <td>
                    <span class="badge ${category.type === 'income' ? 'badge-success' : 'badge-danger'}">
                        ${category.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                </td>
                <td>${new Date(category.created).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-category" data-id="${category.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-category" data-id="${category.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    showCategoryForm(category = null) {
        document.getElementById('categoriesTab').style.display = 'none';
        document.getElementById('categoryForm').style.display = 'block';
        
        const form = document.getElementById('categoryForm');
        form.dataset.id = category?.id || '';
        
        document.getElementById('categoryName').value = category?.name || '';
        document.getElementById('categoryType').value = category?.type || 'expense';
        
        document.getElementById('categoryFormTitle').textContent = 
            category ? 'Edit Category' : 'New Category';
    }

    async saveCategory() {
        const id = document.getElementById('categoryForm').dataset.id;
        const name = document.getElementById('categoryName').value.trim();
        const type = document.getElementById('categoryType').value;
        
        if (!name) {
            this.showNotification('Category name is required', 'error');
            return;
        }
        
        try {
            const data = {
                church: this.currentChurch,
                name,
                type
            };
            
            if (id) {
                await this.pb.collection('finance_categories').update(id, data);
                this.showNotification('Category updated successfully', 'success');
            } else {
                await this.pb.collection('finance_categories').create(data);
                this.showNotification('Category created successfully', 'success');
            }
            
            await this.loadCategories();
            this.showCategories();
            
        } catch (error) {
            console.error('Error saving category:', error);
            this.showNotification('Error saving category', 'error');
        }
    }

    async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category? Transactions using this category will need to be updated.')) {
            return;
        }
        
        try {
            await this.pb.collection('finance_categories').delete(categoryId);
            this.showNotification('Category deleted successfully', 'success');
            await this.loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            this.showNotification('Error deleting category', 'error');
        }
    }

    async editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) {
            this.showCategoryForm(category);
        }
    }

    // ==================== TRANSACTION MANAGEMENT ====================
    
    async loadTransactions() {
        try {
            const transactions = await this.pb.collection('finance_transactions').getFullList({
                filter: `church = "${this.currentChurch}"`,
                sort: '-date',
                expand: 'category'
            });
            
            this.transactions = transactions;
            this.filteredTransactions = [...transactions];
            this.showTransactions();
            
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showNotification('Error loading transactions', 'error');
        }
    }

    showTransactions() {
        document.getElementById('categoriesTab').style.display = 'none';
        document.getElementById('transactionsTab').style.display = 'block';
        document.getElementById('reportsTab').style.display = 'none';
        document.getElementById('categoryForm').style.display = 'none';
        document.getElementById('transactionForm').style.display = 'none';
        
        this.renderTransactionsTable();
        this.updateTransactionSummary();
    }

    renderTransactionsTable(transactions = this.filteredTransactions) {
        const tbody = document.getElementById('transactionsTable');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        transactions.forEach(transaction => {
            const category = transaction.expand?.category;
            const amount = parseFloat(transaction.amount);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(transaction.date).toLocaleDateString()}</td>
                <td>${this.escapeHtml(transaction.description || '')}</td>
                <td>${category ? this.escapeHtml(category.name) : 'Uncategorized'}</td>
                <td>
                    <span class="badge ${category?.type === 'income' ? 'badge-success' : 'badge-danger'}">
                        ${category?.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                </td>
                <td class="text-right ${category?.type === 'income' ? 'text-success' : 'text-danger'}">
                    <strong>${category?.type === 'income' ? '+' : '-'}$${amount.toFixed(2)}</strong>
                </td>
                <td>${new Date(transaction.created).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-transaction" data-id="${transaction.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-transaction" data-id="${transaction.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    showTransactionForm(transaction = null) {
        document.getElementById('transactionsTab').style.display = 'none';
        document.getElementById('transactionForm').style.display = 'block';
        
        const form = document.getElementById('transactionForm');
        form.dataset.id = transaction?.id || '';
        
        const today = new Date().toISOString().split('T')[0];
        
        document.getElementById('transactionDate').value = transaction?.date ? transaction.date.split(' ')[0] : today;
        document.getElementById('transactionAmount').value = transaction?.amount || '';
        document.getElementById('transactionDescription').value = transaction?.description || '';
        document.getElementById('transactionCategory').value = transaction?.category || '';
        
        document.getElementById('transactionFormTitle').textContent = 
            transaction ? 'Edit Transaction' : 'New Transaction';
    }

    async saveTransaction() {
        const id = document.getElementById('transactionForm').dataset.id;
        const date = document.getElementById('transactionDate').value;
        const amount = parseFloat(document.getElementById('transactionAmount').value);
        const description = document.getElementById('transactionDescription').value.trim();
        const categoryId = document.getElementById('transactionCategory').value;
        
        if (!date || !amount || isNaN(amount)) {
            this.showNotification('Date and valid amount are required', 'error');
            return;
        }
        
        try {
            const data = {
                church: this.currentChurch,
                date: `${date} 00:00:00`,
                amount,
                description,
                category: categoryId || null
            };
            
            if (id) {
                await this.pb.collection('finance_transactions').update(id, data);
                this.showNotification('Transaction updated successfully', 'success');
            } else {
                await this.pb.collection('finance_transactions').create(data);
                this.showNotification('Transaction created successfully', 'success');
            }
            
            await this.loadTransactions();
            await this.updateDashboardSummary();
            this.showTransactions();
            
        } catch (error) {
            console.error('Error saving transaction:', error);
            this.showNotification('Error saving transaction', 'error');
        }
    }

    async deleteTransaction(transactionId) {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }
        
        try {
            await this.pb.collection('finance_transactions').delete(transactionId);
            this.showNotification('Transaction deleted successfully', 'success');
            await this.loadTransactions();
            await this.updateDashboardSummary();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.showNotification('Error deleting transaction', 'error');
        }
    }

    async editTransaction(transactionId) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (transaction) {
            this.showTransactionForm(transaction);
        }
    }

    // ==================== FILTERING ====================
    
    populateCategoryFilters() {
        const categorySelect = document.getElementById('transactionCategory');
        const filterCategory = document.getElementById('filterCategory');
        
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            filterCategory.innerHTML = '<option value="">All Categories</option>';
            
            this.categories.forEach(category => {
                const option = `<option value="${category.id}">${this.escapeHtml(category.name)} (${category.type})</option>`;
                categorySelect.innerHTML += option;
                filterCategory.innerHTML += option;
            });
        }
    }

    filterTransactions(searchTerm = '') {
        this.filteredTransactions = this.transactions.filter(transaction => {
            const matchesSearch = !searchTerm || 
                transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (transaction.expand?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesDate = this.filterByDate(transaction);
            const matchesCategory = this.filterByCategory(transaction);
            const matchesType = this.filterByType(transaction);
            
            return matchesSearch && matchesDate && matchesCategory && matchesType;
        });
        
        this.renderTransactionsTable();
        this.updateTransactionSummary();
    }

    filterTransactionsByDate() {
        this.filterTransactions(document.getElementById('searchTransactions').value);
    }

    filterTransactionsByCategory() {
        this.filterTransactions(document.getElementById('searchTransactions').value);
    }

    filterTransactionsByType() {
        this.filterTransactions(document.getElementById('searchTransactions').value);
    }

    filterByDate(transaction) {
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const transactionDate = new Date(transaction.date);
        
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            if (transactionDate < fromDate) return false;
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (transactionDate > toDate) return false;
        }
        
        return true;
    }

    filterByCategory(transaction) {
        const filterCategory = document.getElementById('filterCategory').value;
        if (!filterCategory) return true;
        return transaction.category === filterCategory;
    }

    filterByType(transaction) {
        const filterType = document.getElementById('filterType').value;
        if (!filterType) return true;
        
        const category = this.categories.find(c => c.id === transaction.category);
        return category?.type === filterType;
    }

    // ==================== DASHBOARD & SUMMARY ====================
    
    async updateDashboardSummary() {
        if (!this.transactions) return;
        
        let totalIncome = 0;
        let totalExpenses = 0;
        
        this.transactions.forEach(transaction => {
            const category = this.categories.find(c => c.id === transaction.category);
            const amount = parseFloat(transaction.amount);
            
            if (category?.type === 'income') {
                totalIncome += amount;
            } else {
                totalExpenses += amount;
            }
        });
        
        const balance = totalIncome - totalExpenses;
        
        // Update UI elements if they exist
        const incomeEl = document.getElementById('totalIncome');
        const expensesEl = document.getElementById('totalExpenses');
        const balanceEl = document.getElementById('currentBalance');
        
        if (incomeEl) incomeEl.textContent = `$${totalIncome.toFixed(2)}`;
        if (expensesEl) expensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
        if (balanceEl) {
            balanceEl.textContent = `$${balance.toFixed(2)}`;
            balanceEl.className = `h4 ${balance >= 0 ? 'text-success' : 'text-danger'}`;
        }
        
        // Update transaction summary
        this.updateTransactionSummary();
    }

    updateTransactionSummary() {
        let filteredIncome = 0;
        let filteredExpenses = 0;
        
        this.filteredTransactions.forEach(transaction => {
            const category = this.categories.find(c => c.id === transaction.category);
            const amount = parseFloat(transaction.amount);
            
            if (category?.type === 'income') {
                filteredIncome += amount;
            } else {
                filteredExpenses += amount;
            }
        });
        
        const filteredBalance = filteredIncome - filteredExpenses;
        
        const summaryEl = document.getElementById('transactionsSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="alert alert-info">
                    <strong>Filtered Summary:</strong> 
                    ${this.filteredTransactions.length} transactions | 
                    Income: <span class="text-success">$${filteredIncome.toFixed(2)}</span> | 
                    Expenses: <span class="text-danger">$${filteredExpenses.toFixed(2)}</span> | 
                    Balance: <span class="${filteredBalance >= 0 ? 'text-success' : 'text-danger'}">$${filteredBalance.toFixed(2)}</span>
                </div>
            `;
        }
    }

    // ==================== REPORTS ====================
    
    showReports() {
        document.getElementById('categoriesTab').style.display = 'none';
        document.getElementById('transactionsTab').style.display = 'none';
        document.getElementById('reportsTab').style.display = 'block';
        
        this.generateMonthlyReport();
    }

    generateMonthlyReport() {
        if (!this.transactions || this.transactions.length === 0) {
            document.getElementById('monthlyReport').innerHTML = '<p>No transactions to report</p>';
            return;
        }
        
        // Group by month and category
        const monthlyData = {};
        
        this.transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const category = this.categories.find(c => c.id === transaction.category);
            const categoryName = category?.name || 'Uncategorized';
            const amount = parseFloat(transaction.amount);
            const type = category?.type || 'expense';
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { income: {}, expenses: {}, totalIncome: 0, totalExpenses: 0 };
            }
            
            if (type === 'income') {
                if (!monthlyData[monthKey].income[categoryName]) {
                    monthlyData[monthKey].income[categoryName] = 0;
                }
                monthlyData[monthKey].income[categoryName] += amount;
                monthlyData[monthKey].totalIncome += amount;
            } else {
                if (!monthlyData[monthKey].expenses[categoryName]) {
                    monthlyData[monthKey].expenses[categoryName] = 0;
                }
                monthlyData[monthKey].expenses[categoryName] += amount;
                monthlyData[monthKey].totalExpenses += amount;
            }
        });
        
        // Generate HTML report
        let html = '<div class="card">';
        html += '<div class="card-header"><h5>Monthly Financial Report</h5></div>';
        html += '<div class="card-body">';
        
        Object.keys(monthlyData).sort().reverse().forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const data = monthlyData[monthKey];
            
            html += `
                <div class="mb-4">
                    <h6>${monthName}</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header bg-success text-white">
                                    <h6 class="mb-0">Income: $${data.totalIncome.toFixed(2)}</h6>
                                </div>
                                <div class="card-body">
            `;
            
            Object.keys(data.income).forEach(category => {
                html += `<p class="mb-1">${this.escapeHtml(category)}: <strong>$${data.income[category].toFixed(2)}</strong></p>`;
            });
            
            html += `
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header bg-danger text-white">
                                    <h6 class="mb-0">Expenses: $${data.totalExpenses.toFixed(2)}</h6>
                                </div>
                                <div class="card-body">
            `;
            
            Object.keys(data.expenses).forEach(category => {
                html += `<p class="mb-1">${this.escapeHtml(category)}: <strong>$${data.expenses[category].toFixed(2)}</strong></p>`;
            });
            
            html += `
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <strong>Monthly Balance: 
                            <span class="${data.totalIncome - data.totalExpenses >= 0 ? 'text-success' : 'text-danger'}">
                                $${(data.totalIncome - data.totalExpenses).toFixed(2)}
                            </span>
                        </strong>
                    </div>
                </div>
                <hr>
            `;
        });
        
        html += '</div></div>';
        document.getElementById('monthlyReport').innerHTML = html;
    }

    generateReport() {
        const reportType = document.getElementById('reportType').value;
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        
        if (!startDate || !endDate) {
            this.showNotification('Please select start and end dates', 'error');
            return;
        }
        
        // Filter transactions for the report period
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        const periodTransactions = this.transactions.filter(t => {
            const transDate = new Date(t.date);
            return transDate >= start && transDate <= end;
        });
        
        if (periodTransactions.length === 0) {
            this.showNotification('No transactions found for the selected period', 'warning');
            return;
        }
        
        // Generate report based on type
        switch(reportType) {
            case 'income_statement':
                this.generateIncomeStatement(periodTransactions, start, end);
                break;
            case 'category_summary':
                this.generateCategorySummary(periodTransactions, start, end);
                break;
            default:
                this.showNotification('Invalid report type', 'error');
        }
    }

    generateIncomeStatement(transactions, start, end) {
        let totalIncome = 0;
        let totalExpenses = 0;
        const incomeByCategory = {};
        const expensesByCategory = {};
        
        transactions.forEach(transaction => {
            const category = this.categories.find(c => c.id === transaction.category);
            const amount = parseFloat(transaction.amount);
            
            if (category?.type === 'income') {
                totalIncome += amount;
                if (!incomeByCategory[category.name]) incomeByCategory[category.name] = 0;
                incomeByCategory[category.name] += amount;
            } else {
                totalExpenses += amount;
                if (!expensesByCategory[category?.name || 'Uncategorized']) {
                    expensesByCategory[category?.name || 'Uncategorized'] = 0;
                }
                expensesByCategory[category?.name || 'Uncategorized'] += amount;
            }
        });
        
        const netIncome = totalIncome - totalExpenses;
        
        let html = `
            <div class="card">
                <div class="card-header">
                    <h5>Income Statement: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</h5>
                </div>
                <div class="card-body">
                    <h6 class="text-success">Total Income: $${totalIncome.toFixed(2)}</h6>
        `;
        
        Object.keys(incomeByCategory).forEach(category => {
            html += `<p class="ml-3 mb-1">${this.escapeHtml(category)}: $${incomeByCategory[category].toFixed(2)}</p>`;
        });
        
        html += `
                    <hr>
                    <h6 class="text-danger">Total Expenses: $${totalExpenses.toFixed(2)}</h6>
        `;
        
        Object.keys(expensesByCategory).forEach(category => {
            html += `<p class="ml-3 mb-1">${this.escapeHtml(category)}: $${expensesByCategory[category].toFixed(2)}</p>`;
        });
        
        html += `
                    <hr>
                    <h4>Net Income: 
                        <span class="${netIncome >= 0 ? 'text-success' : 'text-danger'}">
                            $${netIncome.toFixed(2)}
                        </span>
                    </h4>
                </div>
            </div>
        `;
        
        document.getElementById('customReport').innerHTML = html;
    }

    generateCategorySummary(transactions, start, end) {
        const categoryTotals = {};
        
        transactions.forEach(transaction => {
            const category = this.categories.find(c => c.id === transaction.category);
            const categoryName = category?.name || 'Uncategorized';
            const amount = parseFloat(transaction.amount);
            
            if (!categoryTotals[categoryName]) {
                categoryTotals[categoryName] = {
                    income: 0,
                    expenses: 0,
                    type: category?.type || 'expense'
                };
            }
            
            if (category?.type === 'income') {
                categoryTotals[categoryName].income += amount;
            } else {
                categoryTotals[categoryName].expenses += amount;
            }
        });
        
        let html = `
            <div class="card">
                <div class="card-header">
                    <h5>Category Summary: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</h5>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Type</th>
                                <th class="text-right">Income</th>
                                <th class="text-right">Expenses</th>
                                <th class="text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        Object.keys(categoryTotals).forEach(categoryName => {
            const data = categoryTotals[categoryName];
            const net = data.income - data.expenses;
            
            html += `
                <tr>
                    <td>${this.escapeHtml(categoryName)}</td>
                    <td><span class="badge ${data.type === 'income' ? 'badge-success' : 'badge-danger'}">${data.type}</span></td>
                    <td class="text-right text-success">$${data.income.toFixed(2)}</td>
                    <td class="text-right text-danger">$${data.expenses.toFixed(2)}</td>
                    <td class="text-right ${net >= 0 ? 'text-success' : 'text-danger'}">$${net.toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.getElementById('customReport').innerHTML = html;
    }

    // ==================== EXPORT FUNCTIONALITY ====================
    
    exportToCSV() {
        if (!this.filteredTransactions || this.filteredTransactions.length === 0) {
            this.showNotification('No transactions to export', 'warning');
            return;
        }
        
        const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Created'];
        const csvData = this.filteredTransactions.map(transaction => {
            const category = this.categories.find(c => c.id === transaction.category);
            return [
                new Date(transaction.date).toLocaleDateString(),
                `"${(transaction.description || '').replace(/"/g, '""')}"`,
                category?.name || 'Uncategorized',
                category?.type === 'income' ? 'Income' : 'Expense',
                transaction.amount,
                new Date(transaction.created).toLocaleDateString()
            ];
        });
        
        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `finance_transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('CSV exported successfully', 'success');
    }

    // ==================== UTILITY FUNCTIONS ====================
    
    showNotification(message, type = 'info') {
        // Use your existing notification system or create a simple one
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';
        
        const notification = document.createElement('div');
        notification.className = `alert ${alertClass} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        `;
        
        const container = document.getElementById('notifications') || document.body;
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 150);
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize finance module when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.financeManager = new FinanceManager();
});