'use strict'

import * as vcx from '../src'
import * as ffi from 'ffi'
import * as path from 'path'

run()

async function run() {
  const nullpayPath = path.resolve(__dirname, '../../../../libnullpay/target/debug/libnullpay.dylib')
  const nullpay = ffi.Library(nullpayPath, {
    'nullpay_init': ['void', []]
  })
  nullpay.nullpay_init()

  console.log('#1 Provision an agent and wallet, get back configuration details')
  let provisionConfig = {
    'agency_url':'http://localhost:8080',
    'agency_did':'VsKV7grR1BUE29mG2Fm2kX',
    'agency_verkey':'Hezce2UWMZ3wUhVkh2LfKSs8nDzWwzs2Win7EzNN3YaR',
    'wallet_name':'faber_wallet',
    'wallet_key':'123',
    'payment_method': 'null',
    'enterprise_seed':'19e2ea3730c3d62f36a095a44d343c7f5d81e0168c7f987b3d70a37c516bb45d',
    'path': '/Users/yisheng/Projects/indy-sdk/vcx/wrappers/python3/demo/docker-jd.txn'
  }
  let vcxConfig = JSON.parse(await vcx.provisionAgent(JSON.stringify(provisionConfig)))
  console.log({vcxConfig: vcxConfig})

  console.log("#2 Initialize libvcx with new configuration")
  vcxConfig.institution_name = 'Faber'
  vcxConfig.institution_logo_url = 'http://robohash.org/234'
  vcxConfig.genesis_path = '/Users/yisheng/Projects/indy-sdk/vcx/wrappers/python3/demo/docker-jd.txn'
  vcxConfig.pool_name = 'gytest'
  // vcxConfig.enable_test_mode = 'true'
  console.log({vcxConfig: vcxConfig})
  await vcx.initVcxWithConfig(JSON.stringify(vcxConfig))
  // await vcx.initVcxWithConfig('ENABLE_TEST_MODE')

  // await vcx.defaultLogger('trace')
  // await vcx.defaultLogger('debug')
  await vcx.defaultLogger('info')

  console.log('#3 Create a new schema on the ledger')
  const dataSchemaCreate = (): vcx.ISchemaCreateData => ({
    data: {
      attrNames: [
        'name',
        'date',
        'degree'
      ],
      name: 'degree schema',
      version: randomInt(1, 100) + '.' + randomInt(1, 100) + '.' + randomInt(1, 100)
    },
    paymentHandle: 0,
    sourceId: 'schema_uuid'
  })
  const schemaCreated = await vcx.Schema.create(dataSchemaCreate())
  console.log({
    dataSchemaCreate: dataSchemaCreate(),
    schemaCreated: schemaCreated,
    schemaId: schemaCreated.schemaId
  })

  const dataSchemaLookup = () : vcx.ISchemaLookupData => ({
    sourceId: 'schema_uuid',
    schemaId: schemaCreated.schemaId
  })
  const schemaLookup = await vcx.Schema.lookup(dataSchemaLookup())
  console.log({
    dataSchemaLookup: dataSchemaLookup(),
    schemaLookup: schemaLookup
  })

  console.log('#4 Create a new credential definition on the ledger')
  const dataCredentialDefCreate = (): vcx.ICredentialDefCreateData => ({
    sourceId: 'credef_uuid',
    name: 'credef_uuid',
    schemaId: schemaCreated.schemaId,
    revocation: false,
    paymentHandle: 0
  })
  const credentialDefCreated = await vcx.CredentialDef.create(dataCredentialDefCreate())
  const credentialDefId = await credentialDefCreated.getCredDefId()
  console.log({
    dataCredentialDefCreate: dataCredentialDefCreate(),
    credentialDefCreated: credentialDefCreated,
    credentialDefId: credentialDefId
  })

  console.log('#5 Create a connection to alice and print out the invite details')
  const dataConnectionCreate = (): vcx.IConnectionCreateData => ({
    id: 'alice'
  })
  const connectionCreated = await vcx.Connection.create(dataConnectionCreate())
  const inviteDetail1 = await connectionCreated.connect({ data: '{"connection_type":"QR"}' })
  const inviteDetail2 = await connectionCreated.inviteDetails()
  console.log({
    dataConnectionCreate: dataConnectionCreate(),
    connectionCreated: connectionCreated,
    inviteDetail1: inviteDetail1,
    inviteDetail2: inviteDetail2
  })

  console.log('#6 Poll agency and wait for alice to accept the invitation (start alice.py now)')
  let connectionState = await connectionCreated.getState()
  console.log({
    connectionState: connectionState
  })
  while (connectionState !== vcx.StateType.Accepted) {
    await sleep(5000)
    await connectionCreated.updateState()
    connectionState = await connectionCreated.getState()

    console.log({
      connectionState: connectionState
    })
  }
  
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function sleep(ms: number) {
  return new Promise(resolve=>{
      setTimeout(resolve, ms)
  })
}