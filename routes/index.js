const { default: axios } = require('axios');
var express = require('express');
var router = express.Router();
var db = require('./database')

/* GET home page. */
router.get('/', function(req, res, next) {
  data = [];
  db.all("SELECT grantId, time FROM link ORDER BY time", (err, rows) => {
    if (rows) {
      rows.map((value) => value.time = (new Date(value.time)).toLocaleString())
      data = rows;
    }
    res.render('index', {data: data});
  })
});

router.get('/cancel', function(req, res, next) {
  let title, message;
  switch (req.query.type) {
    case "cancel":
      title = "Yêu cầu đã bị huỷ";
      break;
    case "database":
      title = "Lỗi cơ sở dữ liệu";
      break;
    case "exchangeFailed":
      title = "Trao đổi token với bankHub thất bại";
      break;
    default:
      title = "Lỗi không xác định";
  }
  res.render('cancel', {title: title, message: message});
});

router.get('/success', function(req, res, next) {
  res.render('success');
});

module.exports = router;
