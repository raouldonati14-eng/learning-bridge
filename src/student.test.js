import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';

// Run the real entry point with production React. Only the network and browser
// media boundaries are faked; hooks, DOM rendering and event handlers are real.
const bundle = await build({configFile:false, logLevel:'silent',
  plugins:[{name:'fake-socket',enforce:'pre',resolveId(id){if(id==='socket.io-client')return '\0fake-socket';},
    load(id){if(id==='\0fake-socket')return 'export const io = () => globalThis.__socket;';}}],
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{write:false,lib:{entry:'src/main.jsx',formats:['iife'],name:'LectureBridge'},minify:true}
});

test('teacher still creates a session and renders interim and translated English',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/teacher',runScripts:'outside-only'});
  const w=dom.window,listeners=new Map(),errors=[];
  w.addEventListener('error',e=>{errors.push(e.error.message);e.preventDefault();});
  w.fetch=async()=>({json:async()=>({teacherAccessRequired:false})});
  w.__socket={on(event,fn){listeners.set(event,fn);},off(event){listeners.delete(event);},
    emit(event,payload,reply){assert.equal(event,'teacher:create');reply({ok:true,session:{code:'J7K4P',status:'ready',segments:[],studentCount:0}});}};
  try{
    w.eval(script);await settle();await settle();
    assert.match(w.document.body.textContent,/J7K4P/);
    assert.match(w.document.body.textContent,/Start Lecture/);
    listeners.get('transcript:interim')({text:'Teacher speaking',isFinal:false});await settle();
    assert.match(w.document.body.textContent,/Teacher speaking/);
    listeners.get('segment:translated')({id:'teacher-one',english:'Hello students',spanish:'Hola estudiantes'});await settle();
    assert.match(w.document.body.textContent,/Hello students/);
    assert.deepEqual(errors,[]);
  }finally{w.close();}
});
const script=(Array.isArray(bundle)?bundle[0]:bundle).output.find(item=>item.type==='chunk').code;
const settle=()=>new Promise(resolve=>setTimeout(resolve,100));

for(const promiseScroll of [false,true])test(`student join, captions and audio (scroll returns ${promiseScroll?'Promise':'undefined'})`,async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/student',runScripts:'outside-only'});
  const w=dom.window,errors=[],listeners=new Map(),emitted=[],media=[];
  w.addEventListener('error',event=>{errors.push(event.error);event.preventDefault();});
  w.HTMLElement.prototype.scrollIntoView=()=>promiseScroll?Promise.resolve():undefined;
  const session={code:'J7K4P',status:'live',studentCount:1,segments:[],nextSequence:1};
  w.__socket={on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
    off(event,fn){listeners.get(event)?.delete(fn);},emit(event,payload,reply){emitted.push({event,payload});if(event==='student:join')reply({ok:true,session});}};
  const receive=(event,payload)=>{for(const fn of listeners.get(event)||[])fn(payload);};
  w.Audio=class {constructor(src){this.src=src;media.push(this);}play(){this.onplaying?.();return Promise.resolve();}pause(){}};
  try{
    w.eval(script);await settle();
    const input=w.document.querySelector('input');
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,'J7K4P');
    input.dispatchEvent(new w.Event('input',{bubbles:true}));await settle();
    w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
    assert.match(w.document.body.textContent,/Session J7K4P/);
    assert.equal(w.sessionStorage.getItem('lecturebridge-code'),'J7K4P');
    const segment={id:'one',sequence:1,english:'Hello class',spanish:'Hola clase',audioBase64:'dGVzdA=='};
    receive('segment:translated',segment);await settle();
    assert.deepEqual(errors.map(e=>e.message),[]);
    assert.match(w.document.body.textContent,/Hello class/);assert.match(w.document.body.textContent,/Hola clase/);
    receive('transcript:interim',{text:'Next sentence',isFinal:false});await settle();
    assert.match(w.document.body.textContent,/Next sentence/);
    [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Start Live Translation').click();await settle();
    receive('segment:ready',segment);await settle();
    assert.equal(media.at(-1).src,'data:audio/mpeg;base64,dGVzdA==');
    assert.ok(emitted.some(e=>e.event==='audio:playback'&&e.payload.event==='started'));
    media.at(-1).onended();await settle();
    assert.ok(emitted.some(e=>e.event==='audio:playback'&&e.payload.event==='completed'));
    receive('disconnect');receive('connect');await settle();
    assert.equal(emitted.filter(e=>e.event==='student:join').length,2);
    receive('session:state',{...session,status:'paused',segments:[segment]});await settle();
    assert.match(w.document.body.textContent,/Lecture paused/);
    receive('session:state',{...session,status:'ended',segments:[segment]});await settle();
    assert.match(w.document.body.textContent,/Lecture ended/);
    assert.deepEqual(errors.map(e=>e.message),[]);
  }finally{w.close();}
});




