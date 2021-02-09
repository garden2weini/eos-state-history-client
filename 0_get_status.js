#!/usr/bin/env node

/**
 * yarn add commander
 * yarn add ws
 * yarn add eosjs@beta
 */

'use strict'

let socketAddress
let loop

{
  const DEFAULT_ADDRESS = 'ws://localhost:8080'

  const po = require('commander')
  po
    .version('0.1.0')
    .option('-a, --socket-address [address]', 'Socket address', DEFAULT_ADDRESS)
    .option('-l, --loop', 'Endless loop, per 500ms', false)
    .parse(process.argv)

  if (!po.socketAddress) {
    po.outputHelp()
    process.exit(-1)
  }
  socketAddress = po.socketAddress
  loop = !!po.loop

  console.log('Socket address: ' + socketAddress)
  console.log('Endless loop: ' + loop)
}

const WebSocket = require('ws')
const { Serialize } = require('eosjs')
const { TextDecoder, TextEncoder } = require('text-encoding')

let expectingABI = true
let serverTypes
const ws = new WebSocket(socketAddress, {perMessageDeflate: false})

ws.on('open', function open() {
  expectingABI = true
})

ws.on('message', async function message(data) {
  if (expectingABI) {
    expectingABI = false

    let serverABI = JSON.parse(data)
    //console.log(serverABI)
    serverTypes = Serialize.getTypesFromAbi(Serialize.createInitialTypes()
      , serverABI)
    //console.log('request:', serverTypes.get('request'))

    let getStatus = () => {
      const buffer = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder(),
        textDecoder: new TextDecoder(),
      })
      //console.log(buffer)
      serverTypes.get('request').serialize(buffer, ['get_status_request_v0', {}]
        )
      ws.send(buffer.asUint8Array())
    }

    if (loop) {
      setInterval(getStatus, 500)
    } else {
      getStatus()
    }
  } else {
    const buffer = new Serialize.SerialBuffer({
      textEncoder: new TextEncoder(),
      textDecoder: new TextDecoder(),
      array: data
    })
    const realData = serverTypes.get('result').deserialize(buffer)
    console.log(realData)

    if (!loop) {
      ws.close()
    }
  }
})