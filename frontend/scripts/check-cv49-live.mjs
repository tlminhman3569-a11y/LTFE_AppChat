import assert from 'node:assert/strict'
import { test } from 'node:test'
import { confirmLeave, inspectMembers } from './cv49-live.mjs'
const room = 'cv49_test'
const reply = data => ({event:'OUT_ROOM', status:'success', data})
for (const [label, data] of [
    ['wrong name + nonempty mes', {name:'other', mes:'OK'}],
    ['wrong name without mes', {name:'other'}],
    ['empty name + mes', {name:'', mes:'OK'}],
    ['null name + mes', {name:null, mes:'OK'}],
    ['undefined name + mes', {name:undefined, mes:'OK'}],
    ['case mismatch + mes', {name:'CV49_TEST', mes:'OK'}],
    ['no name + whitespace mes', {mes:'  '}],
    ['no name + numeric mes', {mes:1}],
    ['empty data', {}], ['null data', null], ['array data', []], ['string data', 'OK'],
]) test(`reject ${label}`, () => assert.throws(() => confirmLeave(reply(data), room), /unconfirmed_name_OUT_ROOM/))
for (const [label, data] of [['correct name', {name:room}], ['correct name + mes', {name:room,mes:'OK'}], ['absent name + mes', {mes:'OK'}]])
    test(`accept ${label}`, () => assert.doesNotThrow(() => confirmLeave(reply(data),room)))
test('reject error status', () => assert.throws(() => confirmLeave({...reply({name:room}),status:'error'},room), /unexpected_status/))
test('reject wrong event', () => assert.throws(() => confirmLeave({...reply({name:room}),event:'JOIN_ROOM'},room), /unexpected_event/))
test('member list verifies both accounts', () => assert.equal(inspectMembers({userList:['A',{name:'B'}],own:'A'},'A','B').outcome,'passed'))
test('member list missing', () => assert.equal(inspectMembers({},'A','B').outcome,'unverified'))
test('member list malformed', () => assert.equal(inspectMembers({userList:[{}]},'A','B').outcome,'unverified'))
test('member B absent', () => assert.equal(inspectMembers({userList:['A']},'A','B').outcome,'failed'))
