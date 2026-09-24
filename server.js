const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  
  socket.on('createRoom', (size) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const boardSize = parseInt(size) || 3;
    
    rooms[roomId] = {
      id: roomId,
      size: boardSize,
      players: { [socket.id]: 'X' },
      board: Array(boardSize * boardSize).fill(""),
      turn: 'X',
      winner: null,
      scores: { X: 0, O: 0, Draws: 0 }
    };
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, symbol: 'X', size: boardSize });
  });

  socket.on('joinRoom', (roomId) => {
    roomId = roomId.toUpperCase();
    const room = rooms[roomId];

    if (room && Object.keys(room.players).length === 1) {
      room.players[socket.id] = 'O';
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, symbol: 'O', size: room.size });
      io.to(roomId).emit('gameUpdate', room);
    } else {
      socket.emit('errorMsg', 'Room not found or is full.');
    }
  });

  socket.on('makeMove', ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerSymbol = room.players[socket.id];
    
    if (!room.winner && room.board[index] === "" && room.turn === playerSymbol) {
      room.board[index] = playerSymbol;
      room.winner = checkWin(room.board, room.size);
      
      if (room.winner) {
        if (room.winner === 'Draw') room.scores.Draws++;
        else room.scores[room.winner]++;
      } else {
        room.turn = playerSymbol === 'X' ? 'O' : 'X';
      }
      
      io.to(roomId).emit('gameUpdate', room);
    }
  });

  socket.on('rematch', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.board = Array(room.size * room.size).fill("");
      room.winner = null;
      // Loser of previous game goes first, or default to X on draws
      room.turn = room.turn === 'X' ? 'O' : 'X'; 
      io.to(roomId).emit('gameUpdate', room);
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

// Dynamic Win Checker for NxN Grid
function checkWin(board, size) {
  // Check rows
  for (let r = 0; r < size; r++) {
    let first = board[r * size];
    if (first && board.slice(r * size, r * size + size).every(val => val === first)) return first;
  }
  // Check cols
  for (let c = 0; c < size; c++) {
    let first = board[c];
    let win = true;
    if (!first) continue;
    for (let r = 1; r < size; r++) {
      if (board[r * size + c] !== first) { win = false; break; }
    }
    if (win) return first;
  }
  // Check diagonals
  let d1 = board[0], d2 = board[size - 1];
  let d1Win = d1 !== "", d2Win = d2 !== "";
  for (let i = 1; i < size; i++) {
    if (board[i * size + i] !== d1) d1Win = false;
    if (board[i * size + (size - 1 - i)] !== d2) d2Win = false;
  }
  
  if (d1Win) return d1;
  if (d2Win) return d2;
  if (!board.includes("")) return 'Draw';
  
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));