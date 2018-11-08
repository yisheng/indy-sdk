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

    console.log("\n=============================================")
    console.log("=== Steward Setup ===\n")

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

    console.log("\n=============================================")
    console.log("=== Park Onboarding And GetVerinym ===\n")
    
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

    console.log("\n=============================================")
    console.log("=== Company Onboarding And GetVerinym ===\n")

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

    console.log("\n=============================================")
    console.log("=== Credential Schemas Setup ===\n")

    console.log('Steward -> Create "Job-Certificate" Schema')
    let [jobCertificateSchemaId, jobCertificateSchema] = await indy.issuerCreateSchema(stewardDid, 'Job-Certificate', '0.1', ['first_name', 'last_name', 'salary', 'status', 'experience'])
    console.log({
        jobCertificateSchemaId: jobCertificateSchemaId,
        jobCertificateSchema: jobCertificateSchema
    })

    console.log('Steward -> Send "Job-Certificate" Schema to Ledger')
    await sendSchema(poolHandle, stewardWallet, stewardDid, jobCertificateSchema)

    console.log('Steward -> Create "Park-Certificate" Schema')
    let [parkCertificateSchemaId, parkCertificateSchema] = await indy.issuerCreateSchema(stewardDid, 'Park-Certificate', '0.1', ['first_name', 'last_name', 'status', 'level'])
    console.log({
        parkCertificateSchemaId: parkCertificateSchemaId,
        parkCertificateSchema, parkCertificateSchema
    })

    console.log('Steward -> Send "Park-Certificate" Schema to Ledger')
    await sendSchema(poolHandle, stewardWallet, stewardDid, parkCertificateSchema)

    console.log("\n=============================================")
    console.log("=== Company Credential Definition Setup ===\n")

    console.log('Company -> Get "Job-Certificate" Schema from Ledger')
    let [theJobCertificateSchemaId, theJobCertificateSchema] = await getSchema(poolHandle, companyDid, jobCertificateSchemaId)
    console.log({
        theJobCertificateSchemaId: theJobCertificateSchemaId,
        theJobCertificateSchema: theJobCertificateSchema
    })

    console.log('Company -> Create and store "Company Job-Certificate" Credential Definition')
    let [companyJobCertificateCredDefId, companyJobCertificateCredDefJson] = await indy.issuerCreateAndStoreCredentialDef(companyWallet, companyDid, theJobCertificateSchema, 'TAG1', 'CL', '{"support_revocation": false}')
    console.log({
        companyJobCertificateCredDefId: companyJobCertificateCredDefId,
        companyJobCertificateCredDefJson: companyJobCertificateCredDefJson
    })

    console.log('Company -> Send "Company Job-Certificate" Credential Definition to Ledger')
    await sendCredDef(poolHandle, companyWallet, companyDid, companyJobCertificateCredDefJson)

    console.log("\n=============================================")
    console.log("=== Park Credential Definition Setup ===\n")

    console.log('Park -> Get "Park-Certificate" Schema from Ledger')
    let [theParkCertificateSchemaId, theParkCertificateSchema] = await getSchema(poolHandle, parkDid, parkCertificateSchemaId)
    console.log({
        theParkCertificateSchemaId, theParkCertificateSchemaId,
        theParkCertificateSchema: theParkCertificateSchema
    })

    console.log('Park -> Create and store "Park Park-Certificate" Credential Definition')
    let [parkParkCertificateCredDefId, parkParkCertificateCredDefJson] = await indy.issuerCreateAndStoreCredentialDef(parkWallet, parkDid, theParkCertificateSchema, 'TAG1', 'CL', '{"support_revocation": false}')
    console.log({
        parkParkCertificateCredDefId: parkParkCertificateCredDefId,
        parkParkCertificateCredDefJson: parkParkCertificateCredDefJson
    })

    console.log('Park -> Send "Park Park-Certificate" Credential Definition to Ledger')
    await sendCredDef(poolHandle, parkWallet, parkDid, parkParkCertificateCredDefJson)

    console.log("\n=============================================")
    console.log("=== Daniel Onboarding ===\n")

    console.log('Daniel -> Create Wallet')
    let danielWalletConfig = {'id': 'danielWallet'}
    let danielWalletCredentials = {'key': 'daniel_key'}
    let danielWallet = await createAndOpenWallet(danielWalletConfig, danielWalletCredentials)

    console.log('Daniel -> Create Master Scecret')
    let danielMasterSecretId = await indy.proverCreateMasterSecret(danielWallet, null)
    console.log({
        danielMasterSecretId: danielMasterSecretId
    })

    let [companyDanielDid, companyDanielVerKey, danielCompanyDid, danielCompanyVerkey, danielCompanyConnectionResponse] = await onboarding(poolHandle, 'Company', companyWallet, companyDid, 'Daniel', danielWallet)
    console.log({
        companyDanielDid: companyDanielDid,
        companyDanielVerKey: companyDanielVerKey,
        danielCompanyDid: danielCompanyDid,
        danielCompanyVerkey: danielCompanyVerkey,
        danielCompanyConnectionResponse: danielCompanyConnectionResponse
    })

    console.log("\n=============================================")
    console.log("=== Company Sending Job-Certificate Credential Offer ===\n")

    console.log('Company -> Create \"Job-Certificate\" Credential Offer for Daniel')
    let jobCertificateCredOfferJson = await indy.issuerCreateCredentialOffer(companyWallet, companyJobCertificateCredDefId)
    console.log({
        jobCertificateCredOfferJson: jobCertificateCredOfferJson
    })

    console.log('Company -> Get key for Daniel Did')
    let danielCompanyVerkey2 = await indy.keyForDid(poolHandle, companyWallet, danielCompanyConnectionResponse.did)
    console.log({
        danielCompanyVerkey2: danielCompanyVerkey2
    })

    console.log('Company -> Authcrypt "Job-Certificate" Credential Offer for Daniel')
    let authcryptedJobCertificateCredOffer = await indy.cryptoAuthCrypt(companyWallet, companyDanielVerKey, danielCompanyVerkey2, Buffer.from(JSON.stringify(jobCertificateCredOfferJson), 'utf8'))
    console.log({
        authcryptedJobCertificateCredOffer: authcryptedJobCertificateCredOffer
    })

    console.log('Company -> Sending authcrypted "Job-Certificate" Credential Offer to Daniel ......')

    console.log('Daniel -> ...... authcrypted "Job-Certificate" Credential Offer received')

    console.log('Daniel -> Authdecrypt "Job-Certificate" Credential Offer from Company')
    let [companyDanielVerKey2, authdecryptedJobCertificateCredOfferJson, authdecryptedJobCertificateCredOffer] = await authDecrypt(danielWallet, danielCompanyVerkey, authcryptedJobCertificateCredOffer)
    console.log({
        companyDanielVerKey2: companyDanielVerKey2,
        authdecryptedJobCertificateCredOfferJson: authdecryptedJobCertificateCredOfferJson, 
        authdecryptedJobCertificateCredOffer: authdecryptedJobCertificateCredOffer
    })

    console.log("\n=============================================")
    console.log("=== Daniel Getting Job-Certificate Credential ===\n")

    console.log('Daniel -> Get "Company Job-Certificate" Credential Definition from Ledger')
    let [theCompanyJobCertificateCredDefId, theCompanyJobCertificateCredDefJson] = await getCredDef(poolHandle, danielCompanyDid, authdecryptedJobCertificateCredOffer.cred_def_id)
    console.log({
        theCompanyJobCertificateCredDefId: theCompanyJobCertificateCredDefId,
        theCompanyJobCertificateCredDefJson: theCompanyJobCertificateCredDefJson
    })

    console.log('Daniel -> Create "Job-Certificate" Credential Request for Company')
    let [jobCertificateCredRequestJson, jobCertificateCredRequestMetadataJson] = await indy.proverCreateCredentialReq(danielWallet, danielCompanyDid, authdecryptedJobCertificateCredOfferJson, theCompanyJobCertificateCredDefJson, danielMasterSecretId)
    console.log({
        jobCertificateCredRequestJson: jobCertificateCredRequestJson,
        jobCertificateCredRequestMetadataJson: jobCertificateCredRequestMetadataJson
    })

    console.log('Daniel -> Authcrypt "Job-Certificate" Credential Request for Company')
    let authcryptedJobCertificateCredRequest = await indy.cryptoAuthCrypt(danielWallet, danielCompanyVerkey, companyDanielVerKey2, Buffer.from(JSON.stringify(jobCertificateCredRequestJson), 'utf8'))
    console.log({
        authcryptedJobCertificateCredRequest: authcryptedJobCertificateCredRequest
    })

    console.log('Daniel -> Sending authcrypted "Job-Certificate" Credential Request to Company ......')

    console.log('Company -> ...... authcrypted "Job-Certificate" Credential Request received')

    console.log('Company -> Authdecrypt "Job-Certificate" Credential Request from Daniel')
    let [danielCompanyVerkey3, authdecryptedJobCertificateCredRequestJson, authdecryptedJobCertificateCredRequest] = await authDecrypt(companyWallet, companyDanielVerKey, authcryptedJobCertificateCredRequest)
    console.log({
        danielCompanyVerkey3: danielCompanyVerkey3,
        authdecryptedJobCertificateCredRequestJson: authdecryptedJobCertificateCredRequestJson,
        authdecryptedJobCertificateCredRequest: authdecryptedJobCertificateCredRequest
    })

    console.log('Company -> Create "Job-Certificate" Credential for Daniel')
    let jobCertificateCredValues = {
        first_name: {
            raw: 'Alice',
            encoded: '245712572474217942457235975012103335'
        },
        last_name: {
            raw: 'Garcia',
            encoded: '312643218496194691632153761283356127'
        },
        salary: {
            raw: '2400',
            encoded: '2400'
        },
        status: {
            raw: 'Permanent',
            encoded: '2143135425425143112321314321'
        },
        experience: {
            raw: '10',
            encoded: '10'
        }
    }
    console.log({
        jobCertificateCredValues: jobCertificateCredValues
    })
    let [jobCertificateCredJson, jobCertificateCredRevocId, jobCertificateCredRevocRegDeltaJson] = await indy.issuerCreateCredential(companyWallet, jobCertificateCredOfferJson, authdecryptedJobCertificateCredRequestJson, jobCertificateCredValues, null, -1)
    console.log({
        jobCertificateCredJson: jobCertificateCredJson,
        jobCertificateCredRevocId: jobCertificateCredRevocId,
        jobCertificateCredRevocRegDeltaJson: jobCertificateCredRevocRegDeltaJson
    })

    console.log('Company -> Authcrypt "Job-Certificate" Credential for Daniel')
    let authcryptedJobCertificateCredJson = await indy.cryptoAuthCrypt(companyWallet, companyDanielVerKey, danielCompanyVerkey2, Buffer.from(JSON.stringify(jobCertificateCredJson), 'utf8'))
    console.log({
        authcryptedJobCertificateCredJson: authcryptedJobCertificateCredJson
    })

    console.log('Company -> Sending authcrypted "Job-Certificate" Credential to Daniel ......')

    console.log('Daniel -> ...... authcrypted "Job-Certificate" Credential received')

    console.log('Daniel -> Authdecrypt "Job-Certificate" Credential from Company')
    let [companyDanielVerKey3, authdecryptedJobCertificateCredJson, authdecryptedJobCertificateCred] = await authDecrypt(danielWallet, danielCompanyVerkey, authcryptedJobCertificateCredJson)
    console.log({
        companyDanielVerKey3: companyDanielVerKey3,
        authdecryptedJobCertificateCredJson: authdecryptedJobCertificateCredJson,
        authdecryptedJobCertificateCred: authdecryptedJobCertificateCred
    })

    console.log('Daniel -> Store "Job-Certificate" Credential from Company')
    let jobCertificateCredId = await indy.proverStoreCredential(danielWallet, null, jobCertificateCredRequestMetadataJson, authdecryptedJobCertificateCredJson, theCompanyJobCertificateCredDefJson, null)
    console.log({
        jobCertificateCredId: jobCertificateCredId
    })


    console.log("\n=============================================")
    console.log("=== Cleanup ===\n")

    console.log('Steward -> Close and Delete Wallet')
    await indy.closeWallet(stewardWallet)
    await indy.deleteWallet(stewardWalletConfig, stewardWalletCredentials)

    console.log('Park -> Close and Delete Wallet')
    await indy.closeWallet(parkWallet)
    await indy.deleteWallet(parkWalletConfig, parkWalletCredentials)

    console.log('Company -> Close and Delete Wallet')
    await indy.closeWallet(companyWallet)
    await indy.deleteWallet(companyWalletConfig, companyWalletCredentials)

    console.log('Daniel -> Close and Delete Wallet')
    await indy.closeWallet(danielWallet)
    await indy.deleteWallet(danielWalletConfig, danielWalletCredentials)

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
    console.log("\n*** onboarding ***\n")

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
    console.log("\n*** getVerinym ***\n")
    
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
    await sendNym(poolHandle, fromWallet, fromDid, authdecryptedDidInfoJson.did, authdecryptedDidInfoJson.verkey, role)

    return toDid
}

async function sendNym(poolHandle, walletHandle, submitterDid, targetDid, targetVerKey, role) {
    let nymRequest = await indy.buildNymRequest(submitterDid, targetDid, targetVerKey, null, role)
    let requestResult = await indy.signAndSubmitRequest(poolHandle, walletHandle, submitterDid, nymRequest)
    console.log({
        requestResult: requestResult
    })

    return requestResult
}

async function sendSchema(poolHandle, walletHandle, submitterDid, schema) {
    let schemaRequest = await indy.buildSchemaRequest(submitterDid, schema)
    let requestResult = await indy.signAndSubmitRequest(poolHandle, walletHandle, submitterDid, schemaRequest)
    console.log({
        requestResult: requestResult
    })

    return requestResult
}

async function getSchema(poolHandle, submitterDid, schemaId) {
    let request = await indy.buildGetSchemaRequest(submitterDid, schemaId)
    let requestResult = await indy.submitRequest(poolHandle, request)
    console.log({
        requestResult: requestResult
    })

    return await indy.parseGetSchemaResponse(requestResult)
}

async function getCredDef(poolHandle, submitterDid, credDefId) {
    let request = await indy.buildGetCredDefRequest(submitterDid, credDefId)
    let requestResult = await indy.submitRequest(poolHandle, request)
    console.log({
        requestResult: requestResult
    })

    return await indy.parseGetCredDefResponse(requestResult)
}

async function sendCredDef(poolHandle, walletHandle, submitterDid, credDef) {
    let request = await indy.buildCredDefRequest(submitterDid, credDef)
    let requestResult = await indy.signAndSubmitRequest(poolHandle, walletHandle, submitterDid, request)
    console.log({
        requestResult: requestResult
    })

    return requestResult
}

async function authDecrypt(walletHandle, recipientVerKey, encryptedMessageRaw) {
    let [senderVerKey, decryptedMessageRaw] = await indy.cryptoAuthDecrypt(walletHandle, recipientVerKey, encryptedMessageRaw)
    let decryptedMessage = JSON.parse(decryptedMessageRaw)
    let decryptedMessageJson = JSON.stringify(decryptedMessage)

    return [senderVerKey, decryptedMessageJson, decryptedMessage]
}
