const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};
const matchHistory = []; // Backend record for all completed matches

io.on('connection', (socket) => {

  socket.on('createRoom', ({ playerName, size }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const boardSize = parseInt(size) || 3;

    rooms[roomId] = {
      id: roomId,
      size: boardSize,
      players: {
        [socket.id]: { symbol: 'X', name: playerName || 'Player X' }
      },
      board: Array(boardSize * boardSize).fill(""),
      turn: 'X',
      winner: null,
      winPattern: null,
      scores: { X: 0, O: 0, Draws: 0 }
    };

    socket.join(roomId);
    socket.emit('roomCreated', { roomId, symbol: 'X', size: boardSize });
  });

  socket.on('joinRoom', ({ playerName, roomId }) => {
    roomId = roomId.toUpperCase();
    const room = rooms[roomId];

    if (room && Object.keys(room.players).length === 1) {
      room.players[socket.id] = { symbol: 'O', name: playerName || 'Player O' };
      socket.join(roomId);

      const playersList = Object.values(room.players);
      socket.emit('roomJoined', { roomId, symbol: 'O', size: room.size });

      io.to(roomId).emit('gameUpdate', getRoomData(room));
    } else {
      socket.emit('errorMsg', 'Room not found or already full.');
    }
  });

  socket.on('makeMove', ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) return;

    if (!room.winner && room.board[index] === "" && room.turn === player.symbol) {
      room.board[index] = player.symbol;

      const result = checkWin(room.board, room.size);

      if (result) {
        room.winner = result.winner;
        room.winPattern = result.pattern;

        let winningPlayerName = "Draw";
        if (room.winner === 'Draw') {
          room.scores.Draws++;
        } else {
          room.scores[room.winner]++;
          const winnerObj = Object.values(room.players).find(p => p.symbol === room.winner);
          winningPlayerName = winnerObj ? winnerObj.name : room.winner;
        }

        // Record match in backend
        const record = {
          roomId: room.id,
          boardSize: `${room.size}x${room.size}`,
          players: Object.values(room.players).map(p => ({ name: p.name, symbol: p.symbol })),
          winnerSymbol: room.winner,
          winnerName: winningPlayerName,
          timestamp: new Date().toISOString()
        };
        matchHistory.push(record);
      } else {
        room.turn = player.symbol === 'X' ? 'O' : 'X';
      }

      io.to(roomId).emit('gameUpdate', getRoomData(room));
    }
  });

  socket.on('rematch', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.board = Array(room.size * room.size).fill("");
      room.winner = null;
      room.winPattern = null;
      room.turn = 'X';
      io.to(roomId).emit('gameUpdate', getRoomData(room));
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        io.to(roomId).emit('playerDisconnected');
        delete rooms[roomId];
        break;
      }
    }
  });
});

function getRoomData(room) {
  const playersArr = Object.values(room.players);
  const playerX = playersArr.find(p => p.symbol === 'X') || { name: 'Player X' };
  const playerO = playersArr.find(p => p.symbol === 'O') || { name: 'Player O' };

  return {
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    winPattern: room.winPattern,
    scores: room.scores,
    size: room.size,
    playerXName: playerX.name,
    playerOName: playerO.name
  };
}

function checkWin(board, size) {
  for (let r = 0; r < size; r++) {
    let pattern = [];
    for (let c = 0; c < size; c++) pattern.push(r * size + c);
    let first = board[pattern[0]];
    if (first && pattern.every(idx => board[idx] === first)) return { winner: first, pattern };
  }

  for (let c = 0; c < size; c++) {
    let pattern = [];
    for (let r = 0; r < size; r++) pattern.push(r * size + c);
    let first = board[pattern[0]];
    if (first && pattern.every(idx => board[idx] === first)) return { winner: first, pattern };
  }

  let d1Pattern = [];
  for (let i = 0; i < size; i++) d1Pattern.push(i * size + i);
  let d1First = board[d1Pattern[0]];
  if (d1First && d1Pattern.every(idx => board[idx] === d1First)) return { winner: d1First, pattern: d1Pattern };

  let d2Pattern = [];
  for (let i = 0; i < size; i++) d2Pattern.push(i * size + (size - 1 - i));
  let d2First = board[d2Pattern[0]];
  if (d2First && d2Pattern.every(idx => board[idx] === d2First)) return { winner: d2First, pattern: d2Pattern };

  if (!board.includes("")) return { winner: 'Draw', pattern: null };

  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));