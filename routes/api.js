var express = require('express');
var axios = require('axios')
var QRCode = require('qrcode')
var router = express.Router()
require('dotenv').config()

var db = require('./database')

var bankHubUrl = 'https://sandbox.bankhub.dev'
var clientId = process.env.CLIENT_ID
var secretKey = process.env.SECRET_KEY

if (!clientId || !secretKey) {
    console.log("Environment variable not properly configured!")
    process.exit(1)
}

router.post('/link', function(req, res) {
    axios({
        url: '/grant/token',
        method: 'post',
        baseURL: bankHubUrl,
        headers: {
            'x-client-id': clientId,
            'x-secret-key': secretKey
        },
        data: {
            "scopes": "transaction,qrpay",
            "redirectUri": "http://localhost:3000/api/callback",
            "language": "vi"
        }
    }).then((value) => {
        res.redirect(`https://dev.link.bankhub.dev?grantToken=${value.data.grantToken}&redirectUri=http://localhost:3000/api/callback&iframe=false`)
    }).catch((reason) => {
        console.log(reason)
    })
})

router.get('/callback', function(req, res) {
    publicToken = req.query.publicToken
    if (!publicToken) {
      res.redirect('../cancel?type=cancel');
    } else {
        axios({
            url: '/grant/exchange',
            method: 'post',
            baseURL: bankHubUrl,
            headers: {
                'x-client-id': clientId,
                'x-secret-key': secretKey
            },
            data: {
                'publicToken': publicToken
            }
        }).then((value) => {
            data = {
                $grantId: value.data.grantId,
                $accessToken: value.data.accessToken,
                $time: (new Date()).getTime()
            }

            const insertQuery = `
            INSERT INTO link (grantId, accessToken, time)
            VALUES ($grantId, $accessToken, $time)
            `;
            db.run(insertQuery, data, function(err) {
                if (err) {
                    console.log(err)
                    res.redirect('../cancel?type=database');
                } else {
                    res.redirect('../success');
                }
            })
        }).catch((reason) => {
            console.log(reason)
            res.redirect('../cancel?type=exchangeFailed');
        })
    }
})

router.get('/transactions', function(req, res) {
    grantId = req.query.id
    if (!grantId) {
        res.status(400).send({
            message: "Missing grantId"
        })
    } else {
        db.get("SELECT accessToken FROM link WHERE grantId = ?", grantId, (err, row) => {
            if (err) {
                res.status(500).send({
                    message: "Server database error"
                })
            }
            else if (!row || !row.accessToken) {
                res.status(404).send({
                    message: "Grant ID not found"
                })
            } else {
                axios({
                    url: '/transactions',
                    method: 'get',
                    baseURL: bankHubUrl,
                    headers: {
                        'x-client-id': clientId,
                        'x-secret-key': secretKey,
                        'Authorization': row.accessToken
                    },
                }).then((value) => {
                    res.send(value.data)
                }).catch((reason) => {
                    console.log(reason)
                    res.status(502).send({
                        message: reason.response?.data?.errorMessage
                    })
                })
            }
        })
    }
})

router.delete('/delete', function(req, res) {
    grantId = req.query.id
    if (!grantId) {
        res.status(400).send({
            message: "Missing grantId"
        })
    } else {
        db.get("SELECT accessToken FROM link WHERE grantId = ?", grantId, (err, row) => {
            if (err) {
                res.status(500).send({
                    message: "Server database error"
                })
            }
            if (!row || !row.accessToken) {
                res.status(404).send({
                    message: "Grant ID not found"
                })
            }
            axios({
                url: '/grant/remove',
                method: 'post',
                baseURL: bankHubUrl,
                headers: {
                    'x-client-id': clientId,
                    'x-secret-key': secretKey,
                    'Authorization': row.accessToken
                },
            }).then((value) => {
                db.run("DELETE FROM link WHERE grantId = ?", grantId, (err, row) => {
                    if (err) {
                        res.status(500).send({
                            message: "Server database error"
                        })
                    } else {
                        res.send(value.data)
                    }
                })
            }).catch((reason) => {
                console.log(reason)
                res.status(502).send({
                    message: reason.response?.data?.errorMessage
                })
            })
        })
    }
})

router.post('/qrpay', function(req, res) {
    grantId = req.body.id
    amount = req.body.amount
    desc = req.body.desc
    if (!grantId || !amount || ! desc) {
        res.status(400).send({
            message: "Thông tin được điền không đầy đủ"
        })
    } else {
        db.get("SELECT accessToken FROM link WHERE grantId = ?", grantId, (err, row) => {
            if (err) {
                res.status(500).send({
                    message: "Server database error"
                })
            }
            if (!row || !row.accessToken) {
                res.status(404).send({
                    message: "Grant ID not found"
                })
            }
            axios({
                url: '/qr-pay',
                method: 'post',
                baseURL: bankHubUrl,
                headers: {
                    'x-client-id': clientId,
                    'x-secret-key': secretKey,
                    'Authorization': row.accessToken
                },
                data: {
                    'amount': amount,
                    'description': desc,
                    'referenceNumber': 'none',
                }
            }).then((value) => {
                QRCode.toDataURL(value.data?.qrPay?.qrCode, (err, qrCodeUrl) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Error generating QR Code');
                    }
                    res.send({
                        desc: value.data?.qrPay?.description,
                        qrCode: qrCodeUrl
                    });
                });
            }).catch((reason) => {
                console.log(reason)
                res.status(502).send({
                    message: reason.response?.data?.errorMessage
                })
            })
        })
    }
})

router.post('/webhook', function(req, res) {
    console.log("Webhook data: " + JSON.stringify(req.body));
    const io = req.app.get('socketio');
    io.emit('paymentReceived', {
        grantId: req.body.grantId,
        desc: req.body.transaction?.description
    })
    res.status(200).send()
})

module.exports = router