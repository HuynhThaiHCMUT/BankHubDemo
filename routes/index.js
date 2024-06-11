const { default: axios } = require('axios');
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/cancel', function(req, res, next) {
  let title, message
  switch (req.query.type) {
    case "cancel":
      title = "Yêu cầu đã bị huỷ"
      break
    case "database":
      title = "Lỗi cơ sở dữ liệu"
      break
    case "exchangeFailed":
      title = "Trao đổi token với bankHub thất bại"
      break
    default:
      title = "Lỗi không xác định"
  }
  res.render('cancel', {title: title, message: message});
});

router.get('/success', function(req, res, next) {
  res.render('index');
});

module.exports = router;
