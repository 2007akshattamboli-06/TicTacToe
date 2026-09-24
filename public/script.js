const socket = io();

const body = document.getElementById('body');
const app = document.getElementById('app');
const themeSelector = document.getElementById('theme-selector');

const boardEl = document.getElementById('board');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const playerNameInput = document.getElementById('player-name-input');
const roomInput = document.getElementById('room-input');
const gridSizeSelect = document.getElementById('grid-size');
const statusText = document.getElementById('status-text');
const playerIndicator = document.getElementById('player-indicator');
const roomDisplay = document.getElementById('room-display');
const rematchBtn = document.getElementById('rematch-btn');

const labelX = document.getElementById('label-x');
const labelO = document.getElementById('label-o');
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreDraws = document.getElementById('score-draws');

const strikeLine = document.getElementById('strike-line');

let currentRoom = null;
let mySymbol = null;
let isMyTurn = false;
let currentSize = 3;

// Custom Theme Switching
themeSelector.addEventListener('change', (e) => {
  const theme = e.target.value;
  body.className = "min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ";
  app.className = "w-full max-w-2xl rounded-2xl shadow-2xl p-6 transition-colors duration-300 ";

  if (theme === 'light') {
    body.className += "bg-gray-100 text-gray-900";
    app.className += "bg-white border border-gray-200";
  } else if (theme === 'cyberpunk') {
    body.className += "bg-yellow-400 text-black";
    app.className += "bg-black border-4 border-yellow-300 text-yellow-300";
  } else if (theme === 'emerald') {
    body.className += "bg-emerald-950 text-emerald-100";
    app.className += "bg-emerald-900 border border-emerald-700";
  } else {
    body.className += "bg-slate-900 text-white";
    app.className += "bg-slate-800";
  }
});

createBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player X';
  const size = gridSizeSelect.value;
  socket.emit('createRoom', { playerName, size });
});

joinBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim() || 'Player O';
  const roomId = roomInput.value.trim();
  if (roomId) socket.emit('joinRoom', { playerName, roomId });
});

rematchBtn.addEventListener('click', () => {
  socket.emit('rematch', currentRoom);
});

roomDisplay.addEventListener('click', () => {
  navigator.clipboard.writeText(currentRoom).then(() => alert("Room code copied!"));
});

function initBoard(size) {
  currentSize = size;
  boardEl.innerHTML = '';
  strikeLine.classList.add('hidden');
  boardEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;

  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.style.fontSize = `${Math.max(1.2, 4 - size * 0.35)}rem`;
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleCellClick(i));
    boardEl.appendChild(cell);
  }
}

function handleCellClick(index) {
  if (isMyTurn) {
    socket.emit('makeMove', { roomId: currentRoom, index });
  }
}

socket.on('roomCreated', ({ roomId, symbol, size }) => {
  currentRoom = roomId;
  mySymbol = symbol;
  initBoard(size);
  showGameUI(roomId, "Waiting for an opponent...");
});

socket.on('roomJoined', ({ roomId, symbol, size }) => {
  currentRoom = roomId;
  mySymbol = symbol;
  initBoard(size);
  showGameUI(roomId, "Connected! Match starting...");
});

socket.on('gameUpdate', (gameState) => {
  labelX.textContent = gameState.playerXName;
  labelO.textContent = gameState.playerOName;

  updateBoardUI(gameState.board);
  updateScoreboard(gameState.scores);

  if (gameState.winner) {
    isMyTurn = false;
    if (gameState.winner === 'Draw') {
      statusText.textContent = "It's a Draw!";
    } else {
      const winnerName = gameState.winner === 'X' ? gameState.playerXName : gameState.playerOName;
      statusText.textContent = `${winnerName} Wins! 🎉`;
      if (gameState.winPattern) drawStrikeLine(gameState.winPattern, gameState.size);
    }
    boardEl.classList.add('disabled');
    rematchBtn.classList.remove('hidden');
  } else {
    strikeLine.classList.add('hidden');
    isMyTurn = gameState.turn === mySymbol;
    const activePlayerName = gameState.turn === 'X' ? gameState.playerXName : gameState.playerOName;
    statusText.textContent = isMyTurn ? "Your turn!" : `${activePlayerName}'s turn...`;
    boardEl.classList.remove('disabled');
    rematchBtn.classList.add('hidden');
  }
});

socket.on('playerDisconnected', () => {
  statusText.textContent = "Opponent disconnected. Game over.";
  boardEl.classList.add('disabled');
  rematchBtn.classList.add('hidden');
  strikeLine.classList.add('hidden');
  isMyTurn = false;
});

socket.on('errorMsg', (msg) => alert(msg));

function showGameUI(roomId, status) {
  lobbyContainer.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  roomDisplay.textContent = `CODE: ${roomId}`;
  playerIndicator.textContent = `You are: ${mySymbol}`;
  statusText.textContent = status;
  boardEl.classList.add('disabled');
}

function updateBoardUI(boardArray) {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, index) => {
    const val = boardArray[index];
    cell.textContent = val;
    cell.className = 'cell';
    if (val !== "") cell.classList.add('disabled');
    if (val === 'X') cell.classList.add('text-blue-400');
    if (val === 'O') cell.classList.add('text-pink-400');
  });
}

function updateScoreboard(scores) {
  scoreX.textContent = scores.X;
  scoreO.textContent = scores.O;
  scoreDraws.textContent = scores.Draws;
}

// Function to draw SVG strike line across winning cells
function drawStrikeLine(pattern, size) {
  const cells = document.querySelectorAll('.cell');
  const firstCell = cells[pattern[0]].getBoundingClientRect();
  const lastCell = cells[pattern[pattern.length - 1]].getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();

  const x1 = firstCell.left + firstCell.width / 2 - boardRect.left;
  const y1 = firstCell.top + firstCell.height / 2 - boardRect.top;
  const x2 = lastCell.left + lastCell.width / 2 - boardRect.left;
  const y2 = lastCell.top + lastCell.height / 2 - boardRect.top;

  strikeLine.setAttribute('x1', x1);
  strikeLine.setAttribute('y1', y1);
  strikeLine.setAttribute('x2', x2);
  strikeLine.setAttribute('y2', y2);
  strikeLine.classList.remove('hidden');
}