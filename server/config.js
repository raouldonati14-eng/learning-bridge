import crypto from 'node:crypto';

export function parsePositiveNumber(value,fallback){const number=Number(value);return Number.isFinite(number)&&number>0?number:fallback;}
export function socketCorsOptions(env=process.env){
  if(env.CLIENT_ORIGIN){const origins=env.CLIENT_ORIGIN.split(',').map(x=>x.trim()).filter(Boolean);return{origin:origins,credentials:false};}
  return env.NODE_ENV==='production'?{origin:false}:{origin:true,credentials:false};
}
export function isAllowedSocketOrigin(request,env=process.env){
   const origin = request.headers?.origin;
  if (env.NODE_ENV !== 'production') return true;
  if (!origin) {
    const site = String(request.headers?.['sec-fetch-site'] || '').toLowerCase();
    return site === 'same-origin';
  }
  if(env.CLIENT_ORIGIN)return env.CLIENT_ORIGIN.split(',').map(x=>x.trim()).filter(Boolean).includes(origin);
  try{const originUrl=new URL(origin),forwardedHost=String(request.headers['x-forwarded-host']||request.headers.host||'').split(',')[0].trim();return originUrl.protocol==='https:'&&originUrl.host===forwardedHost;}catch{return false;}
}
export function googleCredentials(env=process.env){
  if(!env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64)return undefined;
  let parsed;try{parsed=JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,'base64').toString('utf8'));}catch{throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64-encoded JSON.');}
  if(!parsed.client_email||!parsed.private_key)throw new Error('Google service-account credentials are missing client_email or private_key.');
  return{client_email:parsed.client_email,private_key:parsed.private_key};
}
export function teacherAccessRequired(env=process.env){return Boolean(env.TEACHER_ACCESS_CODE);}
export function validTeacherAccess(candidate,env=process.env){
  if(!teacherAccessRequired(env))return true;
  const expected=Buffer.from(env.TEACHER_ACCESS_CODE),actual=Buffer.from(String(candidate||''));
  return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
