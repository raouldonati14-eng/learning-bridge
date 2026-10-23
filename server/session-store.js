import crypto from 'node:crypto';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class SessionStore {
  constructor({idleMs=30*60_000}={}){this.sessions=new Map();this.idleMs=idleMs;}
  create(teacherId){let code;do{code=Array.from(crypto.randomBytes(5),b=>ALPHABET[b%ALPHABET.length]).join('');}while(this.sessions.has(code));const s={code,teacherId,students:new Set(),status:'ready',createdAt:Date.now(),touchedAt:Date.now(),segments:[],recognizer:null,nextSequence:1,generation:0};this.sessions.set(code,s);return s;}
  get(code){const s=this.sessions.get(String(code||'').trim().toUpperCase());if(s)s.touchedAt=Date.now();return s;}
  remove(code){const s=this.sessions.get(code);s?.recognizer?.stop();this.sessions.delete(code);return s;}
  removeTeacher(id){for(const [code,s] of this.sessions)if(s.teacherId===id)this.remove(code);}
  sweep(now=Date.now()){for(const [code,s] of this.sessions)if(now-s.touchedAt>this.idleMs)this.remove(code);}
}
