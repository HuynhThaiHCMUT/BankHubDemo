var express = require('express');
var axios = require('axios')
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
        url: `${bankHubUrl}/grant/token`,
        method: 'post',
        baseURL: bankHubUrl,
        headers: {
            'x-client-id': clientId,
            'x-secret-key': secretKey
        },
        data: {
            "scopes": "transaction",
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
            url: `${bankHubUrl}/grant/exchange`,
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
            if (!row || !row.accessToken) {
                res.status(404).send({
                    message: "Grant ID not found"
                })
            }
            axios({
                url: `${bankHubUrl}/transactions`,
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
                    message: "Can't get transactions data from bankHub"
                })
            })
        })
    }
})

router.delete('/delete', function(req, res) {
    
})

module.exports = router