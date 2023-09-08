const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

const db = mysql.createPool({
  connectionLimit : 10,
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'db',
});

app.use(cors());
app.use(express.json());

app.get('/notify', (req, res) => {
  io.emit('test-completed', {
    message: 'Тест завершен' 
  });
  res.send('Уведомление отправлено');
});

app.get('/restartTimer', (req, res) => {
  io.emit('restart-timer', {
  });
  res.send('Уведомление отправлено');
});

app.post('/saveUid', (req, res) => {
  const uid = req.body.uid;

  const checkSql = 'SELECT COUNT(*) AS count FROM uid WHERE uidcol = ?';

  db.query(checkSql, [uid], (err, result) => {
    if (err) {
      console.error('Ошибка при выполнении SQL запроса:', err);
      res.status(500).send('Ошибка сервера');
    } else {
      const count = result[0].count;

      if (count === 0) {
        const insertSql = 'INSERT INTO uid (uidcol) VALUES (?)';
        db.query(insertSql, [uid], (err, result) => {
          if (err) {
            console.error('Ошибка при выполнении SQL запроса:', err);
            res.status(500).send('Ошибка сервера');
          } else {
            console.log('UID успешно сохранен в баdbзе данных');
            res.status(200).send('UID успешно сохранен');
          }
        });
      } else {
        console.log('UID уже существует в базе данных');
        res.status(200).send('UID уже существует');
      }
    }
  });
});

app.post('/uidLogin', (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ message: 'Введите номер UID' });
  }
  db.query('SELECT * FROM uid WHERE uidcol = ?', [uid], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
    if (results.length === 0) {
      return res.status(401).json({ message: 'Неверный UID' });
    }
    io.emit('uid-authorized', {});
    return res.status(200).json({ message: 'Успешная авторизация' });
  });
});

io.on('connection', (socket) => {
  let clientType = 'Unknown';
  let isDeviceConnected = false;
  socket.on('client-type', (clientType, uid) => {
    socket.clientType = clientType;
    socket.uid = uid;
    socket.emit('welcome', `Добро пожаловать на сервер, ${clientType} устройство с UID ${uid}`);
    io.emit('user-connected', {
      clientType: clientType,
      uid: uid
    });
    console.log(`Подключено ${clientType} устройство с UID ${uid}`);
  });

  socket.on('wpf-disconnected', () => {
    io.emit('connection-status', { connected: false });
  });
  socket.on('time-received', (timeInSeconds) => {
    console.log('Received time:', timeInSeconds);
    io.emit('time-received', timeInSeconds);
  });
  socket.on('timer-finished', () => {
    console.log('Timer finished');
    io.emit('timer-finished');
  });
  socket.on('continue-work', () => {
    io.emit('continue-work');
  });
  socket.on('finish-work', () => {
    io.emit('finish-work');
  });
  socket.on('process-data', (data) => {
    io.emit('process-data', data);
  });
  socket.on('disconnect', () => {
    const { clientType, uid } = socket;
    if (clientType && uid) {
      console.log(`A ${clientType} app with UID ${uid} disconnected`);
      io.emit('user-disconnected', `${clientType} app with UID ${uid} disconnected`);
      io.emit('connection-status', { uid, connected: false });
    }
    io.emit('connection-status', { uid, connected: false });
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});