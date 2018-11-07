"use strict"

const indy = require('indy-sdk')
const util = require('./util')
const assert = require('assert')

run()

async function run() {
    let poolName = 'pool1'
    let poolGenesisTxnPath = await util.getPoolGenesisTxnPath(poolName)
    let poolConfig = {
        "genesis_txn": poolGenesisTxnPath
    }

    try {
        await indy.createPoolLedgerConfig(poolName, poolConfig)
    } catch (e) {
        if (e.message !== "PoolLedgerConfigAlreadyExistsError") {
            throw e
        }
    }

    await indy.setProtocolVersion(2)

    let poolHandle = await indy.openPoolLedger(poolName)

    console.log('=============================================')
    console.log('=== Steward Setup ===')

    console.log('Steward -> Create Wallet')
    let stewardWalletConfig = {'id': 'stewardWalletName'}
    let stewardWalletCredentials = {'key': 'steward_key'}
    let stewardWallet = await createAndOpenWallet(stewardWalletConfig, stewardWalletCredentials)

    console.log('Steward -> Create DID')
    let stewardDidInfo = {
        'seed': '000000000000000000000000Steward1'
    }
    let [stewardDid, stewardVerKey] = await indy.createAndStoreMyDid(stewardWallet, stewardDidInfo)
    console.log({
        'stewardDid': stewardDid,
        'stewardVerKey': stewardVerKey
    })

    console.log('=============================================')
    console.log('=== Park Onboarding And GetVerinym ===')
    
    console.log('Park -> Create Wallet')
    let parkWalletConfig = {'id': 'parkWallet'}
    let parkWalletCredentials = {'key': 'park_key'}
    let parkWallet = await createAndOpenWallet(parkWalletConfig, parkWalletCredentials)

    let [stewardParkDid, stewardParkVerKey, parkStewardDid, parkStewardVerKey] = await onboarding(poolHandle, 'Steward', stewardWallet, stewardDid, 'Park', parkWallet)
    console.log({
        stewardParkDid: stewardParkDid,
        stewardParkVerKey: stewardParkVerKey,
        parkStewardDid: parkStewardDid,
        parkStewardVerKey: parkStewardVerKey
    })

    let parkDid = await getVerinym(poolHandle, 'Steward', stewardWallet, stewardDid, stewardParkVerKey, 'Park', parkWallet, parkStewardDid, parkStewardVerKey, 'TRUST_ANCHOR')
    console.log({
        parkDid: parkDid
    })

    console.log('=============================================')
    console.log('=== Company Onboarding And GetVerinym ===')

    console.log('Company -> Create Wallet')
    let companyWalletConfig = {'id': 'companyWallet'}
    let companyWalletCredentials = {'key': 'company_key'}
    let companyWallet = await createAndOpenWallet(companyWalletConfig, companyWalletCredentials)

    let [stewardCompanyDid, stewardCompanyVerKey, companyStewardDid, companyStewardVerkey] = await onboarding(poolHandle, 'Steward', stewardWallet, stewardDid, 'Company', companyWallet)
    console.log({
        stewardCompanyDid: stewardCompanyDid,
        stewardCompanyVerKey: stewardCompanyVerKey,
        companyStewardDid: companyStewardDid,
        companyStewardVerkey: companyStewardVerkey
    })

    let companyDid = await getVerinym(poolHandle, 'Steward', stewardWallet, stewardDid, stewardCompanyVerKey, 'Company', companyWallet, companyStewardDid, companyStewardVerkey, 'TRUST_ANCHOR')
    console.log({
        companyDid: companyDid
    })

    console.log('=============================================')
    console.log('=== Credential Schemas Setup ===')

    console.log('Steward -> Create "Job-Certificate" Schema')
    let [jobCertificateSchemaId, jobCertificateSchema] = await indy.issuerCreateSchema(stewardDid, 'Job-Certificate', '0.1', ['first_name', 'last_name', 'salary', 'status', 'experience'])
    console.log({
        jobCertificateSchemaId: jobCertificateSchemaId,
        jobCertificateSchema: jobCertificateSchema
    })

    console.log('Steward -> Send "Job-Certificate" Schema to Ledger')
    await sendSchema(poolHandle, stewardWallet, stewardDid, jobCertificateSchema)

    console.log('Park -> Create "Park-Certificate" Schema')
    let [parkCertificateSchemaId, parkCertificateSchema] = await indy.issuerCreateSchema(parkDid, 'Park-Certificate', '0.1', ['first_name', 'last_name', 'status', 'level'])
    console.log({
        parkCertificateSchemaId: parkCertificateSchemaId,
        parkCertificateSchema, parkCertificateSchema
    })

    console.log('Park -> Send "Park-Certificate" Schema to Ledger')
    await sendSchema(poolHandle, parkWallet, parkDid, parkCertificateSchema)

    console.log('=============================================')
    console.log('=== Company Credential Definition Setup ===')

    console.log('Company -> Get "Job-Certificate" Schema from Ledger')
    let [theJobCertificateSchemaId, theJobCertificateSchema] = await getSchema(poolHandle, companyDid, jobCertificateSchemaId)
    console.log({
        theJobCertificateSchemaId: theJobCertificateSchemaId,
        theJobCertificateSchema: theJobCertificateSchema
    })

    console.log('Company -> Create and store "Company Job-Certificate" Credential Definition')
    let [companyJobCertificateCredDefId, companyJobCertificateCredDefJson] = await indy.issuerCreateAndStoreCredentialDef(companyWallet, companyDid, jobCertificateSchema, 'TAG1', 'CL', '{"support_revocation": false}')
    console.log({
        companyJobCertificateCredDefId: companyJobCertificateCredDefId,
        companyJobCertificateCredDefJson: companyJobCertificateCredDefJson
    })

    console.log('Company -> Send "Company Job-Certificate" Credential Definition to Ledger')
    await sendCredDef(poolHandle, companyWallet, companyDid, companyJobCertificateCredDefJson)


    console.log('=============================================')
    console.log('=== Cleanup ===')

    console.log('Steward -> Close and Delete Wallet')
    await indy.closeWallet(stewardWallet)
    await indy.deleteWallet(stewardWalletConfig, stewardWalletCredentials)

    console.log('Park -> Close and Delete Wallet')
    await indy.closeWallet(parkWallet)
    await indy.deleteWallet(parkWalletConfig, parkWalletCredentials)

    console.log('Company -> Close and Delete Wallet')
    await indy.closeWallet(companyWallet)
    await indy.deleteWallet(companyWalletConfig, companyWalletCredentials)

    console.log('Close and Delete Pool')
    await indy.closePoolLedger(poolHandle)
    await indy.deletePoolLedgerConfig(poolName)
}

async function createAndOpenWallet(config, credentials) {
    try {
        await indy.createWallet(config, credentials)
    } catch (e) {
        if (e.message !== 'WalletAlreadyExistsError') {
            throw e
        }
    }

    return await indy.openWallet(config, credentials)
}

async function onboarding(poolHandle, from, fromWallet, fromDid, to, toWallet) {
    console.log('*** onboarding ***')

    console.log(`${from} -> Create DID \"${from} ${to}\"`)
    let [fromToDid, fromToVerKey] = await indy.createAndStoreMyDid(fromWallet, {})
    console.log({
        fromToDid: fromToDid,
        fromToVerKey: fromToVerKey
    })

    console.log(`${from} -> Send Nym to Ledger for \"${from} ${to}\" DID`)
    await sendNym(poolHandle, fromWallet, fromDid, fromToDid, fromToVerKey, null)

    console.log(`${from} -> Send connection request to ${to} with \"${from} ${to}\" DID and nonce`)
    let connectionRequest = {
        did: fromToDid,
        nonce: 123456
    }
    console.log({
        connectionRequest: connectionRequest
    })

    console.log(`${from} -> Sending request ......`)

    console.log(`${to} -> ...... request received`)

    console.log(`${to} -> Create DID \"${to} ${from}\"`)
    let [toFromDid, toFromVerKey] = await indy.createAndStoreMyDid(toWallet, {})
    console.log({
        toFromDid: toFromDid,
        toFromVerKey: toFromVerKey
    })

    console.log(`${to} -> Get VerKey for Did from \"${from}\"'s connection request`)
    let fromToVerKey2 = await indy.keyForDid(poolHandle, toWallet, connectionRequest.did)
    console.log({
        fromToVerKey2: fromToVerKey2
    })

    console.log(`${to} -> Anoncrypt connection response for \"${from}\" with \"${to} ${from}\" DID, verkey and nonce`)
    let connectionResponse = JSON.stringify({
        did: toFromDid,
        verkey: toFromVerKey,
        nonce: connectionRequest.nonce
    })
    let anoncryptedConnectionResponse = await indy.cryptoAnonCrypt(fromToVerKey2, Buffer.from(connectionResponse, 'utf8'))
    console.log({
        connectionResponse: connectionResponse,
        anoncryptedConnectionResponse: anoncryptedConnectionResponse
    })

    console.log(`${to} -> Sending anoncrypted connection response to \"${from}\" ......`)

    console.log(`${from} -> ...... response received`)

    console.log(`${from} -> Anondecrypt connection response from \"${to}\"`)
    let decryptedConnectionResponse = JSON.parse(Buffer.from(await indy.cryptoAnonDecrypt(fromWallet, fromToVerKey, anoncryptedConnectionResponse)))
    console.log({
        decryptedConnectionResponse: decryptedConnectionResponse
    })

    console.log(`${from} -> Authenticates \"${to}\" by comparision of none`)
    if (connectionRequest.nonce !== decryptedConnectionResponse.nonce) {
        throw Error('nonces do not match')
    }

    console.log(`${from} -> Send Nym to Ledger for \"${to} ${from}\" DID`)
    await sendNym(poolHandle, fromWallet, fromDid, decryptedConnectionResponse.did, decryptedConnectionResponse.verkey)

    return [fromToDid, fromToVerKey, toFromDid, toFromVerKey, decryptedConnectionResponse]
}

async function getVerinym(poolHandle, from, fromWallet, fromDid, fromToVerKey, to, toWallet, toFromDid, toFromVerKey, role) {
    console.log('*** getVerinym ***')
    
    console.log(`${to} -> Create DID`)
    let [toDid, toVerKey] = await indy.createAndStoreMyDid(toWallet, {})
    console.log({
        toDid: toDid,
        toVerKey: toVerKey
    })

    console.log(`${to} -> Authcrypt \"${to}\" DID info for \"${from}\"`)
    let didInfoJson = JSON.stringify({
        did: toDid,
        verkey: toVerKey
    })
    let authcryptedDidInfo = await indy.cryptoAuthCrypt(toWallet, toFromVerKey, fromToVerKey, Buffer.from(didInfoJson, 'utf8'))
    console.log({
        didInfoJson: didInfoJson,
        authcryptedDidInfo: authcryptedDidInfo
    })

    console.log(`${to} -> Sending authcrypted \"${to}\" DID info to \"${from}\" ......`)

    console.log(`${from} -> ...... DID info received`)

    console.log(`${from} -> Authdecrypt \"${to}\" DID info from \"${to}\"`)
    let [senderVerKey, authdecryptedDidInfo] = await indy.cryptoAuthDecrypt(fromWallet, fromToVerKey, Buffer.from(authcryptedDidInfo))
    let authdecryptedDidInfoJson = JSON.parse(Buffer.from(authdecryptedDidInfo))
    console.log({
        senderVerKey: senderVerKey,
        authdecryptedDidInfo: authdecryptedDidInfo,
        authdecryptedDidInfoJson: authdecryptedDidInfoJson
    })

    console.log(`${from} -> Authenticates \"${to}\" by comparison of Verkeys`)
    let retrievedVerKey = await indy.keyForDid(poolHandle, fromWallet, toFromDid)
    console.log({
        retrievedVerKey: retrievedVerKey
    })
    if (senderVerKey !== retrievedVerKey) {
        throw Error('Verkey is not the same')
    }

    console.log(`${from} -> Send Nym to Ledger for \"${to}\" DID with ${role} Role`)
    await sendNym(poolHandle, fromWallet, fromDid, authdecryptedDidInfoJson.did, authdecryptedDidInfoJson.verkey)

    return toDid
}

async function sendNym(poolHandle, walletHandle, submitterDid, targetDid, targetVerKey, role) {
    let nymRequest = await indy.buildNymRequest(submitterDid, targetDid, targetVerKey, null, role)
    await indy.signAndSubmitRequest(poolHandle, walletHandle, submitterDid, nymRequest)
}

async function sendSchema(poolHandle, walletHandle, submitterDid, schema) {
    let schemaRequest = await indy.buildSchemaRequest(submitterDid, schema)
    await indy.signAndSubmitRequest(poolHandle, walletHandle, submitterDid, schemaRequest)
}

async function getSchema(poolHandle, submitterDid, schemaId) {
    let request = await indy.buildGetSchemaRequest(submitterDid, schemaId)
    let response = await indy.submitRequest(poolHandle, request)
    return await indy.parseGetSchemaResponse(response)
}

async function sendCredDef(poolHandle, walletHandle, submitterDid, credDef) {
    let request = await indy.buildCredDefRequest(submitterDid, credDef)
    await indy.signAndSubmitRequest(poolHandle, walletHandle, submitterDid, request)
}
