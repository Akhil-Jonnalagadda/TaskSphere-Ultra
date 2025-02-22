class TaskManager {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('users')) || {};
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || {};
        this.categories = JSON.parse(localStorage.getItem('categories')) || ['Personal', 'Work', 'Project'];
        this.currentUser = localStorage.getItem('currentUser') || null;
        this.theme = localStorage.getItem('theme') || 'light';
        this.applyTheme();
        this.checkAuth();
        this.initSortable();
        this.loadCategories();
        this.checkReminders();
        this.requestNotificationPermission();
    }

    applyTheme() {
        document.body.className = this.theme === 'dark' ? 'dark' : '';
        document.getElementById('themeToggle').textContent = this.theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }

    checkAuth() {
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app-container');
        
        if (this.currentUser && this.users[this.currentUser]) {
            authContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            document.getElementById('currentUser').textContent = this.currentUser;
            this.displayTasks();
            this.updateProgress();
        } else {
            authContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    }

    login(email, password) {
        if (!email || !password) {
            this.showNotification('Please enter both email and password', 'error');
            return;
        }

        const hashedPassword = btoa(password); // Simple base64 encoding for demo
        if (this.users[email]) {
            // User exists, check password
            if (this.users[email].password === hashedPassword) {
                this.currentUser = email;
                localStorage.setItem('currentUser', email);
                if (!this.tasks[email]) this.tasks[email] = [];
                this.saveTasks();
                this.checkAuth();
                this.showNotification('Login successful');
            } else {
                this.showNotification('You entered the wrong password', 'error');
            }
        } else {
            // New user registration
            this.users[email] = { password: hashedPassword };
            this.tasks[email] = [];
            localStorage.setItem('users', JSON.stringify(this.users));
            this.currentUser = email;
            localStorage.setItem('currentUser', email);
            this.saveTasks();
            this.checkAuth();
            this.showNotification('Account created and logged in');
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.checkAuth();
    }

    resetPassword(email) {
        if (this.users[email]) {
            this.showNotification('Password reset link sent to your email (simulated)');
        } else {
            this.showNotification('Email not found', 'error');
        }
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    saveCategories() {
        localStorage.setItem('categories', JSON.stringify(this.categories));
    }

    loadCategories() {
        const select = document.getElementById('categorySelect');
        select.innerHTML = '';
        this.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }

    addCategory() {
        const newCat = document.getElementById('newCategory').value.trim();
        if (newCat && !this.categories.includes(newCat)) {
            this.categories.push(newCat);
            this.saveCategories();
            this.loadCategories();
            document.getElementById('newCategory').value = '';
            this.showNotification(`Category "${newCat}" added`);
        }
    }

    addTask(text, category, priority, dueDate, reminder, recurring, tags) {
        if (!text.trim()) return;

        const task = {
            id: Date.now(),
            text,
            category,
            priority,
            dueDate,
            reminder,
            recurring,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            completed: false,
            notes: '',
            order: this.tasks[this.currentUser].length,
            createdAt: new Date().toISOString()
        };

        this.tasks[this.currentUser].push(task);
        this.saveTasks();
        this.displayTasks();
        this.updateProgress();
        this.scheduleReminder(task);
        this.showNotification(`Task "${text}" added`);
    }

    toggleTask(id) {
        const task = this.tasks[this.currentUser].find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            if (task.recurring !== 'none' && task.completed) {
                this.handleRecurringTask(task);
            }
            this.saveTasks();
            this.displayTasks();
            this.updateProgress();
        }
    }

    deleteTask(id) {
        this.tasks[this.currentUser] = this.tasks[this.currentUser].filter(t => t.id !== id);
        this.saveTasks();
        this.displayTasks();
        this.updateProgress();
    }

    handleRecurringTask(task) {
        const newTask = { ...task, id: Date.now(), completed: false };
        switch (task.recurring) {
            case 'daily':
                newTask.dueDate = new Date(new Date(task.dueDate).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                break;
            case 'weekly':
                newTask.dueDate = new Date(new Date(task.dueDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                break;
            case 'monthly':
                newTask.dueDate = new Date(new Date(task.dueDate).setMonth(new Date(task.dueDate).getMonth() + 1)).toISOString().slice(0, 16);
                break;
        }
        this.tasks[this.currentUser].push(newTask);
    }

    updateNotes(id, notes) {
        const task = this.tasks[this.currentUser].find(t => t.id === id);
        if (task) {
            task.notes = notes;
            this.saveTasks();
            this.displayTasks();
        }
    }

    searchTasks(query) {
        this.displayTasks(query);
    }

    updateProgress() {
        const tasks = this.tasks[this.currentUser];
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const progress = total ? (completed / total) * 100 : 0;
        document.getElementById('progress').style.width = `${progress}%`;
    }

    exportTasks() {
        const dataStr = JSON.stringify(this.tasks[this.currentUser]);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', 'tasks.json');
        link.click();
    }

    importTasks() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                this.tasks[this.currentUser] = JSON.parse(event.target.result);
                this.saveTasks();
                this.displayTasks();
                this.updateProgress();
            };
            reader.readAsText(file);
        };
        input.click();
    }

    requestNotificationPermission() {
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }

    scheduleReminder(task) {
        if (task.reminder) {
            const reminderTime = new Date(task.reminder).getTime();
            const now = Date.now();
            if (reminderTime > now) {
                setTimeout(() => {
                    if (Notification.permission === 'granted') {
                        new Notification(`Task Reminder: ${task.text}`, {
                            body: `Due on: ${task.dueDate || 'No due date'}`,
                        });
                    }
                    this.showNotification(`Reminder: ${task.text}`);
                }, reminderTime - now);
            }
        }
    }

    checkReminders() {
        this.tasks[this.currentUser]?.forEach(task => this.scheduleReminder(task));
    }

    showAnalytics() {
        const analyticsDiv = document.getElementById('analytics');
        analyticsDiv.classList.toggle('hidden');
        const tasks = this.tasks[this.currentUser];
        
        const completedByCategory = {};
        tasks.forEach(task => {
            completedByCategory[task.category] = completedByCategory[task.category] || { total: 0, completed: 0 };
            completedByCategory[task.category].total++;
            if (task.completed) completedByCategory[task.category].completed++;
        });

        let html = '<h2>Task Analytics</h2>';
        html += '<ul>';
        for (const [cat, stats] of Object.entries(completedByCategory)) {
            const percent = (stats.completed / stats.total * 100).toFixed(1);
            html += `<li>${cat}: ${stats.completed}/${stats.total} (${percent}% completed)</li>`;
        }
        html += '</ul>';
        analyticsDiv.innerHTML = html;
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.style.background = type === 'error' ? '#dc3545' : '#28a745';
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 3000);
    }

    initSortable() {
        const el = document.getElementById('taskList');
        Sortable.create(el, {
            animation: 150,
            onEnd: (evt) => {
                const tasks = this.tasks[this.currentUser];
                const [movedTask] = tasks.splice(evt.oldIndex, 1);
                tasks.splice(evt.newIndex, 0, movedTask);
                tasks.forEach((task, index) => task.order = index);
                this.saveTasks();
                this.displayTasks();
            }
        });
    }

    displayTasks(searchQuery = '') {
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';

        let filteredTasks = this.tasks[this.currentUser]
            .sort((a, b) => a.order - b.order)
            .filter(task => 
                !searchQuery || 
                task.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                task.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );

        filteredTasks.forEach(task => {
            const div = document.createElement('div');
            div.className = `task-item ${task.priority.toLowerCase()} ${task.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <div class="task-header">
                    <span>${task.text} (${task.category})</span>
                    <div>
                        <button onclick="taskManager.toggleTask(${task.id})">${task.completed ? 'Undo' : 'Complete'}</button>
                        <button onclick="taskManager.deleteTask(${task.id})" style="background-color: #dc3545;">Delete</button>
                    </div>
                </div>
                <div>Priority: ${task.priority} | Due: ${task.dueDate || 'No due date'} | Reminder: ${task.reminder || 'None'}</div>
                <div>Recurring: ${task.recurring}</div>
                ${task.tags.length ? `<div class="tags">Tags: ${task.tags.join(', ')}</div>` : ''}
                <textarea class="notes" placeholder="Add notes..." onblur="taskManager.updateNotes(${task.id}, this.value)">${task.notes}</textarea>
            `;
            taskList.appendChild(div);
        });
    }

    startVoiceInput() {
        if (!('webkitSpeechRecognition' in window)) {
            this.showNotification('Voice input not supported in this browser', 'error');
            return;
        }
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            document.getElementById('taskInput').value = text;
            this.showNotification('Task added via voice');
        };
        recognition.onerror = () => this.showNotification('Voice recognition error', 'error');
        recognition.start();
    }
}

const taskManager = new TaskManager();

function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    taskManager.login(email, password);
}

function logout() {
    taskManager.logout();
}

function showForgotPassword() {
    document.querySelector('.auth-form').classList.add('hidden');
    document.getElementById('forgot-password').classList.remove('hidden');
}

function hideForgotPassword() {
    document.querySelector('.auth-form').classList.remove('hidden');
    document.getElementById('forgot-password').classList.add('hidden');
}

function resetPassword() {
    const email = document.getElementById('reset-email').value;
    taskManager.resetPassword(email);
}

function addTask() {
    const text = document.getElementById('taskInput').value;
    const category = document.getElementById('categorySelect').value;
    const priority = document.getElementById('prioritySelect').value;
    const dueDate = document.getElementById('dueDate').value;
    const reminder = document.getElementById('reminder').value;
    const recurring = document.getElementById('recurring').value;
    const tags = document.getElementById('tags').value;
    taskManager.addTask(text, category, priority, dueDate, reminder, recurring, tags);
    document.getElementById('taskInput').value = '';
    document.getElementById('dueDate').value = '';
    document.getElementById('reminder').value = '';
    document.getElementById('tags').value = '';
}

function addCategory() {
    taskManager.addCategory();
}

function toggleTheme() {
    taskManager.toggleTheme();
}

function exportTasks() {
    taskManager.exportTasks();
}

function importTasks() {
    taskManager.importTasks();
}

function searchTasks() {
    const query = document.getElementById('searchInput').value;
    taskManager.searchTasks(query);
}

function startVoiceInput() {
    taskManager.startVoiceInput();
}