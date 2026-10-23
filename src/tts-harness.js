export const TTS_PROVIDERS=Object.freeze({GOOGLE:'google',BROWSER:'browser'});
export function selectedDevelopmentProvider(search=''){
  const value=new URLSearchParams(search).get('devTts');return value==='browser'?TTS_PROVIDERS.BROWSER:TTS_PROVIDERS.GOOGLE;
}
export function isDevelopmentHarnessEnabled(search=''){return new URLSearchParams(search).has('devTts');}
export function playbackTelemetry({code,segment,event,provider,queue,at=Date.now()}){return{code,segmentId:segment.id,event,provider,at,queue};}
