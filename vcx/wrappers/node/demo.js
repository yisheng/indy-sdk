'use strict'

const util = require('./dist/src/api/utils')

run()

async function run() {
    const provisionConfig = {
        'agency_url':'http://localhost:8080',
        'agency_did':'VsKV7grR1BUE29mG2Fm2kX',
        'agency_verkey':'Hezce2UWMZ3wUhVkh2LfKSs8nDzWwzs2Win7EzNN3YaR',
        'wallet_name':'faber_wallet',
        'wallet_key':'123',
        'payment_method': 'null',
        'enterprise_seed':'19e2ea3730c3d62f36a095a44d343c7f5d81e0168c7f987b3d70a37c516bb45d'
    }

    let vcxConfig = JSON.parse(await util.provisionAgent(JSON.stringify(provisionConfig)))

    let version = util.getVersion()

    console.log(vcxConfig.genesis_path)
    console.log(vcxConfig)
    console.log(version)
}