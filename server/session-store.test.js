import test from 'node:test';import assert from 'node:assert/strict';import {SessionStore} from './session-store.js';
test('creates easy session codes',()=>assert.match(new SessionStore().create('teacher').code,/^[A-Z2-9]{5}$/));
test('expires sessions and stops recognition',()=>{let stopped=false;const store=new SessionStore({idleMs:1});const s=store.create('t');s.recognizer={stop(){stopped=true;}};store.sweep(s.touchedAt+2);assert.equal(store.sessions.size,0);assert.equal(stopped,true);});
