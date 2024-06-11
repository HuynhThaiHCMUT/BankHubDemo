const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

db.run(`
  CREATE TABLE IF NOT EXISTS link (
    grantId TEXT PRIMARY KEY,
    accessToken TEXT NOT NULL UNIQUE
  )`, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  } else {
    console.log('Table "link" created successfully.');
  }
})

process.on('exit', function() {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Database connection closed.');
  });
});

module.exports = db