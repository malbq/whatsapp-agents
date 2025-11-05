import type { Candidate, InterviewSlot, Interview } from '../types'

export function Layout(title: string, content: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f5f5;
        color: #333;
        line-height: 1.6;
      }
      .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px;
      }
      header {
        background: white;
        border-bottom: 2px solid #e0e0e0;
        padding: 20px 0;
        margin-bottom: 30px;
      }
      h1 {
        font-size: 28px;
        color: #1a1a1a;
      }
      h2 {
        font-size: 20px;
        margin-bottom: 15px;
        color: #1a1a1a;
      }
      .card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid #e0e0e0;
      }
      th {
        background: #f9f9f9;
        font-weight: 600;
        color: #555;
      }
      tr:hover {
        background: #f9f9f9;
      }
      .btn {
        display: inline-block;
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        text-decoration: none;
        font-size: 14px;
      }
      .btn:hover {
        background: #0056b3;
      }
      .btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      .btn-success {
        background: #28a745;
      }
      .btn-success:hover:not(:disabled) {
        background: #218838;
      }
      .badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }
      .badge-scheduled { background: #fff3cd; color: #856404; }
      .badge-confirmed { background: #d4edda; color: #155724; }
      .badge-cancelled { background: #f8d7da; color: #721c24; }
      .badge-completed { background: #d1ecf1; color: #0c5460; }
      .badge-initial { background: #e7f3ff; color: #004085; }
      .badge-scheduling { background: #fff3cd; color: #856404; }
      .badge-rescheduling { background: #ffeaa7; color: #856404; }
      .message {
        padding: 10px 15px;
        margin: 5px 0;
        border-radius: 6px;
      }
      .message-user {
        background: #e3f2fd;
        margin-left: 20%;
      }
      .message-assistant {
        background: #f5f5f5;
        margin-right: 20%;
      }
      .message-header {
        font-size: 11px;
        color: #666;
        margin-bottom: 5px;
      }
      .nav {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
      }
      .nav a {
        color: #007bff;
        text-decoration: none;
        padding: 8px 12px;
        border-radius: 4px;
      }
      .nav a:hover {
        background: #e7f3ff;
      }
      .nav a.active {
        background: #007bff;
        color: white;
      }
      .error {
        color: #721c24;
        background: #f8d7da;
        padding: 12px;
        border-radius: 4px;
        margin: 10px 0;
      }
      .success {
        color: #155724;
        background: #d4edda;
        padding: 12px;
        border-radius: 4px;
        margin: 10px 0;
      }
      .loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .slots-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 15px;
        margin-top: 15px;
      }
      .slot-card {
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
        transition: all 0.2s;
      }
      .slot-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
      .slot-card.available {
        border-color: #28a745;
        background: #f8fff9;
      }
      .slot-card.booked {
        border-color: #ffc107;
        background: #fffef5;
      }
      .slot-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #e0e0e0;
      }
      .slot-date {
        font-weight: 600;
        font-size: 14px;
        color: #333;
      }
      .slot-time {
        font-size: 18px;
        font-weight: bold;
        color: #007bff;
      }
      .slot-status {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .slot-status.available {
        background: #28a745;
        color: white;
      }
      .slot-status.booked {
        background: #ffc107;
        color: #000;
      }
      .interview-info {
        margin-top: 10px;
        padding: 10px;
        background: #f9f9f9;
        border-radius: 4px;
        font-size: 13px;
      }
      .interview-info-row {
        display: flex;
        justify-content: space-between;
        margin: 5px 0;
      }
      .interview-info-label {
        color: #666;
        font-weight: 600;
      }
      .interview-info-value {
        color: #333;
      }
      .btn-danger {
        background: #dc3545;
      }
      .btn-danger:hover:not(:disabled) {
        background: #c82333;
      }
      .interview-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container">
        <h1>${title}</h1>
      </div>
    </header>
    <div class="container">
      <nav class="nav">
        <a href="/" class="${title === 'Dashboard' ? 'active' : ''}">Dashboard</a>
        <a href="/threads" class="${title === 'Message Threads' ? 'active' : ''}">Threads</a>
      </nav>
      ${content}
    </div>
  </body>
</html>
  `.trim()
}

interface DashboardPageProps {
  candidates: Candidate[]
  slots: InterviewSlot[]
  interviews: Interview[]
  startSecretToken: string
}

function generateSlotsGrid(
  slots: InterviewSlot[],
  interviews: Interview[],
  candidates: Candidate[]
): string {
  if (slots.length === 0) {
    return '<p style="color: #666; margin-top: 15px;">No interview slots configured yet.</p>'
  }

  // Create a map of interviews by slotId for quick lookup
  const interviewsBySlot = new Map<string, Interview>()
  for (const interview of interviews) {
    interviewsBySlot.set(interview.slotId, interview)
  }

  // Create a map of candidates by id for quick lookup
  const candidatesById = new Map<string, Candidate>()
  for (const candidate of candidates) {
    candidatesById.set(candidate.id, candidate)
  }

  // Sort slots by date and time
  const sortedSlots = [...slots].toSorted((a, b) => {
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare
    return a.time.localeCompare(b.time)
  })

  const slotCards = sortedSlots
    .map((slot) => {
      const interview = interviewsBySlot.get(slot.id)
      const isBooked = !slot.available && slot.candidateId
      const candidate = slot.candidateId ? candidatesById.get(slot.candidateId) : undefined

      // Format date nicely
      let formattedDate = slot.date
      try {
        const dateParts = slot.date.split('-')
        if (dateParts.length === 3) {
          const dateObj = new Date(
            parseInt(dateParts[0] || '0'), 
            parseInt(dateParts[1] || '0') - 1, 
            parseInt(dateParts[2] || '0')
          )
          formattedDate = dateObj.toLocaleDateString('pt-BR', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })
        }
      } catch {
        // If date parsing fails, use the original format
        formattedDate = slot.date
      }

      return `
        <div class="slot-card ${slot.available ? 'available' : 'booked'}">
          <div class="slot-header">
            <div class="slot-date">${formattedDate}</div>
            <span class="slot-status ${slot.available ? 'available' : 'booked'}">
              ${slot.available ? 'Available' : 'Booked'}
            </span>
          </div>
          <div class="slot-time">${slot.time}</div>
          
          ${
            isBooked && interview
              ? `
            <div class="interview-info">
              <div class="interview-info-row">
                <span class="interview-info-label">Candidate:</span>
                <span class="interview-info-value">${interview.candidateName}</span>
              </div>
              <div class="interview-info-row">
                <span class="interview-info-label">Position:</span>
                <span class="interview-info-value">${candidate?.position || 'N/A'}</span>
              </div>
              <div class="interview-info-row">
                <span class="interview-info-label">Status:</span>
                <span class="badge badge-${interview.status}">${interview.status}</span>
              </div>
              ${
                interview.result
                  ? `
              <div class="interview-info-row">
                <span class="interview-info-label">Result:</span>
                <span style="font-weight: 600; color: ${interview.result === 'approved' ? '#28a745' : '#dc3545'}">
                  ${interview.result.toUpperCase()}
                </span>
              </div>
              `
                  : ''
              }
              <div class="interview-actions">
                <button
                  class="btn btn-danger"
                  onclick="deleteInterview('${interview.id}', '${interview.candidateName}')"
                  style="width: 100%; font-size: 12px; padding: 6px 12px;"
                >
                  Delete Interview
                </button>
              </div>
            </div>
          `
              : isBooked && candidate
                ? `
            <div class="interview-info">
              <div class="interview-info-row">
                <span class="interview-info-label">Candidate:</span>
                <span class="interview-info-value">${candidate.name}</span>
              </div>
              <div class="interview-info-row">
                <span class="interview-info-label">Position:</span>
                <span class="interview-info-value">${candidate.position}</span>
              </div>
            </div>
          `
                : ''
          }
        </div>
      `
    })
    .join('')

  return `<div class="slots-grid">${slotCards}</div>`
}

export function DashboardPage({ candidates, slots, interviews, startSecretToken }: DashboardPageProps) {
  const candidateRows = candidates
    .map(
      (candidate) => `
    <tr>
      <td>${candidate.name}</td>
      <td>${candidate.position}</td>
      <td>${candidate.phone}</td>
      <td>
        <span class="badge badge-${candidate.currentFlow || 'initial'}">
          ${candidate.currentFlow || 'not started'}
        </span>
      </td>
      <td>
        <button
          class="btn btn-success"
          onclick="startFlow('${candidate.phone}', '${startSecretToken}')"
          style="margin-right: 5px;"
        >
          Start Flow
        </button>
        <button
          class="btn"
          onclick="editCandidate('${candidate.id}')"
          style="margin-right: 5px; background: #ffc107; color: #000;"
        >
          Edit
        </button>
        <button
          class="btn"
          onclick="deleteCandidate('${candidate.id}', '${candidate.name}')"
          style="background: #dc3545;"
        >
          Delete
        </button>
      </td>
    </tr>
  `
    )
    .join('')

  const content = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0;">Candidates</h2>
        <button class="btn" onclick="showCreateForm()">+ Add Candidate</button>
      </div>

      <!-- Create/Edit Form Modal -->
      <div id="candidateModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 8px; min-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          <h2 id="modalTitle" style="margin-bottom: 20px;">Add Candidate</h2>
          <form id="candidateForm" onsubmit="return false;">
            <input type="hidden" id="candidateId" />
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Name *</label>
              <input type="text" id="candidateName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Position *</label>
              <input type="text" id="candidatePosition" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Phone *</label>
              <input type="tel" id="candidatePhone" required placeholder="5511999999999" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
              <button type="button" onclick="hideModal()" class="btn" style="background: #6c757d;">Cancel</button>
              <button type="submit" onclick="saveCandidate()" class="btn btn-success">Save</button>
            </div>
          </form>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Position</th>
            <th>Phone</th>
            <th>Flow Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${candidateRows || '<tr><td colspan="5" style="text-align: center; color: #666;">No candidates yet. Click "Add Candidate" to get started.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Slots and Interviews Section -->
    <div class="card">
      <h2>Interview Slots & Scheduled Interviews</h2>
      ${generateSlotsGrid(slots, interviews, candidates)}
    </div>

    <script>
      function showCreateForm() {
        document.getElementById('modalTitle').textContent = 'Add Candidate';
        document.getElementById('candidateId').value = '';
        document.getElementById('candidateName').value = '';
        document.getElementById('candidatePosition').value = '';
        document.getElementById('candidatePhone').value = '';
        document.getElementById('candidateModal').style.display = 'block';
      }

      async function editCandidate(id) {
        try {
          const response = await fetch('/api/candidates/' + id);
          const data = await response.json();
          
          if (data.success) {
            document.getElementById('modalTitle').textContent = 'Edit Candidate';
            document.getElementById('candidateId').value = data.candidate.id;
            document.getElementById('candidateName').value = data.candidate.name;
            document.getElementById('candidatePosition').value = data.candidate.position;
            document.getElementById('candidatePhone').value = data.candidate.phone;
            document.getElementById('candidateModal').style.display = 'block';
          } else {
            alert('Error: ' + (data.error || 'Failed to load candidate'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      function hideModal() {
        document.getElementById('candidateModal').style.display = 'none';
      }

      async function saveCandidate() {
        const id = document.getElementById('candidateId').value;
        const name = document.getElementById('candidateName').value;
        const position = document.getElementById('candidatePosition').value;
        const phone = document.getElementById('candidatePhone').value;

        if (!name || !position || !phone) {
          alert('All fields are required');
          return;
        }

        try {
          const url = id ? '/api/candidates/' + id : '/api/candidates';
          const method = id ? 'PUT' : 'POST';
          
          const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, position, phone })
          });
          
          const data = await response.json();
          
          if (data.success) {
            hideModal();
            window.location.reload();
          } else {
            alert('Error: ' + (data.error || 'Failed to save candidate'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      async function deleteCandidate(id, name) {
        if (!confirm('Are you sure you want to delete ' + name + '?')) {
          return;
        }

        try {
          const response = await fetch('/api/candidates/' + id, {
            method: 'DELETE'
          });
          
          const data = await response.json();
          
          if (data.success) {
            window.location.reload();
          } else {
            alert('Error: ' + (data.error || 'Failed to delete candidate'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      async function startFlow(phone, token) {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Starting...';
        
        try {
          const response = await fetch('/start?phone=' + encodeURIComponent(phone), {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            alert('Flow started successfully for ' + data.candidate.name);
            window.location.reload();
          } else {
            alert('Error: ' + (data.error || 'Failed to start flow'));
            btn.disabled = false;
            btn.textContent = 'Start Flow';
          }
        } catch (error) {
          alert('Error: ' + error.message);
          btn.disabled = false;
          btn.textContent = 'Start Flow';
        }
      }

      async function deleteInterview(interviewId, candidateName) {
        if (!confirm('Are you sure you want to delete the interview for ' + candidateName + '? This will release the time slot.')) {
          return;
        }

        try {
          const response = await fetch('/api/interviews/' + interviewId, {
            method: 'DELETE'
          });
          
          const data = await response.json();
          
          if (data.success) {
            window.location.reload();
          } else {
            alert('Error: ' + (data.error || 'Failed to delete interview'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }

      // Close modal when clicking outside
      document.getElementById('candidateModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
          hideModal();
        }
      });
    </script>
  `

  return Layout('Dashboard', content)
}

interface Message {
  id: string
  role: string
  type: string
  timestamp: string
  content: string
}

interface Thread {
  userId: string
  userName: string
  externalId: string
  messages: Message[]
}

interface ThreadsPageProps {
  threads: Thread[]
}

export function ThreadsPage({ threads }: ThreadsPageProps) {
  const threadCards =
    threads.length === 0
      ? '<div class="card"><p>No message threads found.</p></div>'
      : threads
          .map(
            (thread) => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 style="margin: 0;">${thread.userName} (${thread.externalId})</h2>
          <button 
            class="btn" 
            onclick="clearMessages('${thread.userId}', '${thread.userName}')"
            style="background: #dc3545;"
          >
            Clear Messages
          </button>
        </div>
        <div class="messages">
          ${
            thread.messages.length === 0
              ? '<p style="color: #666; font-style: italic;">No messages in this thread.</p>'
              : thread.messages
                  .map(
                    (msg) => `
            <div class="message message-${msg.role === 'user' ? 'user' : 'assistant'}">
              <div class="message-header">
                <strong>${msg.role === 'user' ? 'User' : 'Assistant'}</strong> • 
                ${new Date(msg.timestamp).toLocaleString('pt-BR')}
              </div>
              <div>${msg.content}</div>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>
    `
          )
          .join('')

  const script = `
    <script>
      async function clearMessages(userId, userName) {
        if (!confirm('Are you sure you want to clear all messages for ' + userName + '? This action cannot be undone.')) {
          return;
        }

        try {
          const response = await fetch('/api/threads/' + userId + '/messages', {
            method: 'DELETE'
          });
          
          const data = await response.json();
          
          if (data.success) {
            window.location.reload();
          } else {
            alert('Error: ' + (data.error || 'Failed to clear messages'));
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    </script>
  `

  return Layout('Message Threads', threadCards + script)
}
