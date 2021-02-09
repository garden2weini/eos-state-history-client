#!/usr/bin/env node

/**
 * yarn add commander
 * yarn add ws
 * yarn add eosjs
 * undone, untest
 */

'use strict'

let socketAddress

{
  const DEFAULT_ADDRESS = 'ws://localhost:8080'

  const po = require('commander')
  po
    .version('0.1.0')
    .option('-a, --socket-address [address]', 'Socket address', DEFAULT_ADDRESS)
    .parse(process.argv)

  if (!po.socketAddress) {
    po.outputHelp()
    process.exit(-1)
  }

  console.log('Socket address: ' + po.socketAddress)
  socketAddress = po.socketAddress
}

const WebSocket = require('ws')
const { Serialize } = require('eosjs')
const { TextDecoder, TextEncoder } = require('text-encoding')

let expectingABI = true
let serverTypes
const ws = new WebSocket(socketAddress, null, {perMessageDeflate: false})

ws.on('open', function open() {
  expectingABI = true
})

ws.on('message', async function message(data) {
  if (expectingABI) {
    expectingABI = false

    let serverABI = JSON.parse(data)
    serverTypes = Serialize.getTypesFromAbi(Serialize.createInitialTypes()
      , serverABI)
    //console.log('request:', serverTypes.get('request'))

    const buffer = new Serialize.SerialBuffer({
      textEncoder: new TextEncoder(),
      textDecoder: new TextDecoder(),
    })
    serverTypes.get('request').serialize(buffer, ['get_blocks_request_v0', {
      start_block_num: 2,
      end_block_num: 2,
      max_messages_in_flight: 1,
      have_positions: [],
      irreversible_only: false,
      fetch_block: true,
      fetch_traces: true,
      fetch_deltas: true
    }])
    ws.send(buffer.asUint8Array())
  } else {
    const buffer = new Serialize.SerialBuffer({
      textEncoder: new TextEncoder(),
      textDecoder: new TextDecoder(),
      array: data
    })
    const realData = serverTypes.get('result').deserialize(buffer)
    if (realData[0] == 'get_blocks_result_v0') {
      console.log(realData[1])
      // const buf = new Serialize.SerialBuffer({
      //   textEncoder: new TextEncoder(),
      //   textDecoder: new TextDecoder(),
      // })
      // serverTypes.get('request').serialize(buf, ['get_blocks_ack_request_v0', {
      //   num_messages: 1
      // }])
      // ws.send(buf.asUint8Array())
      ws.close()
    } else {
      console.log(realData)
      ws.close()
    }
  }
})

ws.on('close', () => {
  console.log('Socket disconnected!');
})