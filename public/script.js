// public/script.js
const BACKEND_URL = '/api/tasks';

let tasks = []; // Global array to hold all tasks
let activeInlineForm = null; // To keep track of the currently active inline form (add or edit)

// --- DOM Elements ---
const backlogList = document.getElementById('backlog-list');
const ongoingList = document.getElementById('ongoing-list');
const doneList = document.getElementById('done-list');
const taskLists = {
    'Backlog': backlogList,
    'Ongoing': ongoingList,
    'Done': doneList
};

let draggedItem = null;

// --- Helper Functions ---
function getTagColorClass(typeOrPriority, isType = true) {
    if (isType) {
        switch (typeOrPriority) {
            case 'bug': return 'bug';
            case 'feature': return 'feature';
            case 'refactor': return 'refactor';
            default: return 'grey';
        }
    } else {
        switch (typeOrPriority) {
            case 'high': return 'high';
            case 'medium': return 'medium';
            case 'low': return 'low';
            default: return 'grey';
        }
    }
}

// --- Render Functions ---
function createTaskCard(task) {
    const card = document.createElement('div');
    card.classList.add('task-card');
    card.setAttribute('draggable', true);
    card.dataset.id = task.id;
    card.dataset.status = task.status;

    // Menggunakan ikon gear/pengaturan sebagai tombol edit
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

    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    // Event listener untuk tombol '⚙'
    card.querySelector('.edit-options-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Mencegah event lain (misal click outside card)
        openInlineEditTask(task); // Langsung panggil form edit in-line
    });

    return card;
}

function renderTasks() {
    // Clear existing tasks from all lists
    backlogList.innerHTML = '';
    ongoingList.innerHTML = '';
    doneList.innerHTML = '';

    // If there's an active inline form (add or edit), re-insert it at the top of its column
    if (activeInlineForm && activeInlineForm.parentNode) {
        const columnStatus = activeInlineForm.parentNode.closest('.column').dataset.status;
        taskLists[columnStatus].prepend(activeInlineForm);
    }

    // Populate lists based on current tasks array
    tasks.forEach(task => {
        // Only append if the task is not the one currently being edited inline
        if (!activeInlineForm || activeInlineForm.dataset.mode !== 'edit' || activeInlineForm.dataset.id !== task.id) {
            const list = taskLists[task.status];
            if (list) {
                const card = createTaskCard(task);
                list.appendChild(card);
            }
        }
    });
}

// --- API Interactions ---
async function fetchTasks() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        tasks = await response.json();
        renderTasks();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        alert('Failed to load tasks. Please check the server.');
    }
}

async function addTask(taskData, inlineFormElement) { // inlineFormElement is passed from inline add form
    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const newTask = await response.json();
        tasks.push(newTask);
        
        // Remove the inline form after successful save
        if (inlineFormElement && inlineFormElement.parentNode) {
            inlineFormElement.remove();
            activeInlineForm = null; // Clear active inline form reference
            document.removeEventListener('click', handleClickOutsideOfInlineForm); // Remove global listener
        }
        resetAddButtonIcon(taskData.status); // <--- RESET IKON + MENJADI X
        renderTasks(); // Re-render to show new task
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Failed to add task.');
    }
}

async function updateTask(taskId, taskData, inlineFormElement) { // inlineFormElement is passed from inline edit form
    try {
        const response = await fetch(`${BACKEND_URL}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const updatedTask = await response.json();
        const taskIndex = tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex] = updatedTask;
        }
        
        // Remove the inline form after successful save
        if (inlineFormElement && inlineFormElement.parentNode) {
            inlineFormElement.remove(); // Remove the form itself
            activeInlineForm = null; // Clear active inline form reference
            document.removeEventListener('click', handleClickOutsideOfInlineForm); // Remove global listener
        }
        renderTasks(); // Re-render to show updated task
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Failed to update task.');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    try {
        const response = await fetch(`${BACKEND_URL}/${taskId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        tasks = tasks.filter(task => task.id !== taskId);
        // If the deleted task was currently being edited, close the form
        if (activeInlineForm && activeInlineForm.dataset.mode === 'edit' && activeInlineForm.dataset.id === taskId) {
            activeInlineForm.remove();
            activeInlineForm = null;
            document.removeEventListener('click', handleClickOutsideOfInlineForm);
        }
        renderTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
    }
}

// --- Drag and Drop Handlers (Remain unchanged) ---
function handleDragStart(e) {
    // If an inline form is active (add or edit), prevent drag
    if (activeInlineForm) {
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

function handleDrop(e) {
    e.preventDefault();
    const targetList = e.currentTarget;
    targetList.classList.remove('drag-over');

    if (!draggedItem) return;

    const newStatus = targetList.closest('.column').dataset.status;
    const taskId = draggedItem.dataset.id;
    const oldStatus = draggedItem.dataset.status;

    if (oldStatus !== newStatus) {
        updateTaskStatus(taskId, newStatus);
        draggedItem.dataset.status = newStatus;
    }

    const afterElement = getDragAfterElement(targetList, e.clientY);
    if (afterElement == null) {
        targetList.appendChild(draggedItem);
    } else {
        targetList.insertBefore(draggedItem, afterElement);
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
    addButton.innerHTML = '&#x2715;'; // Unicode 'X'
    addButton.classList.add('is-x-icon'); // Add a class to style the 'X' button
}

function resetAddButtonIcon(status) {
    const columnHeader = document.querySelector(`.column[data-status="${status}"] .column-header`);
    const addButton = columnHeader.querySelector('.add-task-btn');
    addButton.innerHTML = '+';
    addButton.classList.remove('is-x-icon');
}

// --- Global handler for clicks outside any active inline form ---
function handleClickOutsideOfInlineForm(event) {
    // If an inline form is active and the click is outside that form, and not on its trigger button
    if (activeInlineForm && !activeInlineForm.contains(event.target) && 
        !event.target.classList.contains('add-task-btn') && 
        !event.target.classList.contains('edit-options-btn')) {
        
        const formStatus = activeInlineForm.dataset.originalStatus; // Get status from the form itself
        activeInlineForm.remove();
        activeInlineForm = null;
        document.removeEventListener('click', handleClickOutsideOfInlineForm);
        // Only reset the add button if the active form was an ADD form
        if (activeInlineForm && activeInlineForm.dataset.mode === 'add') {
             resetAddButtonIcon(formStatus); // Reset the '+' button icon
        } else if (!activeInlineForm) { // If no form is active, reset based on the last form's status
            // This is a fallback if `activeInlineForm` is already null, ensure icon is reset
            resetAddButtonIcon(formStatus); 
        }
        renderTasks(); // Re-render to show original card if it was an edit form
    }
}


// --- INLINE FORM CREATION (for ADD and EDIT) ---
function createAndInsertInlineForm(targetElement, mode, taskData = null) {
    // If there's already an active inline form (either add or edit), close it first
    if (activeInlineForm) {
        // Before removing, reset the '+' button icon for the column where the form was (if it was an ADD form)
        if (activeInlineForm.dataset.mode === 'add') {
            resetAddButtonIcon(activeInlineForm.dataset.originalStatus);
        }
        activeInlineForm.remove();
        activeInlineForm = null;
        document.removeEventListener('click', handleClickOutsideOfInlineForm); // Remove global listener
        renderTasks(); // Re-render to ensure UI is clean before new form
    }

    const inlineFormCard = document.createElement('div');
    inlineFormCard.classList.add('task-card', 'inline-task-form'); // Use a generic class for inline forms
    inlineFormCard.dataset.mode = mode; // Store the mode (add/edit)
    
    // Store task ID for edit mode
    if (mode === 'edit' && taskData) {
        inlineFormCard.dataset.id = taskData.id;
        inlineFormCard.dataset.originalStatus = taskData.status; // Keep original status
    } else { // Add mode
        inlineFormCard.dataset.originalStatus = targetElement.closest('.column').dataset.status;
    }
    // Disable drag for any active form
    inlineFormCard.setAttribute('draggable', false); 


    inlineFormCard.innerHTML = `
        <form class="inline-form">
            <input type="text" class="inline-title-input" placeholder="What are you working on?" required>

            <label class="inline-form-label">Task type</label>
            <div class="radio-group inline-radio-group">
                <label><input type="radio" name="inline-task-type" value="bug"> Bug</label>
                <label><input type="radio" name="inline-task-type" value="feature"> Feature</label>
                <label><input type="radio" name="inline-task-type" value="refactor"> Refactor</label>
            </div>

            <label class="inline-form-label">Priority</label>
            <div class="radio-group inline-radio-group">
                <label><input type="radio" name="inline-task-priority" value="low"> Low</label>
                <label><input type="radio" name="inline-task-priority" value="medium"> Medium</label>
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
        // Replace the original task card with the form
        targetElement.parentNode.replaceChild(inlineFormCard, targetElement);
        // Fill form fields
        inlineFormCard.querySelector('.inline-title-input').value = taskData.title;
        inlineFormCard.querySelector(`input[name="inline-task-type"][value="${taskData.type}"]`).checked = true;
        inlineFormCard.querySelector(`input[name="inline-task-priority"][value="${taskData.priority}"]`).checked = true;
    } else { // Add mode
        targetElement.prepend(inlineFormCard); // Add to the top of the list
        // Set default radios for new tasks
        inlineFormCard.querySelector('input[name="inline-task-type"][value="feature"]').checked = true;
        inlineFormCard.querySelector('input[name="inline-task-priority"][value="medium"]').checked = true;
        setAddButtonIconToX(inlineFormCard.dataset.originalStatus); // Change '+' to 'X' for add mode
    }

    activeInlineForm = inlineFormCard; // Set as current active form
    inlineFormCard.querySelector('.inline-title-input').focus(); // Focus on the new input field


    // Event listener for inline form submission (Save)
    inlineFormCard.querySelector('.inline-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const inlineTitle = inlineFormCard.querySelector('.inline-title-input').value.trim();
        const inlineSelectedType = inlineFormCard.querySelector('input[name="inline-task-type"]:checked')?.value;
        const inlineSelectedPriority = inlineFormCard.querySelector('input[name="inline-task-priority"]:checked')?.value;

        if (!inlineTitle) {
            alert('Please enter a task title.');
            return;
        }
        if (!inlineSelectedType || !inlineSelectedPriority) {
            alert('Please select a task type and priority.');
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
            renderTasks(); // Re-render to show the original card
        });
        // Event listener for Delete button in edit mode
        inlineFormCard.querySelector('.delete-btn-inline').addEventListener('click', () => {
            const confirmDelete = confirm('Are you sure you want to delete this task?');
            if (confirmDelete) {
                deleteTask(taskData.id); // Call delete function
                // deleteTask() will call renderTasks() which will refresh the view
                // and effectively remove the form and task.
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
    // Find the original task card element in the DOM
    const taskCardElement = document.querySelector(`.task-card[data-id="${taskData.id}"]`);
    if (taskCardElement) {
        createAndInsertInlineForm(taskCardElement, 'edit', taskData);
    } else {
        console.error('Task card element not found for editing:', taskData.id);
        alert('Could not open edit form for this task.');
    }
}


// --- Event Listeners Global ---
document.addEventListener('DOMContentLoaded', fetchTasks);

// Event listener for the '+' buttons to create inline add task cards
document.querySelectorAll('.add-task-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const status = e.target.dataset.status;
        const columnList = taskLists[status];
        
        // If the button clicked is currently an 'X' (meaning an add form is active in this column),
        // then clicking it should cancel the form.
        if (e.currentTarget.classList.contains('is-x-icon')) { // Check for the class
            if (activeInlineForm && activeInlineForm.dataset.mode === 'add' && activeInlineForm.dataset.originalStatus === status) {
                activeInlineForm.remove();
                activeInlineForm = null;
                document.removeEventListener('click', handleClickOutsideOfInlineForm);
                resetAddButtonIcon(status);
                renderTasks();
            }
        } else { // Otherwise, open a new add form
            openInlineAddTask(columnList, status);
        }
        e.stopPropagation(); // Prevent immediate click-outside closing
    });
});

// Drag and Drop Listeners for columns (task-list)
Object.values(taskLists).forEach(list => {
    list.addEventListener('dragover', handleDragOver);
    list.addEventListener('dragenter', handleDragEnter);
    list.addEventListener('dragleave', handleDragLeave);
    list.addEventListener('drop', handleDrop);
});