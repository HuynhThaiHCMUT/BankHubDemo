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
                $accessToken: value.data.accessToken
            }
            console.log(value.data)
            console.log(data)

            const insertQuery = `
            INSERT INTO link (grantId, accessToken)
            VALUES ($grantId, $accessToken)
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

module.exports = router