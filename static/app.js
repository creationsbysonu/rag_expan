// App State
let currentSessionId = 'default';
let selectedFiles = [];
let isProcessing = false;
let currentAbortController = null;
let editingMessageId = null;

// UI Text (English only)
const uiText = {
    chatTitle: '💬 RAG CHAT',
    welcomeTitle: 'Welcome to RAG CHAT!',
    welcomeMsg: 'You can ask questions about your uploaded documents. To get started, type your question below.',
    placeholder: 'Type your question here... (Enter to send, Shift+Enter for new line)',
    send: 'Send',
    stop: 'Stop',
    clear: 'Clear',
    edit: 'Edit',
    newChat: 'New Chat',
    uploadDoc: 'Upload Document',
    uploadTitle: '📤 Upload Document',
    uploadMsg: 'Select files or drag here',
    uploadBtn: 'Upload & Process',
    noHistory: 'No chat history',
    confirmDelete: 'Are you sure you want to delete this conversation?'
};

// Update UI based on language
function updateUILanguage() {
    const text = uiText;
    
    // Update placeholders and buttons
    const msgInput = document.getElementById('messageInput');
    if (msgInput) msgInput.placeholder = text.placeholder;
    
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.innerHTML = `<span>📤</span><span>${text.send}</span>`;
    
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) stopBtn.innerHTML = `<span>⏹️</span><span>${text.stop}</span>`;
    
    // Update sidebar buttons
    const newChatBtn = document.querySelector('.new-chat-btn');
    if (newChatBtn) newChatBtn.innerHTML = `<span>➕</span><span>${text.newChat}</span>`;
    
    const uploadBtn = document.querySelector('.upload-btn');
    if (uploadBtn) uploadBtn.innerHTML = `<span>📤</span><span>${text.uploadDoc}</span>`;
    
    // Update clear button
    const clearBtn = document.querySelector('.icon-btn');
    if (clearBtn) clearBtn.innerHTML = `🗑️ ${text.clear}`;
    
    // Update empty state if visible
    const emptyState = document.querySelector('.empty-state h3');
    if (emptyState) {
        emptyState.textContent = text.welcomeTitle;
        const emptyMsg = document.querySelector('.empty-state p');
        if (emptyMsg) emptyMsg.textContent = text.welcomeMsg;
    }
    
    // Update modal
    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = text.uploadTitle;
    
    const uploadArea = document.querySelector('.file-upload-area p strong');
    if (uploadArea) uploadArea.textContent = text.uploadMsg;
    
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    if (uploadSubmitBtn) uploadSubmitBtn.textContent = text.uploadBtn;
}

// Language selection
document.addEventListener('DOMContentLoaded', () => {
    updateUILanguage();
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
    autoResizeTextarea();
    setupDragAndDrop();
    focusInput();
});

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    // Add Enter key handler directly
    textarea.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            sendMessage();
            return false;
        }
    });
}

// Focus input on load
function focusInput() {
    const input = document.getElementById('messageInput');
    if (input) input.focus();
}

// Handle key press (Enter to send, Shift+Enter for new line)
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        sendMessage();
        return false;
    }
}

// Create new chat session
function createNewChat() {
    currentSessionId = 'session_' + Date.now();
    document.getElementById('messagesContainer').innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <h3>${uiText.welcomeTitle}</h3>
            <p>${uiText.welcomeMsg}</p>
        </div>
    `;
    loadChatHistory();
    focusInput();
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const question = input.value.trim();
    if (!question || isProcessing) return;
    isProcessing = true;
    
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopBtn');
    const container = document.getElementById('messagesContainer');
    
    // Store message before clearing
    const messageToSend = question;
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');
    
    // If editing, replace the message
    if (editingMessageId) {
        const messageDiv = document.getElementById(editingMessageId);
        if (messageDiv) {
            messageDiv.querySelector('.message-content').textContent = question;
            // Remove all messages after edited one
            let foundEdited = false;
            document.querySelectorAll('.message').forEach(msg => {
                if (foundEdited && msg.id !== editingMessageId) msg.remove();
                if (msg.id === editingMessageId) foundEdited = true;
            });
        }
        editingMessageId = null;
    } else {
        // Remove empty state if present
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        // Add user message
        addMessage('user', question);
    }
    
    // Add assistant message placeholder with typing indicator
    const assistantMessageDiv = addMessage('assistant', '', true);
    const messageContent = assistantMessageDiv.querySelector('.message-content');
    
    try {
        // Create AbortController for stop functionality
        currentAbortController = new AbortController();
        if (stopBtn) stopBtn.style.display = 'flex';
        
        // Stream response
        const response = await fetch('/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                session_id: currentSessionId
            }),
            signal: currentAbortController.signal
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Server error');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullAnswer = '';
        
        // Remove typing indicator
        messageContent.innerHTML = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const data = JSON.parse(line);
                    
                    if (data.type === 'content') {
                        // Append character with typewriter effect
                        fullAnswer += data.data;
                        messageContent.textContent = fullAnswer;
                        scrollToBottom();
                    } else if (data.type === 'done') {
                        fullAnswer = data.data;
                        messageContent.textContent = fullAnswer;
                    } else if (data.type === 'error') {
                        messageContent.innerHTML = `<span style="color: var(--error);">❌ Error: ${data.data}</span>`;
                    }
                } catch (e) {
                    console.error('Error parsing stream:', e);
                }
            }
        }
        
        // Update chat history sidebar
        loadChatHistory();
        
    } catch (error) {
        console.error('Error:', error);
        if (error.name === 'AbortError') {
            // Get the current content from DOM (what was already displayed)
            const currentContent = messageContent.textContent || fullAnswer;
            
            // Keep the partial response and add a stopped indicator
            if (currentContent && currentContent.trim()) {
                // Preserve the text by wrapping it in HTML
                const textSpan = document.createElement('span');
                textSpan.textContent = currentContent;
                
                const stoppedBadge = document.createElement('div');
                stoppedBadge.style.cssText = 'margin-top: 12px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; font-size: 13px; color: var(--text-light); display: inline-flex; align-items: center; gap: 6px;';
                stoppedBadge.innerHTML = '⏹️ Generation stopped';
                
                // Clear and rebuild with both elements
                messageContent.innerHTML = '';
                messageContent.appendChild(textSpan);
                messageContent.appendChild(stoppedBadge);
            } else {
                // No content generated yet
                messageContent.innerHTML = `<span style="color: var(--text-light);">⏹️ Generation stopped before starting</span>`;
            }
        } else {
            const errorMsg = error.message || 'Could not connect to server';
            messageContent.innerHTML = `
                <div style="color: var(--error);">
                    <p>❌ Error: ${errorMsg}</p>
                    <p style="font-size: 12px; margin-top: 8px; color: var(--text-light);">Please try again</p>
                </div>
            `;
        }
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) stopBtn.style.display = 'none';
        currentAbortController = null;
        focusInput();
    }
}

// Stop generation
function stopGeneration() {
    if (currentAbortController) {
        currentAbortController.abort();
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

// Edit message
function editMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;
    
    const contentDiv = messageDiv.querySelector('.message-content');
    const messageText = contentDiv.textContent;
    
    const input = document.getElementById('messageInput');
    input.value = messageText;
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    
    editingMessageId = messageId;
    
    // Visual feedback
    input.style.borderColor = 'var(--primary)';
    setTimeout(() => { input.style.borderColor = ''; }, 1000);
}

// Add message to chat
function addMessage(role, content, showTyping = false) {
    const container = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.id = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (showTyping) {
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
    } else {
        contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    // Add edit button for user messages
    if (role === 'user' && !showTyping) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.innerHTML = `
            <button class="action-btn" onclick="editMessage('${messageDiv.id}')">
                ✏️ ${uiText.edit}
            </button>
        `;
        messageDiv.appendChild(actionsDiv);
    }
    
    container.appendChild(messageDiv);
    
    scrollToBottom();
    
    return messageDiv;
}

// Scroll to bottom
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Load chat history
async function loadChatHistory() {
    try {
        const response = await fetch('/chat/sessions');
        const data = await response.json();
        
        const historyDiv = document.getElementById('chatHistory');
        
        if (data.sessions.length === 0) {
            historyDiv.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--text-light); font-size: 12px;">${uiText.noHistory}</p>`;
            return;
        }
        
        historyDiv.innerHTML = '';
        
        data.sessions.forEach(session => {
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'chat-session';
            if (session.session_id === currentSessionId) {
                sessionDiv.classList.add('active');
            }
            
            const timestamp = session.timestamp ? new Date(session.timestamp).toLocaleDateString('ne-NP') : '';
            
            sessionDiv.innerHTML = `
                <div class="chat-session-title">💬 ${session.preview}</div>
                <div class="chat-session-preview">${session.message_count} messages</div>
                ${timestamp ? `<div style="font-size: 10px; color: var(--text-light); margin-top: 4px;">${timestamp}</div>` : ''}
            `;
            
            sessionDiv.onclick = () => loadSession(session.session_id);
            historyDiv.appendChild(sessionDiv);
        });
        
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Load specific session
async function loadSession(sessionId) {
    try {
        const response = await fetch(`/chat/history/${sessionId}`);
        const data = await response.json();
        
        currentSessionId = sessionId;
        
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        if (data.messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <h3>${uiText.welcomeTitle}</h3>
                    <p>${uiText.welcomeMsg}</p>
                </div>
            `;
        } else {
            data.messages.forEach(msg => {
                addMessage(msg.role, msg.content);
            });
        }
        
        loadChatHistory();
        focusInput();
        
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

// Clear current chat
async function clearCurrentChat() {
    if (!confirm(uiText.confirmDelete)) {
        return;
    }
    
    try {
        await fetch(`/chat/history/${currentSessionId}`, {
            method: 'DELETE'
        });
        
        createNewChat();
        
    } catch (error) {
        console.error('Error clearing chat:', error);
        alert('Error: ' + error.message);
    }
}

// Upload Modal Functions
function openUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
    selectedFiles = [];
    updateFileList();
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    document.getElementById('fileInput').value = '';
    selectedFiles = [];
    updateFileList();
    document.getElementById('uploadStatus').className = 'status-message';
    document.getElementById('uploadStatus').textContent = '';
    document.getElementById('progressBar').classList.remove('active');
}

// Handle file selection
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = [...selectedFiles, ...files];
    updateFileList();
}

// Update file list display
function updateFileList() {
    const fileList = document.getElementById('fileList');
    const submitBtn = document.getElementById('uploadSubmitBtn');
    
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        submitBtn.disabled = true;
        return;
    }
    
    submitBtn.disabled = false;
    
    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span>📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
            <button class="remove-file-btn" onclick="removeFile(${index})">×</button>
        </div>
    `).join('');
}

// Remove file from selection
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
}

// Upload files
async function uploadFiles() {
    if (selectedFiles.length === 0) return;
    
    const submitBtn = document.getElementById('uploadSubmitBtn');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const statusDiv = document.getElementById('uploadStatus');
    
    submitBtn.disabled = true;
    progressBar.classList.add('active');
    statusDiv.className = 'status-message';
    statusDiv.textContent = '';
    
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
            progressFill.style.width = progress + '%';
        }
    }, 200);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        
        const result = await response.json();
        
        if (response.ok) {
            statusDiv.className = 'status-message success';
            statusDiv.innerHTML = `✅ ${result.message}<br>📊 Total Chunks: ${result.total_chunks}`;
            selectedFiles = [];
            document.getElementById('fileInput').value = '';
            updateFileList();
            // Close modal after 2 seconds
            setTimeout(() => {
                closeUploadModal();
            }, 2000);
        } else {
            statusDiv.className = 'status-message error';
            statusDiv.textContent = '❌ ' + result.detail;
        }
        
    } catch (error) {
        clearInterval(progressInterval);
        statusDiv.className = 'status-message error';
        statusDiv.textContent = '❌ Error: ' + error.message;
    } finally {
        submitBtn.disabled = false;
        setTimeout(() => {
            progressBar.classList.remove('active');
            progressFill.style.width = '0%';
        }, 1000);
    }
}

// Setup drag and drop
function setupDragAndDrop() {
    const uploadArea = document.getElementById('fileUploadArea');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('drag-over');
        }, false);
    });
    
    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files);
        selectedFiles = [...selectedFiles, ...files];
        updateFileList();
    }, false);
}

// Theme Management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    const themeIcon = document.getElementById('themeIcon');
    themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// Mobile Sidebar Toggle
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    const menuBtn = document.getElementById('mobileMenuBtn');
    
    sidebar.classList.toggle('mobile-hidden');
    overlay.classList.toggle('active');
    menuBtn.textContent = sidebar.classList.contains('mobile-hidden') ? '☰' : '✕';
}

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
});
