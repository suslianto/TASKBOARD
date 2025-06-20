// public/script.js
const BACKEND_URL = '/api/tasks';
const BACKEND_UNITS_URL = '/api/units';

let tasks = [];
let activeInlineForm = null;
let availableUnitTypes = [];


// --- DOM Elements ---
const backlogList = document.getElementById('backlog-list');
const ongoingList = document.getElementById('ongoing-list');
const doneList = document.getElementById('done-list'); 

const taskLists = {
    'Backlog': backlogList,
    'Ongoing': ongoingList,
    'Done': doneList
};

const currentDateInput = document.getElementById('current-date-input');
const prevDayBtn = document.getElementById('prev-day-btn'); // Ini masih ada di script.js
const nextDayBtn = document.getElementById('next-day-btn'); // Ini masih ada di script.js

let currentDisplayDate = new Date();
let draggedItem = null;


// --- Helper Functions ---
function getTagColorClass(typeOrPriority, isType = true) {
    if (isType) {
        if (typeOrPriority.startsWith('UNIT')) {
            return 'unit';
        }
        switch (typeOrPriority) {
            case 'Bug': return 'bug';
            case 'Feature': return 'feature';
            case 'Refactor': return 'refactor';
            default: return 'grey';
        }
    } else { // Priority
        switch (typeOrPriority) {
            case 'high': return 'high';
            case 'medium': return 'medium';
            case 'low': return 'low';
            default: return 'grey';
        }
    }
}

function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function displayEmptyMessage(listElement, columnName) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('empty-message');
    messageDiv.textContent = `Tidak ada ${columnName.toLowerCase()}`;
    listElement.appendChild(messageDiv);
}


// --- API Interaction Functions (Dipindah ke atas untuk menghindari ReferenceError) ---

async function fetchUnitTypes() {
    console.log('[API Call] Fetching unit types...');
    try {
        const response = await fetch(BACKEND_UNITS_URL);
        console.log(`[API Call] Units API response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from ${BACKEND_UNITS_URL}`);
        }
        const fetchedUnits = await response.json();
        console.log('[API Call] Fetched units:', fetchedUnits);
        
        availableUnitTypes = fetchedUnits.sort((a, b) => {
            const aIsUnit = a.startsWith('UNIT ');
            const bIsUnit = b.startsWith('UNIT ');

            if (aIsUnit && !bIsUnit) return -1;
            if (!aIsUnit && bIsUnit) return 1;
            if (aIsUnit && bIsUnit) {
                const numA = parseInt(a.substring(5));
                const numB = parseInt(b.substring(5));
                return numA - numB;
            }
            return a.localeCompare(b);
        });

        if (availableUnitTypes.length === 0) {
            console.warn("No units found in database. Populating with default UNITs for dropdown.");
            for (let i = 1; i <= 10; i++) {
                availableUnitTypes.push(`UNIT ${i}`);
            }
            if (!availableUnitTypes.includes('Bug')) availableUnitTypes.push('Bug');
            if (!availableUnitTypes.includes('Feature')) availableUnitTypes.push('Feature');
            if (!availableUnitTypes.includes('Refactor')) availableUnitTypes.push('Refactor');
        }

    } catch (error) {
        console.error('Error fetching unit types from backend:', error);
        alert('Failed to load unit types. Check server or network.');
        availableUnitTypes = ["Bug", "Feature", "Refactor"];
        for (let i = 1; i <= 10; i++) {
            availableUnitTypes.push(`UNIT ${i}`);
        }
        console.log("Using default hardcoded units due to API error.");
    }
}

async function fetchTasksForDate(date) {
    const dateString = formatDateToYYYYMMDD(date);
    let url = `${BACKEND_URL}/current`;

    const today = new Date();
    today.setHours(0,0,0,0);
    date.setHours(0,0,0,0);

    if (date.getTime() !== today.getTime()) {
        url = `${BACKEND_URL}/history/${dateString}`;
    }
    console.log(`[API Call] Fetching tasks from: ${url}`);
    try {
        const response = await fetch(url);
        console.log(`[API Call] Tasks API response status: ${response.status}`);
        if (!response.ok) {
            if (response.status === 404) {
                 tasks = [];
                 console.log(`No tasks found for ${dateString}. (404 Not Found)`);
            } else if (response.status === 200 && url.includes('/history/') && (await response.clone().json()).length === 0) {
                 tasks = []; 
                 console.log(`No tasks found for ${dateString}. (200 OK, Empty Array)`);
            } else {
                throw new Error(`HTTP error! status: ${response.status} from ${url}`);
            }
        } else {
            tasks = await response.json();
            console.log(`[API Call] Fetched tasks for ${dateString}:`, tasks);
        }
        
        if (activeInlineForm) {
            const formStatus = activeInlineForm.dataset.originalStatus;
            const formMode = activeInlineForm.dataset.mode;
            activeInlineForm.remove();
            activeInlineForm = null;
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
            if (formMode === 'add') {
                resetAddButtonIcon(formStatus);
            }
        }

        renderTasks();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        alert('Failed to load tasks. Please check the server or your network connection.');
        tasks = [];
        renderTasks();
    }
}


async function addTask(taskData, inlineFormElement) { 
    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday) {
        alert("You can only add tasks to today's board.");
        inlineFormElement.remove();
        activeInlineForm = null;
        document.removeEventListener('click', handleClickOutsideOfInlineForm);
        resetAddButtonIcon(taskData.status);
        renderTasks();
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from POST /api/tasks`);
        }
        const newTask = await response.json();
        console.log('[API Call] Task added:', newTask);
        
        if (inlineFormElement && inlineFormElement.parentNode) {
            inlineFormElement.remove();
            activeInlineForm = null; 
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
        }
        resetAddButtonIcon(newTask.status);
        await fetchTasksForDate(currentDisplayDate); 
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Failed to add task.');
    }
}

async function updateTask(taskId, taskData, inlineFormElement) { 
    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday) {
        alert("You can only edit tasks on today's board.");
        inlineFormElement.remove();
        activeInlineForm = null;
        document.removeEventListener('click', handleClickOutsideOfInlineForm);
        renderTasks();
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from PUT /api/tasks/${taskId}`);
        }
        const updatedTask = await response.json();
        console.log('[API Call] Task updated:', updatedTask);
        
        if (inlineFormElement && inlineFormElement.parentNode) {
            inlineFormElement.remove();
            activeInlineForm = null;
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
        }
        await fetchTasksForDate(currentDisplayDate);
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Failed to update task.');
    }
}

async function updateTaskStatus(taskId, newStatus) { 
    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday) {
        alert("You can only change status on today's board.");
        renderTasks(); 
        return;
    }
    console.log(`[API Call] Updating task status for ${taskId} to ${newStatus}`);
    try {
        const response = await fetch(`${BACKEND_URL}/${taskId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newStatus })
        });
        console.log(`[API Call] Update task status API response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from PUT /api/tasks/${taskId}/status`);
        }
        await fetchTasksForDate(currentDisplayDate);
    } catch (error) {
        console.error('Error updating task status:', error);
        alert('Failed to update task status.');
        renderTasks();
    }
}

async function deleteTask(taskId) {
    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday) {
        alert("You can only delete tasks from today's board.");
        if (activeInlineForm && activeInlineForm.dataset.mode === 'edit' && activeInlineForm.dataset.id === taskId) {
            activeInlineForm.remove();
            activeInlineForm = null;
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
        }
        renderTasks();
        return;
    }

    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    console.log(`[API Call] Deleting task ${taskId}`);
    try {
        const response = await fetch(`${BACKEND_URL}/${taskId}`, {
            method: 'DELETE',
        });
        console.log(`[API Call] Delete task API response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} from DELETE /api/tasks/${taskId}`);
        }
        if (activeInlineForm && activeInlineForm.dataset.mode === 'edit' && activeInlineForm.dataset.id === taskId) {
            activeInlineForm.remove();
            activeInlineForm = null;
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
        }
        await fetchTasksForDate(currentDisplayDate);
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
    }
}


// --- Render Functions (Tetap di sini) ---
function createTaskCard(task) {
    const card = document.createElement('div');
    card.classList.add('task-card');
    if (formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date())) {
        card.setAttribute('draggable', true);
    } else {
        card.setAttribute('draggable', false);
        card.classList.add('not-draggable');
    }
    
    card.dataset.id = task.id;
    card.dataset.status = task.status;

    card.innerHTML = `
        <div class="task-header">
            <div class="task-tags">
                <span class="tag ${getTagColorClass(task.type, true)}">${task.type}</span>
                <span class="tag ${getTagColorClass(task.priority, false)}">${task.priority}</span>
            </div>
            <div class="task-actions">
                <button class="edit-options-btn" data-id="${task.id}">⚙</button>
            </div>
        </div>
        <h3>${task.title}</h3>
    `;

    if (card.getAttribute('draggable') === 'true') {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    }

    const editButton = card.querySelector('.edit-options-btn');
    if (formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date())) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            openInlineEditTask(task);
        });
        editButton.removeAttribute('disabled');
    } else {
        editButton.setAttribute('disabled', 'true');
        editButton.classList.add('disabled-icon');
    }

    return card;
}

function renderTasks() {
    backlogList.innerHTML = '';
    ongoingList.innerHTML = '';
    doneList.innerHTML = ''; 

    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());

    ['Backlog', 'Ongoing', 'Done'].forEach(columnName => {
        const listElement = taskLists[columnName];
        const tasksInColumn = tasks.filter(task => task.status === columnName);
        let hasVisibleTaskCards = false;
        
        if (isDisplayingToday && activeInlineForm && activeInlineForm.parentNode && activeInlineForm.dataset.originalStatus === columnName) {
            listElement.prepend(activeInlineForm);
        }

        tasksInColumn.forEach(task => {
            const isBeingEdited = activeInlineForm && activeInlineForm.dataset.mode === 'edit' && activeInlineForm.dataset.id === task.id;
            if (!isBeingEdited) {
                listElement.appendChild(createTaskCard(task));
                hasVisibleTaskCards = true;
            }
        });

        const isInlineAddFormActiveInThisColumn = isDisplayingToday && activeInlineForm && activeInlineForm.dataset.mode === 'add' && activeInlineForm.dataset.originalStatus === columnName;

        if (!hasVisibleTaskCards && !isInlineAddFormActiveInThisColumn) {
            displayEmptyMessage(listElement, columnName);
        }

        const addButton = listElement.closest('.column').querySelector('.add-task-btn');
        if (isDisplayingToday) {
            addButton.removeAttribute('disabled');
            if (isInlineAddFormActiveInThisColumn) {
                setAddButtonIconToX(columnName);
            } else {
                resetAddButtonIcon(columnName);
            }
        } else {
            addButton.setAttribute('disabled', 'true');
            resetAddButtonIcon(columnName);
        }
    });
}

// --- Drag and Drop Handlers ---
function handleDragStart(e) {
    if (activeInlineForm) {
        e.preventDefault();
        return;
    }
    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday) {
        e.preventDefault();
        return;
    }

    draggedItem = e.target;
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    const currentList = e.currentTarget;
    if (!currentList.classList.contains('task-list')) return;

    const dragging = document.querySelector('.task-card.dragging');
    if (!dragging) return;

    const afterElement = getDragAfterElement(currentList, e.clientY);
    if (afterElement == null) {
        currentList.appendChild(dragging);
    } else {
        currentList.insertBefore(dragging, afterElement);
    }
}

function handleDragEnter(e) {
    e.preventDefault();
    if (e.target.classList.contains('task-list')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (e.target.classList.contains('task-list')) {
        e.target.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    const targetList = e.currentTarget;
    targetList.classList.remove('drag-over');

    if (!draggedItem) return;

    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday) {
        renderTasks(); 
        return;
    }

    const newStatus = targetList.closest('.column').dataset.status;
    const taskId = draggedItem.dataset.id;
    const oldStatus = draggedItem.dataset.status;

    if (oldStatus !== newStatus) {
        await updateTaskStatus(taskId, newStatus); 
    }
}


function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- Management of Add Button Icon (+ to X) ---
function setAddButtonIconToX(status) {
    const columnHeader = document.querySelector(`.column[data-status="${status}"] .column-header`);
    const addButton = columnHeader.querySelector('.add-task-btn');
    addButton.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    addButton.classList.add('is-x-icon');
}

function resetAddButtonIcon(status) {
    const columnHeader = document.querySelector(`.column[data-status="${status}"] .column-header`);
    const addButton = columnHeader.querySelector('.add-task-btn');
    addButton.innerHTML = '+';
    addButton.classList.remove('is-x-icon');
}

// --- Global handler for clicks outside any active inline form ---
function handleClickOutsideOfInlineForm(event) {
    if (activeInlineForm && !activeInlineForm.contains(event.target) && 
        !event.target.classList.contains('add-task-btn') && 
        !event.target.classList.contains('edit-options-btn')) {
        
        const formStatus = activeInlineForm.dataset.originalStatus;
        const formMode = activeInlineForm.dataset.mode;
        
        activeInlineForm.remove();
        activeInlineForm = null;
        document.removeEventListener('click', handleClickOutsideOfInlineForm);
        
        if (formMode === 'add') {
             resetAddButtonIcon(formStatus); 
        } 
        renderTasks();
    }
}


// --- INLINE FORM CREATION (for ADD and EDIT) ---
function createAndInsertInlineForm(targetElement, mode, taskData = null) {
    if (activeInlineForm) {
        if (activeInlineForm.dataset.mode === 'add') {
            resetAddButtonIcon(activeInlineForm.dataset.originalStatus);
        }
        activeInlineForm.remove();
        activeInlineForm = null;
        document.removeEventListener('click', handleClickOutsideOfInlineForm);
        renderTasks();
    }

    const isDisplayingToday = formatDateToYYYYMMDD(currentDisplayDate) === formatDateToYYYYMMDD(new Date());
    if (!isDisplayingToday && mode !== 'edit') {
        alert("You can only add tasks to today's board.");
        return; 
    }

    const inlineFormCard = document.createElement('div');
    inlineFormCard.classList.add('task-card', 'inline-task-form');
    inlineFormCard.dataset.mode = mode;
    
    if (mode === 'edit' && taskData) {
        inlineFormCard.dataset.id = taskData.id;
        inlineFormCard.dataset.originalStatus = taskData.status;
    } else { // Add mode
        inlineFormCard.dataset.originalStatus = targetElement.closest('.column').dataset.status;
    }
    inlineFormCard.setAttribute('draggable', false); 

    // Build options for the Unit dropdown dynamically
    const unitOptionsHTML = availableUnitTypes.map(option => `<option value="${option}">${option}</option>`).join('');

    inlineFormCard.innerHTML = `
        <form class="inline-form">
            <input type="text" class="inline-title-input" placeholder="What are you working on?" required>

            <label class="inline-form-label">Unit</label>
            <select name="inline-task-type" class="inline-select" required>
                ${unitOptionsHTML}
            </select>

            <label class="inline-form-label">Priority</label>
            <div class="radio-group inline-radio-group">
                <label><input type="radio" name="inline-task-priority" value="low"> Low</label>
                <label><input type="radio" name="inline-task-priority" value="medium" checked> Medium</label>
                <label><input type="radio" name="inline-task-priority" value="high"> High</label>
            </div>

            <div class="inline-form-actions">
                ${mode === 'edit' ? '<button type="button" class="inline-btn cancel-btn">Cancel</button>' : ''}
                ${mode === 'edit' ? '<button type="button" class="inline-btn delete-btn-inline">Delete</button>' : ''}
                <button type="submit" class="modal-btn save-btn">Save</button>
            </div>
        </form>
    `;

    if (mode === 'edit' && taskData) {
        targetElement.parentNode.replaceChild(inlineFormCard, targetElement);
        inlineFormCard.querySelector('.inline-title-input').value = taskData.title;
        const selectUnit = inlineFormCard.querySelector(`select[name="inline-task-type"]`);
        if (selectUnit) selectUnit.value = taskData.type; 
        inlineFormCard.querySelector(`input[name="inline-task-priority"][value="${taskData.priority}"]`).checked = true;
    } else { // Add mode
        targetElement.prepend(inlineFormCard);
        inlineFormCard.querySelector(`select[name="inline-task-type"]`).value = availableUnitTypes.length > 0 ? availableUnitTypes[0] : '';
        inlineFormCard.querySelector('input[name="inline-task-priority"][value="medium"]').checked = true;
        setAddButtonIconToX(inlineFormCard.dataset.originalStatus);
    }

    activeInlineForm = inlineFormCard;
    inlineFormCard.querySelector('.inline-title-input').focus();

    // Event listener for inline form submission (Save)
    inlineFormCard.querySelector('.inline-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const inlineTitle = inlineFormCard.querySelector('.inline-title-input').value.trim();
        const inlineSelectedType = inlineFormCard.querySelector(`select[name="inline-task-type"]`).value;
        const inlineSelectedPriority = inlineFormCard.querySelector('input[name="inline-task-priority"]:checked')?.value;

        if (!inlineTitle) {
            alert('Please enter a task title.');
            return;
        }
        if (!inlineSelectedType || !inlineSelectedPriority) {
            alert('Please select a Unit and Priority.');
            return;
        }

        const submitTaskData = {
            title: inlineTitle,
            type: inlineSelectedType,
            priority: inlineSelectedPriority,
            status: inlineFormCard.dataset.originalStatus
        };

        if (mode === 'edit' && taskData) {
            await updateTask(taskData.id, submitTaskData, inlineFormCard);
        } else {
            await addTask(submitTaskData, inlineFormCard);
        }
    });

    // Event listener for Cancel button in edit mode
    if (mode === 'edit') {
        inlineFormCard.querySelector('.cancel-btn').addEventListener('click', () => {
            inlineFormCard.remove();
            activeInlineForm = null;
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
            renderTasks();
        });
        // Event listener for Delete button in edit mode
        inlineFormCard.querySelector('.delete-btn-inline').addEventListener('click', () => {
            const confirmDelete = confirm('Are you sure you want to delete this task?');
            if (confirmDelete) {
                deleteTask(taskData.id);
            }
        });
    }

    // Add a global click listener to close the inline form when clicking outside
    setTimeout(() => {
        document.addEventListener('click', handleClickOutsideOfInlineForm);
    }, 50);
}

// Function to open inline ADD task form
function openInlineAddTask(columnListElement, status) {
    createAndInsertInlineForm(columnListElement, 'add', null);
}

// Function to open inline EDIT task form
function openInlineEditTask(taskData) {
    const taskCardElement = document.querySelector(`.task-card[data-id="${taskData.id}"]`);
    if (taskCardElement) {
        createAndInsertInlineForm(taskCardElement, 'edit', taskData);
    } else {
        console.error('Task card element not found for editing:', taskData.id);
        alert('Could not open edit form for this task.');
    }
}


// --- Date Navigation Logic ---
function updateDateDisplay() {
    currentDateInput.value = formatDateToYYYYMMDD(currentDisplayDate);

    // Disable/enable Prev/Next buttons based on date (buttons removed, but logic can stay if ever re-added)
    const today = new Date();
    today.setHours(0,0,0,0);
    const displayDateNormalized = new Date(currentDisplayDate);
    displayDateNormalized.setHours(0,0,0,0);

    // prevDayBtn.removeAttribute('disabled'); // Removed button
    // if (displayDateNormalized.getTime() >= today.getTime()) {
    //     nextDayBtn.setAttribute('disabled', 'true'); // Removed button
    // } else {
    //     nextDayBtn.removeAttribute('disabled'); // Removed button
    // }

    fetchTasksForDate(currentDisplayDate);
}

// Event Listeners for Date Navigation
// prevDayBtn.addEventListener('click', () => { ... }); // Removed button
// nextDayBtn.addEventListener('click', () => { ... }); // Removed button

currentDateInput.addEventListener('change', (e) => {
    currentDisplayDate = new Date(e.target.value);
    updateDateDisplay();
});


// --- Event Listeners Global ---
document.addEventListener('DOMContentLoaded', async () => {
    await fetchUnitTypes();

    currentDateInput.value = formatDateToYYYYMMDD(new Date());
    updateDateDisplay();
});

document.querySelectorAll('.add-task-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const status = e.target.dataset.status;
        const columnList = taskLists[status];
        
        if (e.currentTarget.classList.contains('is-x-icon')) {
            if (activeInlineForm && activeInlineForm.dataset.mode === 'add' && activeInlineForm.dataset.originalStatus === status) {
                activeInlineForm.remove();
                activeInlineForm = null;
                document.removeEventListener('click', handleClickOutsideOfInlineForm);
                resetAddButtonIcon(status);
                renderTasks();
            }
        } else {
            openInlineAddTask(columnList, status);
        }
        e.stopPropagation();
    });
});

Object.values(taskLists).forEach(list => {
    list.addEventListener('dragover', handleDragOver);
    list.addEventListener('dragenter', handleDragEnter);
    list.addEventListener('dragleave', handleDragLeave);
    list.addEventListener('drop', handleDrop);
});