const express = require("express");
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'nodejs',
    password: '123',
    port: '5432',
});


const app = express();
app.use(express.json());
app.use(cookieParser('1'));


async function authMiddleware(req, res, next) {
    // const userId = req.signedCookies.session;
    // const userExists = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    // if (!userId) {
    //   return res.redirect("/");
    // }

    // if (userExists.rows.length == 0) {
    //   return res.status(401).send('Пользователь не найден');
    // }
    
    next();
 
}

app.get("/", function(request, response){
    response.sendFile(__dirname+"/templates/index.html");
});

app.post('/notes', async (req, res) => {
  const { dateStart, dateEnd } = req.body;

  let query;
  let params = [];
  
  if (!dateStart) {
    // Если дата не указана - возвращаем все записи
    query = 'SELECT * FROM notes ORDER BY id;';
  } else if (dateEnd) {
    // Фильтр по диапазону дат
    query = `
      SELECT * FROM notes
      WHERE EXISTS (
        SELECT 1 FROM unnest(date) AS d
        WHERE d BETWEEN $1 AND $2
      ) ORDER BY id;
    `;
    params = [dateStart, dateEnd];
  } else {
    // Фильтр по одной дате
    query = 'SELECT * FROM notes WHERE $1 = ANY(date) ORDER BY id;';
    params = [dateStart];
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ 
      error: 'Ошибка при выполнении запроса',
      details: error.message 
    });
  }
});


app.post("/reply", authMiddleware, async (request, response) => {
  const allNotes = await pool.query('SELECT * FROM notes ORDER BY id;');
  const { status, text, noteId } = request.body;
  await pool.query("UPDATE public.notes	SET status=$1 WHERE id = $2;", [status, noteId]);
  await pool.query("UPDATE public.notes	SET answer=$1 WHERE id = $2;", [text, noteId]);
  // console.log(status, text, noteId);status, replText, noteId
  // console.log();
  response.send(allNotes.rows);
});

app.get("/edit_note/:id", authMiddleware, async (request, response) => {
  // const allNotes = await pool.query('SELECT * FROM notes');
  response.sendFile(__dirname+"/templates/edit.html");
  // response.send(allNotes.rows);
});

app.get("/get_note/:id", async (request, response) => {
  const noteId = request.params.id;
  const note = await pool.query('SELECT * FROM notes WHERE id = $1', [noteId]);
  await pool.query("UPDATE public.notes	SET status= 'work' WHERE id = $1 AND status='new';", [noteId]);
  response.json(note.rows[0]); // Отправляем данные заметки в формате JSON
});

app.get("/cancel_notes", async (request, response) => {
  await pool.query("UPDATE public.notes	SET status= 'cancel' WHERE status='work';");
  response.json({'text':'ok'}); // Отправляем данные заметки в формате JSON
});

app.post('/addNote', async (req, res) => {
  const { title, text } = req.body;
  
  try {

    await pool.query('INSERT INTO notes (title, text, status) VALUES ($1, $2, $3)', [title, text, 'new']);
    res.status(201).send({"text":"ok"});
  } catch (error) {
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/register', async (req, res) => {
    const { login, password } = req.body;
    console.log(req.body);
    try {
      const userExists = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
      if (userExists.rows.length > 0) {
        return res.status(409).send('Пользователь с таким логином уже существует');
      }
  
      
      await pool.query('INSERT INTO users (login, password) VALUES ($1, $2)', [login, password]);
      res.status(201).send('Регистрация успешна');
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      res.status(500).send('Ошибка сервера');
    }
  });

  app.get("/login", async (request, response) => {
    
    response.sendFile(__dirname+"/templates/login.html");
  });
  app.post('/login', async (req, res) => {
    const { login, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
  
    // Проверка пользователя
    console.log(result.rows[0].password);
  
    
  
    if (result.rows[0].password == password){
        res.cookie('session', result.rows[0].id, {
        signed: true,
        httpOnly: false,
        //   secure: process.env.NODE_ENV === 'production', // HTTPS в продакшене
        maxAge: 24 * 60 * 60 * 1000, // 1 день
        sameSite: 'strict'
        });
  
    res.send('Авторизация успешна');
}   else {
    res.send('ошибка');
}
  });

app.listen(3000);