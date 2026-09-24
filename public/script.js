const socket = io(); 

const boardEl = document.getElementById('board');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-input');
const gridSizeSelect = document.getElementById('grid-size');
const statusText = document.getElementById('status-text');
const playerIndicator = document.getElementById('player-indicator');
const roomDisplay = document.getElementById('room-display');
const rematchBtn = document.getElementById('rematch-btn');

// Scoreboard Elements
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreDraws = document.getElementById('score-draws');

let currentRoom = null;
let mySymbol = null;
let isMyTurn = false;
let currentGridSize = 3;

createBtn.addEventListener('click', () => {
  const size = gridSizeSelect.value;
  socket.emit('createRoom', size);
});

joinBtn.addEventListener('click', () => {
  const roomId = roomInput.value.trim();
  if (roomId) socket.emit('joinRoom', roomId);
});

rematchBtn.addEventListener('click', () => {
  socket.emit('rematch', currentRoom);
});

roomDisplay.addEventListener('click', () => {
  navigator.clipboard.writeText(currentRoom).then(() => {
    alert("Room code copied!");
  });
});

function initBoard(size) {
  currentGridSize = size;
  boardEl.innerHTML = ''; // Clear previous board
  boardEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
  boardEl.className = `grid gap-2 bg-slate-700 p-2 rounded-xl mx-auto w-full aspect-square max-h-[60vh] board-${size}`;

  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
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

// Socket Event Listeners
socket.on('roomCreated', ({ roomId, symbol, size }) => {
  currentRoom = roomId;
  mySymbol = symbol;
  initBoard(size);
  showGameUI(roomId, "Waiting for an opponent to join...");
});

socket.on('roomJoined', ({ roomId, symbol, size }) => {
  currentRoom = roomId;
  mySymbol = symbol;
  initBoard(size);
  showGameUI(roomId, "Connected! Game starting...");
});

socket.on('gameUpdate', (gameState) => {
  updateBoardUI(gameState.board);
  updateScoreboard(gameState.scores);
  
  if (gameState.winner) {
    isMyTurn = false;
    if (gameState.winner === 'Draw') {
      statusText.textContent = "It's a Draw!";
    } else {
      statusText.textContent = gameState.winner === mySymbol ? "You Win! 🎉" : "You Lose! 😢";
    }
    boardEl.classList.add('disabled');
    rematchBtn.classList.remove('hidden');
  } else {
    isMyTurn = gameState.turn === mySymbol;
    statusText.textContent = isMyTurn ? "Your turn!" : "Opponent's turn...";
    boardEl.classList.remove('disabled');
    rematchBtn.classList.add('hidden');
  }
});

socket.on('playerDisconnected', () => {
  statusText.textContent = "Opponent disconnected. Game over.";
  boardEl.classList.add('disabled');
  rematchBtn.classList.add('hidden');
  isMyTurn = false;
});

socket.on('errorMsg', (msg) => {
  alert(msg);
});

function showGameUI(roomId, status) {
  lobbyContainer.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  roomDisplay.textContent = `CODE: ${roomId}`;
  playerIndicator.textContent = `You are: ${mySymbol}`;
  playerIndicator.className = mySymbol === 'X' ? 'font-semibold text-blue-400' : 'font-semibold text-pink-400';
  statusText.textContent = status;
  boardEl.classList.add('disabled');
}

function updateBoardUI(boardArray) {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, index) => {
    const val = boardArray[index];
    cell.textContent = val;
    cell.className = 'cell'; 
    if (val !== "") cell.classList.add('disabled'); // Disable clicked cells
    if (val === 'X') cell.classList.add('x-mark');
    if (val === 'O') cell.classList.add('o-mark');
  });
}

function updateScoreboard(scores) {
  scoreX.textContent = scores.X;
  scoreO.textContent = scores.O;
  scoreDraws.textContent = scores.Draws;
}